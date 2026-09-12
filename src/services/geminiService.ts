import { Product, SellerProfile, Order } from '../types';
import { analyzeBuyerQuery, GroundedBuyerContext, isCasualGreeting } from './aiDatabaseMatcher';

export interface BuyerAISearchResult {
  message: string;
  matchedProductIds: string[];
  suggestedCategories: string[];
  maxPriceDetected?: number;
}

export interface SellerOnboardingExtraction {
  businessNameSuggestion: string;
  businessCategory: string;
  tagline: string;
  businessDescription: string;
  extractedProducts: string[];
  tags: string[];
}

export interface SellerInsightsAI {
  topHeadline: string;
  insights: {
    type: 'positive' | 'warning' | 'info' | 'opportunity';
    title: string;
    description: string;
    actionableTip?: string;
  }[];
}

/**
 * AI Natural Language Search for Buyers
 * Strictly grounded in the LIVE Firestore database records (Zero Hallucination).
 */
export async function searchProductsWithAI(
  userQuery: string,
  allProducts: Product[],
  allSellers: SellerProfile[],
  userLocation: { city: string; area?: string } = { city: 'Hyderabad' },
  buyerOrders: Order[] = []
): Promise<BuyerAISearchResult> {
  if (!userQuery.trim()) {
    return {
      message: 'Please specify what creation or workshop you are seeking.',
      matchedProductIds: [],
      suggestedCategories: []
    };
  }

  // 1. Analyze user's intent & query the CURRENT live database records
  const context: GroundedBuyerContext = analyzeBuyerQuery(
    userQuery,
    allProducts,
    allSellers,
    buyerOrders,
    userLocation
  );

  // For casual conversation (Hi, Hello, Thanks, etc.), return natural greeting immediately
  if (context.intent === 'CASUAL') {
    return {
      message: context.summaryFact,
      matchedProductIds: [],
      suggestedCategories: ['Bakery & Desserts', 'Handmade Jewellery', 'Boutique & Fashion'],
    };
  }

  let aiMessage = context.summaryFact;
  let suggestedCategories = context.filtersApplied.category ? [context.filtersApplied.category] : [];
  let quickReplies: string[] = [];

  // 2. Call server-side Gemini API with live retrieved database records
  try {
    const res = await fetch('/api/ai/concierge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userQuery,
        context,
        userLocation
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.message) {
        aiMessage = data.message;
      }
      if (Array.isArray(data.suggestedCategories) && data.suggestedCategories.length > 0) {
        suggestedCategories = data.suggestedCategories;
      }
      if (Array.isArray(data.quickReplies) && data.quickReplies.length > 0) {
        quickReplies = data.quickReplies;
      }
    }
  } catch (err) {
    // Network/API fallback: summaryFact is already perfectly grounded in the live records
    console.debug('Using grounded deterministic fact synthesis:', err);
  }

  // Extract matching product IDs
  const matchedIds = context.matchedProducts.map(p => p.id);

  return {
    message: aiMessage,
    matchedProductIds: matchedIds,
    suggestedCategories: suggestedCategories.length > 0 ? suggestedCategories : (context.matchedProducts.map(p => p.category)),
    maxPriceDetected: context.filtersApplied.maxPrice
  };
}

/**
 * Convenient concierge wrapper returning resolved Product objects
 */
export async function aiSearchConcierge(
  userQuery: string,
  allProducts: Product[],
  allSellers: SellerProfile[],
  userLocation: { city: string; area?: string },
  buyerOrders: Order[] = []
): Promise<{ message: string; matchedProducts: Product[]; suggestions: string[] }> {
  const result = await searchProductsWithAI(userQuery, allProducts, allSellers, userLocation, buyerOrders);
  
  // Resolve actual product objects matching the IDs
  const matched = allProducts.filter(p => result.matchedProductIds.includes(p.id));

  // Determine dynamic suggestions based on real categories in current catalog
  const uniqueCategories = Array.from(new Set(allProducts.map(p => p.category))).slice(0, 3);
  const defaultSuggestions = uniqueCategories.map(c => `Show ${c}`);

  return {
    message: result.message,
    matchedProducts: matched,
    suggestions: result.suggestedCategories.length > 0
      ? result.suggestedCategories.map(c => `Show ${c}`)
      : defaultSuggestions
  };
}

/**
 * AI Onboarding Extractor for Sellers
 */
