import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { getAdminFirestore, verifyAuthToken, type DocumentReference } from './server/firebaseAdmin';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini API client if API key is available
const apiKey = process.env.GEMINI_API_KEY || '';
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (err) {
    console.warn('Failed to initialize server-side GoogleGenAI:', err);
  }
}

/**
 * Robust Gemini generation helper: uses fast gemini-3.1-flash-lite as primary for rapid
 * responses, with fallback to gemini-3.8-flash.
 */
async function generateGeminiContent(options: {
  contents: string;
  config?: any;
}) {
  if (!aiClient) return null;
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastErr: any = null;
  for (const model of models) {
    try {
      const response = await aiClient.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastErr = err;
    }
  }
  if (lastErr) {
    console.info('Gemini models unavailable, falling back to deterministic processing:', lastErr?.message || lastErr);
  }
  throw lastErr || new Error('All supported Gemini models failed');
}

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: Boolean(apiKey) });
});

// ============================================================================
// Secure Checkout Endpoint: Server-side inventory decrement & order creation
// ============================================================================
app.post('/api/orders/checkout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!idToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing Firebase authentication token.' });
    }

    // 1. Verify Firebase ID Token to establish trusted buyer UID
    let decodedToken;
    try {
      decodedToken = await verifyAuthToken(idToken);
    } catch (err: any) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid Firebase authentication session.',
        details: err.message,
      });
    }

    const buyerUid = decodedToken.uid;
    const idempotencyKey =
      (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

    const {
      sellerId,
      items,
      buyerName,
      buyerPhone,
      buyerLocation,
      customerNotes,
    } = req.body;

    if (!sellerId || typeof sellerId !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid sellerId provided.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order must contain at least one product item.' });
    }

    // Validate each item structure
    for (const item of items) {
      if (!item.productId || typeof item.productId !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid productId specified.' });
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: `Quantity must be a positive integer for product "${item.productId}".`,
        });
      }
    }

    const db = getAdminFirestore();

    // 2. Execute atomic Firestore transaction
    const orderResult = await db.runTransaction(async (transaction) => {
      // Determine orderId from idempotencyKey or timestamp
      let orderId = `order-${Date.now()}`;
      if (idempotencyKey && typeof idempotencyKey === 'string') {
        const cleanKey = idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
        if (cleanKey) {
          orderId = cleanKey.startsWith('order-') ? cleanKey : `order-${cleanKey}`;
        }
      }

      // Check if an order with this idempotency key already exists to prevent duplicate execution
      const orderRef = db.collection('orders').doc(orderId);
      const existingOrderSnap = await transaction.get(orderRef);
      if (existingOrderSnap.exists) {
        // Return existing confirmed order without re-decrementing inventory
        return existingOrderSnap.data();
      }

      // Look up seller store profile
      const sellerRef = db.collection('sellerProfiles').doc(sellerId);
      const sellerSnap = await transaction.get(sellerRef);

      if (!sellerSnap.exists) {
        throw new Error('Seller store not found.');
      }

      const sellerData = sellerSnap.data() || {};

      // Enforce business rule: Sellers cannot purchase from their own storefront
      if (sellerData.userId === buyerUid) {
        throw new Error('Sellers cannot purchase products from their own storefront. Please use a buyer account.');
      }

      // Read all products and validate inventory
      const productUpdates: { ref: DocumentReference; newStock: number; inStock: boolean }[] = [];
      const itemSnapshots: any[] = [];
      let subtotal = 0;
      let originalSubtotal = 0;

      for (const item of items) {
        const prodRef = db.collection('products').doc(item.productId);
        const prodSnap = await transaction.get(prodRef);

        if (!prodSnap.exists) {
          throw new Error(`Product "${item.productId}" was not found.`);
        }

        const prod = prodSnap.data() || {};

        // Verify product belongs to the specified store
        if (
          prod.sellerId !== sellerId &&
          prod.sellerId !== sellerData.id &&
          prod.sellerId !== sellerData.userId
        ) {
          throw new Error(`Product "${prod.name || item.productId}" does not belong to this store.`);
        }

        const currentStock = typeof prod.stockQuantity === 'number' ? prod.stockQuantity : 0;
        if (currentStock < item.quantity) {
          throw new Error(
            `Insufficient stock for "${prod.name || 'product'}". Available: ${currentStock}, requested: ${item.quantity}.`
          );
        }

        // Trusted price calculation based exclusively on Firestore document
        const originalPrice = typeof prod.originalPrice === 'number' ? prod.originalPrice : 0;
        const discountPercent = typeof prod.discountPercent === 'number' ? prod.discountPercent : 0;
        const finalPrice =
          typeof prod.finalPrice === 'number'
            ? prod.finalPrice
            : Math.round(originalPrice * (1 - discountPercent / 100));

        const itemTotal = finalPrice * item.quantity;
        subtotal += itemTotal;
        originalSubtotal += originalPrice * item.quantity;

        const newStock = Math.max(0, currentStock - item.quantity);
        const inStock = newStock > 0;

        productUpdates.push({
          ref: prodRef,
          newStock,
          inStock,
        });

        itemSnapshots.push({
          productId: prodSnap.id,
          productName: prod.name || 'Product',
          productImage: prod.imageUrl || '',
          category: prod.category || 'General',
          originalPrice,
          discountPercent,
          unitPrice: finalPrice,
          quantity: item.quantity,
          itemTotal,
        });
      }

      // Delivery calculation from trusted seller options
      const discountTotal = originalSubtotal - subtotal;
      const freeDeliveryAbove = sellerData.deliveryOptions?.freeDeliveryAbove ?? 1500;
      const baseDeliveryFee = sellerData.deliveryOptions?.baseDeliveryFee ?? 50;
      const deliveryFee = subtotal >= freeDeliveryAbove ? 0 : baseDeliveryFee;
      const total = subtotal + deliveryFee;

      const orderNumber = `LC-${Math.floor(1000 + Math.random() * 9000)}`;
      const nowIso = new Date().toISOString();

      const newOrder = {
        id: orderId,
        orderNumber,
        buyerId: buyerUid,
        buyerName: buyerName || decodedToken.name || 'Local Shopper',
        buyerPhone: buyerPhone || '',
        buyerLocation: buyerLocation || null,
        sellerId: sellerSnap.id,
        sellerUserId: sellerData.userId || sellerSnap.id,
        sellerBusinessName: sellerData.businessName || 'Local Store',
        sellerLocation: sellerData.location || null,
        items: itemSnapshots,
        subtotal,
        deliveryFee,
        discountTotal,
        total,
        status: 'CONFIRMED',
        isBillLocked: true,
        lockedAt: nowIso,
        deliveryMethod: 'SELLER_DELIVERY',
        customerNotes: customerNotes || '',
        messages: [
          {
            id: `msg-${Date.now()}`,
            orderId,
            senderRole: 'SYSTEM',
            senderName: 'LocalCart System',
            text: `Order #${orderNumber} confirmed! Final bill locked at ₹${total}. Inventory reserved.`,
            timestamp: nowIso,
            isSystemEvent: true,
          },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Apply inventory decrements
      for (const update of productUpdates) {
        transaction.update(update.ref, {
          stockQuantity: update.newStock,
          inStock: update.inStock,
          updatedAt: nowIso,
        });
      }

      // Write Order document
      transaction.set(orderRef, newOrder);

      // Write Conversation document
      const convRef = db.collection('conversations').doc(orderId);
      transaction.set(convRef, {
        conversationId: orderId,
        orderId,
        buyerId: buyerUid,
        buyerName: newOrder.buyerName,
        sellerId: sellerSnap.id,
        sellerBusinessName: newOrder.sellerBusinessName,
        lastMessage: `Order #${orderNumber} confirmed (₹${total}).`,
        updatedAt: nowIso,
      });

      return newOrder;
    });

    return res.status(200).json({ success: true, order: orderResult });
  } catch (err: any) {
    console.error('Server checkout error:', err);
    return res.status(400).json({ success: false, error: err.message || 'Checkout failed.' });
  }
});