export async function extractSellerOnboardingInfo(
  productsText: string,
  businessTypeText: string
): Promise<SellerOnboardingExtraction> {
  try {
    const res = await fetch('/api/ai/seller-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productsText, businessTypeText })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('Seller onboarding API fallback:', err);
  }

  // Fallback extraction
  const lower = `${productsText} ${businessTypeText}`.toLowerCase();
  let category = 'Gifts & Handcrafted Studio';
  if (lower.includes('cake') || lower.includes('bake') || lower.includes('brownie') || lower.includes('cookie') || lower.includes('pastry') || lower.includes('choko')) {
    category = 'Bakery & Desserts';
  } else if (lower.includes('jewel') || lower.includes('earring') || lower.includes('bracelet') || lower.includes('pearl') || lower.includes('necklace')) {
    category = 'Handmade Jewellery';
  } else if (lower.includes('dress') || lower.includes('kurti') || lower.includes('saree') || lower.includes('cloth') || lower.includes('boutique')) {
    category = 'Boutique & Fashion';
  } else if (lower.includes('candle') || lower.includes('decor') || lower.includes('pottery') || lower.includes('frame')) {
    category = 'Home Decor & Art';
  } else if (lower.includes('organic') || lower.includes('pickle') || lower.includes('oil') || lower.includes('spice')) {
    category = 'Organic & Gourmet Snacks';
  }

  const items = productsText
    .split(/[,&;.\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  return {
    businessNameSuggestion: businessTypeText ? `${businessTypeText.split(' ')[0]} Studio` : 'My Local Store',
    businessCategory: category,
    tagline: `Fresh, handcrafted & authentic local creations crafted with care`,
    businessDescription: `We create high-quality ${productsText || 'handcrafted goods'} for local customers with personalized service and care.`,
    extractedProducts: items.length > 0 ? items : ['Custom Item 1', 'Custom Item 2'],
    tags: ['Handmade', 'Local Business', 'Custom Orders']
  };
}

/**
 * Generate AI Business Insights for Seller Dashboard based on REAL database records
 */
export function generateSellerInsightsFromData(
  seller: SellerProfile,
  products: Product[],
  orders: Order[]
): SellerInsightsAI {
  const sellerProducts = products.filter(p => p.sellerId === seller.id);
  const sellerOrders = orders.filter(o => o.sellerId === seller.id);

  const pendingOrders = sellerOrders.filter(o => o.status === 'PENDING_SELLER_APPROVAL');
  const activeOrders = sellerOrders.filter(o => ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(o.status));
  const lowStockProducts = sellerProducts.filter(
    p => p.inStock && p.stockQuantity > 0 && p.stockQuantity <= (typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 5)
  );
  const outOfStockProducts = sellerProducts.filter(p => !p.inStock || p.stockQuantity === 0);

  // Calculate top sold product
  const productCountMap: { [name: string]: number } = {};
  sellerOrders.forEach(o => {
    if (o.status !== 'REJECTED' && o.status !== 'CANCELLED') {
      o.items.forEach(item => {
        productCountMap[item.productName] = (productCountMap[item.productName] || 0) + item.quantity;
      });
    }
  });

  const sortedProducts = Object.entries(productCountMap).sort((a, b) => b[1] - a[1]);
  const topProduct = sortedProducts[0];

  const insights: SellerInsightsAI['insights'] = [];

  // Insight 1: Pending Orders
  if (pendingOrders.length > 0) {
    insights.push({
      type: 'warning',
      title: `${pendingOrders.length} New Order Request${pendingOrders.length > 1 ? 's' : ''} Awaiting Response`,
      description: `Fast order response within 30 minutes increases buyer re-order rates by over 40%.`,
      actionableTip: 'Review and accept pending requests in your Orders tab.'
    });
  }

  // Insight 2: Top Selling Product
  if (topProduct && topProduct[1] > 0) {
    insights.push({
      type: 'positive',
      title: `"${topProduct[0]}" is your bestseller`,
      description: `Customers have ordered ${topProduct[1]} units. It is your most popular item this season.`,
      actionableTip: 'Ensure you maintain adequate ingredients/stock for this high-demand item.'
    });
  }

  // Insight 3: Low Stock Alerts
  if (lowStockProducts.length > 0) {
    insights.push({
      type: 'opportunity',
      title: `${lowStockProducts.length} Product${lowStockProducts.length > 1 ? 's have' : ' has'} low stock (≤ 5 units)`,
      description: `Products running low: ${lowStockProducts.map(p => p.name).slice(0, 2).join(', ')}.`,
      actionableTip: 'Restock or update inventory to avoid losing potential buyer orders.'
    });
  }

  if (outOfStockProducts.length > 0) {
    insights.push({
      type: 'warning',
      title: `${outOfStockProducts.length} Product${outOfStockProducts.length > 1 ? 's are' : ' is'} out of stock`,
      description: `Unavailable items: ${outOfStockProducts.map(p => p.name).slice(0, 2).join(', ')}.`,
      actionableTip: 'Replenish inventory to reactivate them for buyers.'
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'info',
      title: 'Storefront Live & Ready',
      description: `Your store is active for neighborhood buyers in ${seller.location.city}.`,
      actionableTip: 'Share your store link with local customers to receive orders.'
    });
  }

  return {
    topHeadline: pendingOrders.length > 0 
      ? `Action required: ${pendingOrders.length} pending order request waiting.`
      : `Your store is active and ready for neighborhood customers in ${seller.location.city}.`,
    insights
  };
}

/**
 * AI Product Description Generator for Sellers
 */
export async function generateProductDescriptionAI(
  productName: string,
  category: string,
  keyFeatures: string
): Promise<{ description: string; suggestedTags: string[]; prepTime: string }> {
  try {
    const res = await fetch('/api/ai/product-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName, category, keyFeatures })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('Product description API fallback:', err);
  }

  return {
    description: `High quality ${productName.toLowerCase()} made with care and attention to detail.`,
    suggestedTags: [category.split(' ')[0] || 'Handmade', 'Fresh', 'Premium'],
    prepTime: '2 - 4 hours'
  };
}

/**
 * Seller AI Assistant with real-time SSE streaming
 */
export async function askSellerAIAssistantStream(params: {
  userQuery: string;
  sellerProfile: SellerProfile;
  products: Product[];
  orders: Order[];
  currentUserUid: string;
  history?: Array<{ role: 'ai' | 'user'; text: string }>;
  onChunk: (text: string) => void;
  onDone?: (suggestedQuestions: string[]) => void;
}): Promise<void> {
  const { userQuery, sellerProfile, products, orders, history = [], onChunk, onDone } = params;

  // For casual conversation (Hi, Hello, Thanks, etc.), reply naturally and instantly
  const casual = isCasualGreeting(userQuery);
  if (casual.isCasual) {
    let reply = "Hi! How can I help with your store today?";
    if (casual.type === 'thanks') reply = "You're welcome! Let me know if you need anything for your store.";
    if (casual.type === 'pleasantry') reply = "I'm doing well, thank you! How can I help you manage your store today?";
    onChunk(reply);
    if (onDone) {
      onDone(['What products are low in stock?', 'What products do I have?', 'How many orders do I have?']);
    }
    return;
  }

  try {
    const res = await fetch('/api/ai/seller-assistant/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userQuery,
        sellerProfile,
        products,
        orders,
        history,
      }),
    });

    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulated = '';
      let suggestions: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const payload = JSON.parse(trimmed.slice(6));
              if (payload.chunk) {
                accumulated += payload.chunk;
                onChunk(accumulated);
              }
              if (payload.done) {
                if (Array.isArray(payload.suggestedQuestions)) {
                  suggestions = payload.suggestedQuestions;
                }
              }
            } catch (e) {}
          }
        }
      }

      if (accumulated.trim().length > 0) {
        if (onDone) onDone(suggestions);
        return;
      }
    }
  } catch (streamErr) {
    console.warn('Streaming error, falling back to non-streaming:', streamErr);
  }

  // Fallback to non-streaming endpoint or local calculation
  const fallbackResult = await askSellerAIAssistant({
    userQuery,
    sellerProfile,
    products,
    orders,
    currentUserUid: params.currentUserUid,
    history,
  });

  onChunk(fallbackResult.message);
  if (onDone) {
    onDone(fallbackResult.suggestedQuestions || []);
  }
}

/**
 * Seller AI Assistant (Natural language queries grounded in live Firestore store data)
 */
export async function askSellerAIAssistant(params: {
  userQuery: string;
  sellerProfile: SellerProfile;
  products: Product[];
  orders: Order[];
  currentUserUid: string;
  history?: Array<{ role: 'ai' | 'user'; text: string }>;
}): Promise<{ message: string; suggestedQuestions?: string[] }> {
  const { userQuery, sellerProfile, products, orders, history = [] } = params;

  try {
    const res = await fetch('/api/ai/seller-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userQuery,
        sellerProfile,
        products,
        orders,
        history,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.message) {
        return {
          message: data.message,
          suggestedQuestions: data.suggestedQuestions || [],
        };
      }
    }
  } catch (err) {
    console.warn('Network error calling /api/ai/seller-assistant, calculating locally:', err);
  }

  // Fallback client-side calculation using exact live Firestore data
  const validOrders = orders.filter(o => o.status !== 'REJECTED' && o.status !== 'CANCELLED');
  const totalRevenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'PENDING_SELLER_APPROVAL' || o.status === 'CONFIRMED');
  const activeOrders = orders.filter(o => ['ACCEPTED', 'PREPARING', 'READY', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(o.status));
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');
  const lowStock = products.filter(p => p.inStock && p.stockQuantity <= 5);
  const outOfStock = products.filter(p => !p.inStock || p.stockQuantity === 0);

  const productSalesMap: Record<string, { quantity: number; revenue: number }> = {};
  validOrders.forEach(o => {
    (o.items || []).forEach(i => {
      if (!productSalesMap[i.productName]) {
        productSalesMap[i.productName] = { quantity: 0, revenue: 0 };
      }
      productSalesMap[i.productName].quantity += (i.quantity || 1);
      productSalesMap[i.productName].revenue += (i.itemTotal || ((i.unitPrice || 0) * (i.quantity || 1)));
    });
  });
  const topSales = Object.entries(productSalesMap).sort((a, b) => b[1].quantity - a[1].quantity);
  const qLower = userQuery.toLowerCase();

  const casual = isCasualGreeting(userQuery);
  if (casual.isCasual) {
    if (casual.type === 'greeting') {
      return {
        message: `Hello! I am your LocalCart Seller Assistant. How can I help you manage ${sellerProfile.businessName || 'your store'} today?`,
        suggestedQuestions: ['What products do I have?', 'What products are low in stock?', 'How many orders do I have?'],
      };
    }
    if (casual.type === 'thanks') {
      return {
        message: `You're welcome! Let me know if you need anything else to manage ${sellerProfile.businessName || 'your store'}.`,
        suggestedQuestions: ['What products do I have?', 'What products are low in stock?'],
      };
    }
    return {
      message: `I'm here to help you manage ${sellerProfile.businessName || 'your store'}. You can ask about your products, inventory levels, orders, or sales performance.`,
      suggestedQuestions: ['What products do I have?', 'What products are low in stock?', 'How many orders do I have?'],
    };
  }

  let message = '';
  if (qLower.includes('low in stock') || qLower.includes('low stock') || qLower.includes('restock') || qLower.includes('running out')) {
    if (lowStock.length > 0) {
      message = `You have ${lowStock.length} product(s) with low stock (5 or fewer units remaining):\n` +
        lowStock.map(p => `• ${p.name}: ${p.stockQuantity} in stock (₹${p.finalPrice})`).join('\n') +
        `\n\nRestock soon to ensure uninterrupted sales.`;
    } else {
      message = `All ${products.length} products in your store have healthy stock levels above 5 units.`;
    }
  } else if (qLower.includes('what product') || qLower.includes('my product') || qLower.includes('which product') || qLower.includes('list product') || qLower === 'products' || qLower === 'all products') {
    if (products.length === 0) {
      message = `You currently have no products listed in ${sellerProfile.businessName}. You can add new products from your inventory dashboard.`;
    } else {
      message = `Here are the products currently listed in ${sellerProfile.businessName} (${products.length} total):\n` +
        products.map(p => `• ${p.name}: ₹${p.finalPrice} (${p.stockQuantity} in stock${p.inStock ? '' : ' - Out of Stock'})`).join('\n');
    }
  } else if (qLower.includes('selling the most') || qLower.includes('best-selling') || qLower.includes('top product')) {
    if (topSales.length === 0) {
      message = `You don't have enough completed orders yet to identify a best-selling product.`;
    } else {
      const best = topSales[0];
      message = `Your best-selling product is "${best[0]}" with ${best[1].quantity} units ordered (₹${best[1].revenue} in sales).`;
    }
  } else if (qLower.includes('how many order') || qLower.includes('orders did i receive') || qLower.includes('today') || qLower.includes('order count')) {
    message = `Order summary for ${sellerProfile.businessName}:\n• Total orders: ${orders.length}\n• Pending approval: ${pendingOrders.length}\n• In progress: ${activeOrders.length}\n• Completed: ${deliveredOrders.length}`;
  } else if (qLower.includes('revenue') || qLower.includes('sales') || qLower.includes('income')) {
    message = `Your total sales revenue is ₹${totalRevenue.toLocaleString()} across ${validOrders.length} orders.`;
  } else {
    message = `I'm your LocalCart Assistant for ${sellerProfile.businessName}. You currently have ${products.length} products listed and ${orders.length} orders recorded. Ask me about your products, stock levels, orders, or sales revenue.`;
  }

  return {
    message,
    suggestedQuestions: ['What products do I have?', 'What products are low in stock?', 'How many orders do I have?'],
  };
}