// AI Concierge Endpoint (Buyer & General Shopping Inquiries)
app.post('/api/ai/concierge', async (req, res) => {
  try {
    const { userQuery, context, userLocation } = req.body;
    if (!userQuery) {
      return res.status(400).json({ error: 'userQuery is required' });
    }

    // If Gemini client is active, generate natural language answer strictly grounded in database facts
    if (aiClient) {
      const prompt = `You are the AI Shopping Assistant for LocalCart in ${userLocation?.city || 'Hyderabad'}.
A customer asked: "${userQuery}"

Here are the verified live records retrieved from the live Firestore database for this query:
---------------------------------------------
INTENT: ${context?.intent || 'GENERAL_SHOPPING'}
SUMMARY FACT: ${context?.summaryFact || 'None'}
MATCHED PRODUCTS (${context?.matchedProducts?.length || 0}):
${JSON.stringify(context?.matchedProducts?.map((p: any) => ({
  id: p.id,
  name: p.name,
  businessName: p.businessName,
  sellerId: p.sellerId,
  finalPrice: p.finalPrice,
  originalPrice: p.originalPrice,
  discountPercent: p.discountPercent,
  stockQuantity: p.stockQuantity,
  inStock: p.inStock,
  category: p.category,
  description: p.description,
  preparationTime: p.preparationTime,
  tags: p.tags
})) || [], null, 2)}

MATCHED SELLERS:
${JSON.stringify(context?.matchedSellers?.map((s: any) => ({
  id: s.id,
  businessName: s.businessName,
  category: s.businessCategory,
  rating: s.rating,
  area: s.location?.area,
  city: s.location?.city,
  deliveryFee: s.deliveryOptions?.baseDeliveryFee,
  freeDeliveryAbove: s.deliveryOptions?.freeDeliveryAbove
})) || [], null, 2)}

BUYER ORDERS:
${JSON.stringify(context?.matchedOrders?.map((o: any) => ({
  orderNumber: o.orderNumber,
  sellerName: o.sellerBusinessName,
  status: o.status,
  total: o.total,
  expectedDeliveryDate: o.expectedDeliveryDate,
  itemCount: o.items?.length
})) || [], null, 2)}
---------------------------------------------

STRICT GROUNDING INSTRUCTIONS:
1. Base your answer EXCLUSIVELY on the retrieved live database records above.
2. NEVER fabricate, invent, or guess products, prices, stock, sellers, discounts, or delivery timelines.
3. If the user asks about a specific product price (e.g. "Amul Dark Choko price" or "What is Amul Dark Choko price?"), be direct, concise, and elegant: State the exact current price, seller/workshop name, and current stock availability.
   Example: "Amul Dark Choko is currently ₹405 at G's Studio. There are 8 units available in stock."
4. If the user asks about stock availability (e.g. "Is Amul Dark Choko available?"), confirm whether it is available and state the stock quantity and price.
5. If the user asks "Who sells X?", name the seller and their neighborhood/area.
6. If the user asks for recommendations (e.g. "cakes under ₹500"), summarize the matching creations concisely.
7. If no items match, answer: "I couldn't find that in the current LocalCart catalog."
8. Output JSON format only:
{
  "message": "Direct, refined, natural language answer",
  "suggestedCategories": ["Category1", "Category2"],
  "quickReplies": ["Quick suggestion 1", "Quick suggestion 2"]
}`;

      const response = await generateGeminiContent({
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text.trim());
        return res.json({
          message: parsed.message || context?.summaryFact,
          suggestedCategories: parsed.suggestedCategories || [],
          quickReplies: parsed.quickReplies || []
        });
      }
    }

    // Fallback to deterministic fact
    return res.json({
      message: context?.summaryFact || 'I could not find matching records in the local catalog.',
      suggestedCategories: [],
      quickReplies: []
    });
  } catch (err: any) {
    console.error('Concierge API Error:', err);
    return res.json({
      message: req.body?.context?.summaryFact || 'I could not find matching records in the local catalog.',
      suggestedCategories: [],
      quickReplies: []
    });
  }
});

// AI Seller Onboarding Info Extraction
app.post('/api/ai/seller-onboarding', async (req, res) => {
  try {
    const { productsText, businessTypeText } = req.body;
    if (aiClient) {
      const prompt = `A seller wants to register their local business.
What they sell: "${productsText}"
Business type: "${businessTypeText}"

Generate a structured business profile in STRICT JSON:
{
  "businessNameSuggestion": "Short catchy store brand name",
  "businessCategory": "One of: Bakery & Desserts, Handmade Jewellery, Gifts & Handcrafted Studio, Boutique & Fashion, Home Decor & Art, Organic & Gourmet Snacks, Handmade Soaps & Skincare",
  "tagline": "A warm, catchy 1-sentence tagline",
  "businessDescription": "A professional 2-sentence description for their store profile",
  "extractedProducts": ["Product 1", "Product 2", "Product 3"],
  "tags": ["Tag1", "Tag2", "Tag3"]
}`;

      const response = await generateGeminiContent({
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      if (response && response.text) {
        return res.json(JSON.parse(response.text.trim()));
      }
    }

    // Deterministic fallback
    const lower = `${productsText} ${businessTypeText}`.toLowerCase();
    let category = 'Gifts & Handcrafted Studio';
    if (lower.includes('cake') || lower.includes('bake') || lower.includes('dessert')) category = 'Bakery & Desserts';
    else if (lower.includes('jewel') || lower.includes('earring') || lower.includes('silver')) category = 'Handmade Jewellery';
    else if (lower.includes('dress') || lower.includes('saree') || lower.includes('kurti')) category = 'Boutique & Fashion';
    else if (lower.includes('decor') || lower.includes('candle') || lower.includes('pottery')) category = 'Home Decor & Art';
    else if (lower.includes('snack') || lower.includes('pickle') || lower.includes('organic')) category = 'Organic & Gourmet Snacks';

    return res.json({
      businessNameSuggestion: businessTypeText ? `${businessTypeText.split(' ')[0]} Store` : 'My Local Store',
      businessCategory: category,
      tagline: 'Fresh, authentic products made with utmost care',
      businessDescription: `We craft high-quality ${productsText || 'goods'} for local customers with care and attention to detail.`,
      extractedProducts: productsText ? productsText.split(/[,;\n]+/).map(s => s.trim()).filter(s => s.length > 2) : ['Product 1', 'Product 2'],
      tags: ['Handmade', 'Local Store', 'Custom Orders']
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// AI Product Description Generator
app.post('/api/ai/product-description', async (req, res) => {
  try {
    const { productName, category, keyFeatures } = req.body;
    if (aiClient) {
      const prompt = `Write an attractive e-commerce description for a local store product.
Product Name: "${productName}"
Category: "${category}"
Features: "${keyFeatures}"

Return STRICT JSON:
{
  "description": "2 engaging sentences highlighting quality and features",
  "suggestedTags": ["Tag1", "Tag2", "Tag3", "Tag4"],
  "prepTime": "e.g. 2 hours / 1 day / Ready to ship"
}`;

      const response = await generateGeminiContent({
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      if (response && response.text) {
        return res.json(JSON.parse(response.text.trim()));
      }
    }

    return res.json({
      description: `Quality ${productName || 'product'} made with care and attention to detail.`,
      suggestedTags: [category?.split(' ')[0] || 'Handmade', 'Fresh', 'Premium', 'Local'],
      prepTime: '2 - 4 hours'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Deterministic seller data analysis helper (live zero-hallucination calculations)
function computeSellerMetrics(products: any[] = [], orders: any[] = []) {
  // Exclude cancelled/rejected orders from revenue & sales
  const validOrders = orders.filter(o => o.status !== 'REJECTED' && o.status !== 'CANCELLED');
  const totalRevenue = validOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'PENDING_SELLER_APPROVAL' || o.status === 'CONFIRMED');
  const activeOrders = orders.filter(o => ['ACCEPTED', 'PREPARING', 'READY', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(o.status));
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');
  
  // Product sales breakdown
  const salesByProduct: Record<string, { name: string; quantity: number; revenue: number }> = {};
  validOrders.forEach(o => {
    (o.items || []).forEach((item: any) => {
      const pName = item.productName || 'Unknown Product';
      if (!salesByProduct[pName]) {
        salesByProduct[pName] = { name: pName, quantity: 0, revenue: 0 };
      }
      salesByProduct[pName].quantity += (Number(item.quantity) || 1);
      salesByProduct[pName].revenue += (Number(item.itemTotal) || (Number(item.unitPrice || 0) * Number(item.quantity || 1)));
    });
  });
  
  const sortedSales = Object.values(salesByProduct).sort((a, b) => b.quantity - a.quantity);
  const lowStock = products.filter(p => p.inStock && Number(p.stockQuantity) <= 5);
  const outOfStock = products.filter(p => !p.inStock || Number(p.stockQuantity) <= 0);
  const highestStock = [...products].sort((a, b) => (Number(b.stockQuantity) || 0) - (Number(a.stockQuantity) || 0))[0];

  // Customers
  const customerNames = Array.from(new Set(orders.map(o => o.buyerName).filter(Boolean)));
  const avgOrderValue = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;

  return {
    validOrders,
    totalRevenue,
    pendingOrders,
    activeOrders,
    deliveredOrders,
    sortedSales,
    lowStock,
    outOfStock,
    highestStock,
    customerNames,
    avgOrderValue,
  };
}

// Build compact, highly targeted context based strictly on what the seller's query requires
function buildRelevantSellerContext(
  userQuery: string,
  sellerProfile: any,
  products: any[] = [],
  orders: any[] = [],
  metrics: ReturnType<typeof computeSellerMetrics>
): string {
  const q = userQuery.toLowerCase();
  const sections: string[] = [];

  sections.push(
    `STORE: ${sellerProfile?.businessName || 'Store'} (${sellerProfile?.businessCategory || 'General'}, in ${sellerProfile?.location?.area || ''}, ${sellerProfile?.location?.city || 'India'})`
  );

  const isStock = q.includes('stock') || q.includes('restock') || q.includes('inventory') || q.includes('running out') || q.includes('unit');
  const isOrder = q.includes('order') || q.includes('pending') || q.includes('deliver') || q.includes('dispatch') || q.includes('today') || q.includes('status');
  const isSales = q.includes('sale') || q.includes('revenue') || q.includes('sold') || q.includes('income') || q.includes('money') || q.includes('best-selling') || q.includes('top product') || q.includes('top selling');
  const isProduct = q.includes('product') || q.includes('item') || q.includes('catalog') || q.includes('price') || q.includes('pricing') || q.includes('discount');
  const isCustomer = q.includes('customer') || q.includes('buyer') || q.includes('who bought');

  if (isStock || (!isOrder && !isSales && !isCustomer)) {
    sections.push(`PRODUCTS & INVENTORY (${products.length} total products listed):`);
    if (metrics.lowStock.length > 0) {
      sections.push(`- Low Stock Items (≤5 units): ${metrics.lowStock.map(p => `"${p.name}" (${p.stockQuantity} left, ₹${p.finalPrice})`).join('; ')}`);
    } else {
      sections.push(`- Low Stock Items: None (all active products have >5 units)`);
    }
    if (metrics.outOfStock.length > 0) {
      sections.push(`- Out of Stock Items (0 units): ${metrics.outOfStock.map(p => `"${p.name}"`).join('; ')}`);
    }
    if (metrics.highestStock) {
      sections.push(`- Highest Stock Item: "${metrics.highestStock.name}" (${metrics.highestStock.stockQuantity} units)`);
    }
    const sampleProducts = products.slice(0, 12).map(p => `${p.name} (₹${p.finalPrice}, Stock: ${p.stockQuantity})`).join(', ');
    sections.push(`- Catalog summary: ${sampleProducts}`);
  }

  if (isOrder || isSales || (!isStock && !isProduct)) {
    sections.push(`ORDERS SUMMARY (${orders.length} total orders):`);
    sections.push(`- Valid Orders: ${metrics.validOrders.length}`);
    sections.push(`- Pending Approval: ${metrics.pendingOrders.length}`);
    sections.push(`- Active / Preparing / Out for Delivery: ${metrics.activeOrders.length}`);
    sections.push(`- Delivered: ${metrics.deliveredOrders.length}`);

    if (orders.length > 0) {
      const recent = orders.slice(-6).map(o => `Order #${o.orderNumber || 'N/A'} (${o.status}, ₹${o.total}): ${(o.items || []).map((i: any) => `${i.productName} x${i.quantity}`).join(', ')}`);
      sections.push(`- Recent Orders: ${recent.join('; ')}`);
    }
  }

  if (isSales || (!isStock && !isOrder && !isProduct)) {
    sections.push(`SALES & REVENUE:`);
    sections.push(`- Total Recorded Revenue: ₹${metrics.totalRevenue}`);
    sections.push(`- Average Order Value: ₹${metrics.avgOrderValue}`);
    if (metrics.sortedSales.length > 0) {
      sections.push(`- Top Selling Products: ${metrics.sortedSales.slice(0, 5).map(s => `"${s.name}" (${s.quantity} units, ₹${s.revenue})`).join('; ')}`);
    } else {
      sections.push(`- Top Selling Products: No completed product sales recorded yet`);
    }
  }

  if (isCustomer) {
    sections.push(`CUSTOMERS:`);
    sections.push(`- Unique Customers Count: ${metrics.customerNames.length}`);
    if (metrics.customerNames.length > 0) {
      sections.push(`- Customer Names: ${metrics.customerNames.slice(0, 6).join(', ')}`);
    }
  }

  return sections.join('\n');
}

function getSuggestedQuestions(userQuery: string, metrics: ReturnType<typeof computeSellerMetrics>): string[] {
  const q = userQuery.toLowerCase();
  if (q.includes('stock') || q.includes('restock') || q.includes('inventory')) {
    return [
      'Which product has the highest stock?',
      'Show my total sales',
      'How can I improve my sales?'
    ];
  }
  if (q.includes('order') || q.includes('pending') || q.includes('deliver')) {
    return [
      'What products are low in stock?',
      'Which product is selling the most?',
      'What is my total sales?'
    ];
  }
  if (q.includes('sale') || q.includes('revenue') || q.includes('selling the most')) {
    return [
      'What products are low in stock?',
      'How many orders did I receive?',
      'Tips to get more customers'
    ];
  }
  return [
    'What products are low in stock?',
    'Which product is selling the most?',
    'Give me a summary of my store'
  ];
}

function computeDeterministicAnswer(
  userQuery: string,
  products: any[],
  orders: any[],
  metrics: ReturnType<typeof computeSellerMetrics>,
  sellerProfile: any
): string {
  const qLower = userQuery.toLowerCase();
  if (qLower.includes('low in stock') || qLower.includes('low stock') || qLower.includes('restock') || qLower.includes('running out')) {
    if (metrics.lowStock.length > 0) {
      return `You have ${metrics.lowStock.length} product(s) running low in stock (5 or fewer units remaining):\n` +
        metrics.lowStock.map(p => `• ${p.name}: ${p.stockQuantity} remaining (₹${p.finalPrice})`).join('\n') +
        `\n\nWe recommend restocking these soon to avoid missing incoming customer orders.`;
    } else if (metrics.outOfStock.length > 0) {
      return `None of your active products have ≤5 stock, but you have ${metrics.outOfStock.length} product(s) marked Out of Stock:\n` +
        metrics.outOfStock.map(p => `• ${p.name}`).join('\n');
    } else {
      return `All ${products.length} products in your store currently have healthy stock levels above 5 units. No urgent restocking is needed.`;
    }
  } else if (qLower.includes('highest stock') || qLower.includes('most stock')) {
    if (metrics.highestStock) {
      return `The product with the highest inventory in your store is "${metrics.highestStock.name}" with ${metrics.highestStock.stockQuantity} units in stock.`;
    } else {
      return `You do not have any products added to your store yet.`;
    }
  } else if (qLower.includes('selling the most') || qLower.includes('best-selling') || qLower.includes('top product') || qLower.includes('top 3')) {
    if (metrics.sortedSales.length === 0) {
      return `You don't have enough completed orders yet to identify a best-selling product. Once customers purchase from your store, your top-performing products will be tracked here.`;
    } else {
      const top3 = metrics.sortedSales.slice(0, 3);
      return `Here are your top-selling products based on customer orders:\n` +
        top3.map((s, idx) => `${idx + 1}. ${s.name} — ${s.quantity} units sold (₹${s.revenue})`).join('\n');
    }
  } else if (qLower.includes('how many order') || qLower.includes('order count') || qLower.includes('orders did i receive') || qLower.includes('show me today') || qLower.includes('orders are pending')) {
    return `Order summary for ${sellerProfile?.businessName || 'your store'}:\n` +
      `• Total orders received: ${orders.length}\n` +
      `• Pending approval: ${metrics.pendingOrders.length}\n` +
      `• In preparation / dispatched: ${metrics.activeOrders.length}\n` +
      `• Delivered & completed: ${metrics.deliveredOrders.length}`;
  } else if (qLower.includes('sale') || qLower.includes('revenue') || qLower.includes('income') || qLower.includes('how much revenue')) {
    let reply = `Your total sales revenue is ₹${metrics.totalRevenue.toLocaleString()} across ${metrics.validOrders.length} confirmed orders.`;
    if (metrics.avgOrderValue > 0) {
      reply += ` Your average order value is ₹${metrics.avgOrderValue}.`;
    }
    return reply;
  } else if (qLower.includes('customer') || qLower.includes('bought from me')) {
    if (metrics.customerNames.length === 0) {
      return `No customer orders have been recorded yet. Share your store link with local buyers to receive your first order!`;
    } else {
      return `You have served ${metrics.customerNames.length} unique customer(s). Recent customers include: ${metrics.customerNames.slice(0, 5).join(', ')}.`;
    }
  } else if (qLower.includes('summary') || qLower.includes('give me a summary')) {
    return `Store Summary for ${sellerProfile?.businessName || 'Your Store'}:\n` +
      `• Products cataloged: ${products.length}\n` +
      `• Total orders: ${orders.length} (₹${metrics.totalRevenue.toLocaleString()} revenue)\n` +
      `• Low stock items: ${metrics.lowStock.length}\n` +
      `• Pending orders to accept: ${metrics.pendingOrders.length}`;
  } else if (qLower.includes('how should i price') || qLower.includes('pricing')) {
    return `General Pricing Advice for Local Stores:\n` +
      `1. Cost-Plus: Calculate raw ingredients/materials + labor + packaging, then add a 30-50% markup.\n` +
      `2. Competitor Check: Compare with nearby local shops for similar items in your city.\n` +
      `3. Bundles: Offer combo packs or volume discounts (e.g. Buy 2 get 10% off) to increase average order value.\n\n` +
      `(Note: This is general business advice; store records do not track your cost of goods.)`;
  } else if (qLower.includes('improve my sales') || qLower.includes('more customers') || qLower.includes('promote')) {
    return `Tips to Increase Store Sales:\n` +
      `1. Keep stock counts updated and add clear, bright product photos.\n` +
      `2. Enable free delivery above a reasonable cart value (e.g. ₹${sellerProfile?.deliveryOptions?.freeDeliveryAbove || 500}) to encourage bigger orders.\n` +
      `3. Quickly accept pending orders — fast response times build customer loyalty in your local neighborhood.\n` +
      `4. Share your public store link on WhatsApp groups and local community channels.`;
  } else {
    return `I am your Seller AI Assistant for ${sellerProfile?.businessName || 'your store'}. ` +
      `You currently have ${products.length} products and ${orders.length} total orders recorded in your store database. ` +
      `Feel free to ask about your stock levels, best-selling items, pending orders, revenue, or tips to improve sales!`;
  }
}

// AI Seller Assistant Streaming Endpoint (Server-Sent Events)
app.post('/api/ai/seller-assistant/stream', async (req, res) => {
  try {
    const { userQuery, sellerProfile, products = [], orders = [], history = [] } = req.body;

    if (!userQuery || typeof userQuery !== 'string') {
      return res.status(400).json({ error: 'userQuery is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const metrics = computeSellerMetrics(products, orders);
    const relevantContext = buildRelevantSellerContext(userQuery, sellerProfile, products, orders, metrics);
    const suggestedQuestions = getSuggestedQuestions(userQuery, metrics);

    if (aiClient) {
      try {
        const prompt = `You are the "Seller AI Assistant" for LocalCart, an e-commerce platform for local neighborhood shops and sellers.
You are directly advising the authenticated store owner of "${sellerProfile?.businessName || 'Your Shop'}" (${sellerProfile?.businessCategory || 'Store'}, located in ${sellerProfile?.location?.area || ''}, ${sellerProfile?.location?.city || 'India'}).

Store Owner Question: "${userQuery}"

RECENT CONVERSATION:
${JSON.stringify(history.slice(-3), null, 2)}

RELEVANT STORE DATA (Pre-filtered for this question):
${relevantContext}

OPERATIONAL RULES:
1. STRICT LIVE DATA GROUNDING: Answer questions about stock, products, orders, or sales strictly from the store records above. Never invent facts or numbers.
2. If data doesn't exist, say clearly: "That information is not recorded in your store data."
3. For general business questions, offer practical advice tailored to local shops in India.
4. SIMPLE VOCABULARY: Use simple everyday words (Store, Products, Stock, Orders, Customers, Sales). Never use pretentious jargon.
5. Provide a direct, helpful, natural language response with clean formatting and bullet points where useful. Do NOT output JSON.`;

        const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
        let streamSuccess = false;

        for (const model of models) {
          try {
            const stream = await aiClient.models.generateContentStream({
              model,
              contents: prompt,
            });

            for await (const chunk of stream) {
              if (chunk.text) {
                sendEvent({ chunk: chunk.text });
                streamSuccess = true;
              }
            }

            if (streamSuccess) {
              sendEvent({ done: true, suggestedQuestions });
              res.end();
              return;
            }
          } catch (streamErr: any) {
            console.info(`Streaming with ${model} failed, trying alternative:`, streamErr?.message || streamErr);
          }
        }
      } catch (err: any) {
        console.info('Seller AI Assistant streaming fallback to deterministic:', err?.message || err);
      }
    }

    // Deterministic stream fallback
    const fallbackAnswer = computeDeterministicAnswer(userQuery, products, orders, metrics, sellerProfile);
    const words = fallbackAnswer.split(' ');
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
      sendEvent({ chunk });
      await new Promise(r => setTimeout(r, 20));
    }
    sendEvent({ done: true, suggestedQuestions });
    res.end();
  } catch (err: any) {
    console.error('Stream endpoint fatal error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message || 'Stream error' })}\n\n`);
      res.end();
    }
  }
});

// AI Seller Assistant Endpoint (Standard Fast JSON Endpoint Grounded strictly in seller's live Firestore store data)
app.post('/api/ai/seller-assistant', async (req, res) => {
  try {
    const { userQuery, sellerProfile, products = [], orders = [], history = [] } = req.body;

    if (!userQuery || typeof userQuery !== 'string') {
      return res.status(400).json({ error: 'userQuery is required' });
    }

    const metrics = computeSellerMetrics(products, orders);
    const relevantContext = buildRelevantSellerContext(userQuery, sellerProfile, products, orders, metrics);
    const suggestedQuestions = getSuggestedQuestions(userQuery, metrics);

    if (aiClient) {
      try {
        const prompt = `You are the "Seller AI Assistant" for LocalCart, an e-commerce platform for local neighborhood shops and sellers.
You are directly advising the authenticated store owner of "${sellerProfile?.businessName || 'Your Shop'}" (${sellerProfile?.businessCategory || 'Store'}, located in ${sellerProfile?.location?.area || ''}, ${sellerProfile?.location?.city || 'India'}).

Store Owner Question: "${userQuery}"

RECENT CONVERSATION:
${JSON.stringify(history.slice(-3), null, 2)}

RELEVANT STORE DATA (Pre-filtered for this question):
${relevantContext}

OPERATIONAL RULES:
1. STRICT LIVE DATA GROUNDING: Answer strictly from the provided live store data. Never invent numbers, products, or orders.
2. If data doesn't exist, clearly state: "That information is not recorded in your store data."
3. For general business questions, give helpful, practical advice tailored to local shops in India.
4. SIMPLE VOCABULARY: Plain everyday terms only.
5. OUTPUT FORMAT:
Return valid JSON with:
{
  "message": "Clear natural language answer. Use bullet points or short clear paragraphs.",
  "suggestedQuestions": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;

        const response = await generateGeminiContent({
          contents: prompt,
          config: { responseMimeType: 'application/json' }
        });

        if (response && response.text) {
          const parsed = JSON.parse(response.text.trim());
          return res.json({
            message: parsed.message,
            suggestedQuestions: Array.isArray(parsed.suggestedQuestions) && parsed.suggestedQuestions.length > 0
              ? parsed.suggestedQuestions
              : suggestedQuestions
          });
        }
      } catch (geminiErr: any) {
        console.info('Seller AI Assistant using grounded live calculation engine:', geminiErr?.message || geminiErr);
      }
    }

    const reply = computeDeterministicAnswer(userQuery, products, orders, metrics, sellerProfile);
    return res.json({ message: reply, suggestedQuestions });
  } catch (err: any) {
    console.error('Seller AI Assistant error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate assistant response' });
  }
});

// Mount Vite in development or serve static in production
async function setupViteMiddleware() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LocalCart AI Server running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.VERCEL !== '1') {
  setupViteMiddleware();
}

export default app;
