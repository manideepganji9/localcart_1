// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// server/firebaseAdmin.ts
import crypto from "node:crypto";
var adminApp = null;
var publicKeysCache = null;
var publicKeysExpires = 0;
async function getGooglePublicKeys() {
  if (publicKeysCache && Date.now() < publicKeysExpires) {
    return publicKeysCache;
  }
  const res = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
  publicKeysExpires = Date.now() + maxAgeSec * 1e3;
  publicKeysCache = await res.json();
  return publicKeysCache;
}
async function verifyFirebaseIdTokenCrypto(idToken, projectId = process.env.FIREBASE_PROJECT_ID || "my-localcart") {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Missing ID token");
  }
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Malformed JWT header or payload");
  }
  if (header.alg !== "RS256") {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }
  const kid = header.kid;
  if (!kid) {
    throw new Error("Missing kid in JWT header");
  }
  let publicKeys = await getGooglePublicKeys();
  if (!publicKeys[kid]) {
    publicKeysCache = null;
    publicKeysExpires = 0;
    publicKeys = await getGooglePublicKeys();
  }
  const cert = publicKeys[kid];
  if (!cert) {
    throw new Error(`Public key not found for kid: ${kid}`);
  }
  const dataToVerify = `${parts[0]}.${parts[1]}`;
  const signature = Buffer.from(parts[2], "base64url");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(dataToVerify);
  const isValid = verifier.verify(cert, signature);
  if (!isValid) {
    throw new Error("Firebase ID token signature verification failed");
  }
  const now = Math.floor(Date.now() / 1e3);
  if (payload.exp <= now) {
    throw new Error("Firebase ID token has expired");
  }
  if (payload.iat > now + 300) {
    throw new Error("Firebase ID token issued in the future");
  }
  const tokenAud = typeof payload.aud === "string" ? payload.aud : "";
  const effectiveProjectId = projectId || tokenAud;
  if (effectiveProjectId && tokenAud && tokenAud !== effectiveProjectId) {
    throw new Error(`Invalid audience: expected ${effectiveProjectId}, got ${tokenAud}`);
  }
  if (effectiveProjectId && payload.iss !== `https://securetoken.google.com/${effectiveProjectId}`) {
    throw new Error(`Invalid issuer: got ${payload.iss}`);
  }
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Invalid or missing sub claim");
  }
  return {
    ...payload,
    uid: payload.sub
  };
}
async function getFirebaseAdminApp() {
  if (adminApp) {
    return adminApp;
  }
  const { initializeApp, getApps, cert, applicationDefault } = await import("firebase-admin/app");
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    adminApp = existingApps[0];
    return adminApp;
  }
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT || "";
  let credential;
  if (serviceAccountRaw) {
    try {
      let parsed;
      const trimmed = serviceAccountRaw.trim();
      if (trimmed.startsWith("{")) {
        parsed = JSON.parse(trimmed);
      } else {
        const decoded = Buffer.from(trimmed, "base64").toString("utf8");
        parsed = JSON.parse(decoded);
      }
      credential = cert(parsed);
    } catch (err) {
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_KEY format: ${err.message}`);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      credential = applicationDefault();
    } catch (err) {
      console.warn("Could not load applicationDefault credentials:", err?.message);
    }
  } else {
    const projectId2 = process.env.FIREBASE_PROJECT_ID || "my-localcart";
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (clientEmail && privateKey) {
      credential = cert({
        projectId: projectId2,
        clientEmail,
        privateKey
      });
    } else {
      try {
        credential = applicationDefault();
      } catch (err) {
      }
    }
  }
  if (!credential) {
    throw new Error(
      "Server-side Firebase Admin credentials are not configured. Please provide FIREBASE_SERVICE_ACCOUNT_KEY in your server environment variables, or ensure Google Application Default Credentials are configured."
    );
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || "my-localcart";
  adminApp = initializeApp({
    credential,
    projectId
  });
  return adminApp;
}
async function getAdminFirestore() {
  const app2 = await getFirebaseAdminApp();
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore(app2);
}
async function verifyAuthToken(idToken) {
  const projectId = process.env.FIREBASE_PROJECT_ID || "my-localcart";
  try {
    return await verifyFirebaseIdTokenCrypto(idToken, projectId);
  } catch (cryptoErr) {
    try {
      const app2 = await getFirebaseAdminApp();
      const { getAuth } = await import("firebase-admin/auth");
      return await getAuth(app2).verifyIdToken(idToken);
    } catch {
      throw cryptoErr;
    }
  }
}

// server.ts
dotenv.config();
var currentDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
var app = express();
var PORT = 3e3;
app.use(express.json({ limit: "10mb" }));
app.use((req, res, next) => {
  if (req.url === "/api" || req.url === "/" || req.url.startsWith("/api?")) {
    const matchedPath = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"];
    if (matchedPath && matchedPath !== "/api" && matchedPath !== "/") {
      req.url = matchedPath;
    } else {
      const matches = req.headers["x-now-route-matches"];
      if (matches) {
        const match = matches.match(/(?:^|&)1=([^&]+)/);
        if (match && match[1]) {
          const sub = decodeURIComponent(match[1]);
          req.url = sub.startsWith("/") ? `/api${sub}` : `/api/${sub}`;
        }
      }
    }
  }
  next();
});
var apiKey = process.env.GEMINI_API_KEY || "";
var aiClient = null;
if (apiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (err) {
    console.warn("Failed to initialize server-side GoogleGenAI:", err);
  }
}
var GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
async function generateGeminiContent(options) {
  if (!aiClient) return null;
  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    try {
      const response = await aiClient.models.generateContent({
        model,
        contents: options.contents,
        config: options.config
      });
      if (response && response.text) {
        return response;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) {
    console.info("Gemini models unavailable, falling back to deterministic processing:", lastErr?.message || lastErr);
  }
  throw lastErr || new Error("All supported Gemini models failed");
}
function isCasualGreeting(query) {
  if (!query || typeof query !== "string") return { isCasual: false, type: "none" };
  const q = query.trim().toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(hi|hello|hey|heya|howdy|sup|greetings|good\s+(morning|afternoon|evening|day))(\s+there|\s+localcart|\s+assistant)?$/i.test(q)) {
    return { isCasual: true, type: "greeting" };
  }
  if (/^(thanks|thank\s+you|thx|many\s+thanks|thank\s+you\s+so\s+much)$/i.test(q)) {
    return { isCasual: true, type: "thanks" };
  }
  if (/^(how\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do|what\s+is\s+this|help|good\s+to\s+see\s+you)$/i.test(q)) {
    return { isCasual: true, type: "pleasantry" };
  }
  return { isCasual: false, type: "none" };
}
var apiRouter = express.Router();
apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok", hasGeminiKey: Boolean(apiKey) });
});
apiRouter.get("/", (req, res) => {
  res.json({ status: "ok", hasGeminiKey: Boolean(apiKey) });
});
apiRouter.post("/orders/checkout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
    if (!idToken) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing Firebase authentication token." });
    }
    let decodedToken;
    try {
      decodedToken = await verifyAuthToken(idToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid Firebase authentication session.",
        details: err.message
      });
    }
    const buyerUid = decodedToken.uid;
    const idempotencyKey = req.headers["idempotency-key"] || req.body.idempotencyKey;
    const {
      sellerId,
      items,
      buyerName,
      buyerPhone,
      buyerLocation,
      customerNotes
    } = req.body;
    if (!sellerId || typeof sellerId !== "string") {
      return res.status(400).json({ success: false, error: "Invalid sellerId provided." });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: "Order must contain at least one product item." });
    }
    for (const item of items) {
      if (!item.productId || typeof item.productId !== "string") {
        return res.status(400).json({ success: false, error: "Invalid productId specified." });
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          error: `Quantity must be a positive integer for product "${item.productId}".`
        });
      }
    }
    const db = await getAdminFirestore();
    const orderResult = await db.runTransaction(async (transaction) => {
      let orderId = `order-${Date.now()}`;
      if (idempotencyKey && typeof idempotencyKey === "string") {
        const cleanKey = idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
        if (cleanKey) {
          orderId = cleanKey.startsWith("order-") ? cleanKey : `order-${cleanKey}`;
        }
      }
      const orderRef = db.collection("orders").doc(orderId);
      const existingOrderSnap = await transaction.get(orderRef);
      if (existingOrderSnap.exists) {
        return existingOrderSnap.data();
      }
      const sellerRef = db.collection("sellerProfiles").doc(sellerId);
      const sellerSnap = await transaction.get(sellerRef);
      if (!sellerSnap.exists) {
        throw new Error("Seller store not found.");
      }
      const sellerData = sellerSnap.data() || {};
      if (sellerData.userId === buyerUid) {
        throw new Error("Sellers cannot purchase products from their own storefront. Please use a buyer account.");
      }
      const productUpdates = [];
      const itemSnapshots = [];
      let subtotal = 0;
      let originalSubtotal = 0;
      for (const item of items) {
        const prodRef = db.collection("products").doc(item.productId);
        const prodSnap = await transaction.get(prodRef);
        if (!prodSnap.exists) {
          throw new Error(`Product "${item.productId}" was not found.`);
        }
        const prod = prodSnap.data() || {};
        if (prod.sellerId !== sellerId && prod.sellerId !== sellerData.id && prod.sellerId !== sellerData.userId) {
          throw new Error(`Product "${prod.name || item.productId}" does not belong to this store.`);
        }
        const currentStock = typeof prod.stockQuantity === "number" ? prod.stockQuantity : 0;
        if (currentStock < item.quantity) {
          throw new Error(
            `Insufficient stock for "${prod.name || "product"}". Available: ${currentStock}, requested: ${item.quantity}.`
          );
        }
        const originalPrice = typeof prod.originalPrice === "number" ? prod.originalPrice : 0;
        const discountPercent = typeof prod.discountPercent === "number" ? prod.discountPercent : 0;
        const finalPrice = typeof prod.finalPrice === "number" ? prod.finalPrice : Math.round(originalPrice * (1 - discountPercent / 100));
        const itemTotal = finalPrice * item.quantity;
        subtotal += itemTotal;
        originalSubtotal += originalPrice * item.quantity;
        const newStock = Math.max(0, currentStock - item.quantity);
        const inStock = newStock > 0;
        productUpdates.push({
          ref: prodRef,
          newStock,
          inStock
        });
        itemSnapshots.push({
          productId: prodSnap.id,
          productName: prod.name || "Product",
          productImage: prod.imageUrl || "",
          category: prod.category || "General",
          originalPrice,
          discountPercent,
          unitPrice: finalPrice,
          quantity: item.quantity,
          itemTotal
        });
      }
      const discountTotal = originalSubtotal - subtotal;
      const freeDeliveryAbove = sellerData.deliveryOptions?.freeDeliveryAbove ?? 1500;
      const baseDeliveryFee = sellerData.deliveryOptions?.baseDeliveryFee ?? 50;
      const deliveryFee = subtotal >= freeDeliveryAbove ? 0 : baseDeliveryFee;
      const total = subtotal + deliveryFee;
      const orderNumber = `LC-${Math.floor(1e3 + Math.random() * 9e3)}`;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const newOrder = {
        id: orderId,
        orderNumber,
        buyerId: buyerUid,
        buyerName: buyerName || decodedToken.name || "Local Shopper",
        buyerPhone: buyerPhone || "",
        buyerLocation: buyerLocation || null,
        sellerId: sellerSnap.id,
        sellerUserId: sellerData.userId || sellerSnap.id,
        sellerBusinessName: sellerData.businessName || "Local Store",
        sellerLocation: sellerData.location || null,
        items: itemSnapshots,
        subtotal,
        deliveryFee,
        discountTotal,
        total,
        status: "CONFIRMED",
        isBillLocked: true,
        lockedAt: nowIso,
        deliveryMethod: "SELLER_DELIVERY",
        customerNotes: customerNotes || "",
        messages: [
          {
            id: `msg-${Date.now()}`,
            orderId,
            senderRole: "SYSTEM",
            senderName: "LocalCart System",
            text: `Order #${orderNumber} confirmed! Final bill locked at \u20B9${total}. Inventory reserved.`,
            timestamp: nowIso,
            isSystemEvent: true
          }
        ],
        createdAt: nowIso,
        updatedAt: nowIso
      };
      for (const update of productUpdates) {
        transaction.update(update.ref, {
          stockQuantity: update.newStock,
          inStock: update.inStock,
          updatedAt: nowIso
        });
      }
      transaction.set(orderRef, newOrder);
      const convRef = db.collection("conversations").doc(orderId);
      transaction.set(convRef, {
        conversationId: orderId,
        orderId,
        buyerId: buyerUid,
        buyerName: newOrder.buyerName,
        sellerId: sellerSnap.id,
        sellerBusinessName: newOrder.sellerBusinessName,
        lastMessage: `Order #${orderNumber} confirmed (\u20B9${total}).`,
        updatedAt: nowIso
      });
      return newOrder;
    });
    return res.status(200).json({ success: true, order: orderResult });
  } catch (err) {
    console.error("Server checkout error:", err);
    return res.status(400).json({ success: false, error: err.message || "Checkout failed." });
  }
});
apiRouter.post("/ai/concierge", async (req, res) => {
  try {
    const { userQuery, context, userLocation } = req.body;
    if (!userQuery) {
      return res.status(400).json({ error: "userQuery is required" });
    }
    const casual = isCasualGreeting(userQuery);
    if (context?.intent === "CASUAL" || casual.isCasual) {
      const type = casual.type || "greeting";
      let msg = `Hello! I'm your LocalCart Shopping Assistant. How can I help you discover local shops, fresh food, or handcrafted products in your area today?`;
      if (type === "thanks") {
        msg = `You're very welcome! Let me know if you're looking for any products, local stores, or order updates.`;
      } else if (type === "pleasantry") {
        msg = `I'm your LocalCart Shopping Assistant for ${userLocation?.city || "Hyderabad"}. I can help you find fresh food, baked goods, artisan crafts, check prices, and track your orders.`;
      }
      return res.json({
        message: msg,
        suggestedCategories: ["Bakery & Desserts", "Handmade Jewellery", "Home Decor & Art"],
        quickReplies: ["What can I find nearby?", "What is on sale?"]
      });
    }
    if (aiClient) {
      const prompt = `You are the AI Shopping Assistant for LocalCart in ${userLocation?.city || "Hyderabad"}.
A customer asked: "${userQuery}"

Here are the verified live records retrieved from the live Firestore database for this query:
---------------------------------------------
INTENT: ${context?.intent || "GENERAL_SHOPPING"}
SUMMARY FACT: ${context?.summaryFact || "None"}
MATCHED PRODUCTS (${context?.matchedProducts?.length || 0}):
${JSON.stringify(context?.matchedProducts?.map((p) => ({
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
${JSON.stringify(context?.matchedSellers?.map((s) => ({
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
${JSON.stringify(context?.matchedOrders?.map((o) => ({
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
   Example: "Amul Dark Choko is currently \u20B9405 at G's Studio. There are 8 units available in stock."
4. If the user asks about stock availability (e.g. "Is Amul Dark Choko available?"), confirm whether it is available and state the stock quantity and price.
5. If the user asks "Who sells X?", name the seller and their neighborhood/area.
6. If the user asks for recommendations (e.g. "cakes under \u20B9500"), summarize the matching creations concisely.
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
          responseMimeType: "application/json"
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
    return res.json({
      message: context?.summaryFact || "I could not find matching records in the local catalog.",
      suggestedCategories: [],
      quickReplies: []
    });
  } catch (err) {
    console.error("Concierge API Error:", err);
    return res.json({
      message: req.body?.context?.summaryFact || "I could not find matching records in the local catalog.",
      suggestedCategories: [],
      quickReplies: []
    });
  }
});
apiRouter.post("/ai/seller-onboarding", async (req, res) => {
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
        config: { responseMimeType: "application/json" }
      });
      if (response && response.text) {
        return res.json(JSON.parse(response.text.trim()));
      }
    }
    const lower = `${productsText} ${businessTypeText}`.toLowerCase();
    let category = "Gifts & Handcrafted Studio";
    if (lower.includes("cake") || lower.includes("bake") || lower.includes("dessert")) category = "Bakery & Desserts";
    else if (lower.includes("jewel") || lower.includes("earring") || lower.includes("silver")) category = "Handmade Jewellery";
    else if (lower.includes("dress") || lower.includes("saree") || lower.includes("kurti")) category = "Boutique & Fashion";
    else if (lower.includes("decor") || lower.includes("candle") || lower.includes("pottery")) category = "Home Decor & Art";
    else if (lower.includes("snack") || lower.includes("pickle") || lower.includes("organic")) category = "Organic & Gourmet Snacks";
    return res.json({
      businessNameSuggestion: businessTypeText ? `${businessTypeText.split(" ")[0]} Store` : "My Local Store",
      businessCategory: category,
      tagline: "Fresh, authentic products made with utmost care",
      businessDescription: `We craft high-quality ${productsText || "goods"} for local customers with care and attention to detail.`,
      extractedProducts: productsText ? productsText.split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length > 2) : ["Product 1", "Product 2"],
      tags: ["Handmade", "Local Store", "Custom Orders"]
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
apiRouter.post("/ai/product-description", async (req, res) => {
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
        config: { responseMimeType: "application/json" }
      });
      if (response && response.text) {
        return res.json(JSON.parse(response.text.trim()));
      }
    }
    return res.json({
      description: `Quality ${productName || "product"} made with care and attention to detail.`,
      suggestedTags: [category?.split(" ")[0] || "Handmade", "Fresh", "Premium", "Local"],
      prepTime: "2 - 4 hours"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
function computeSellerMetrics(products = [], orders = []) {
  const validOrders = orders.filter((o) => o.status !== "REJECTED" && o.status !== "CANCELLED");
  const totalRevenue = validOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const pendingOrders = orders.filter((o) => o.status === "PENDING_SELLER_APPROVAL" || o.status === "CONFIRMED");
  const activeOrders = orders.filter((o) => ["ACCEPTED", "PREPARING", "READY", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY"].includes(o.status));
  const deliveredOrders = orders.filter((o) => o.status === "DELIVERED");
  const salesByProduct = {};
  validOrders.forEach((o) => {
    (o.items || []).forEach((item) => {
      const pName = item.productName || "Unknown Product";
      if (!salesByProduct[pName]) {
        salesByProduct[pName] = { name: pName, quantity: 0, revenue: 0 };
      }
      salesByProduct[pName].quantity += Number(item.quantity) || 1;
      salesByProduct[pName].revenue += Number(item.itemTotal) || Number(item.unitPrice || 0) * Number(item.quantity || 1);
    });
  });
  const sortedSales = Object.values(salesByProduct).sort((a, b) => b.quantity - a.quantity);
  const lowStock = products.filter((p) => p.inStock && Number(p.stockQuantity) <= 5);
  const outOfStock = products.filter((p) => !p.inStock || Number(p.stockQuantity) <= 0);
  const highestStock = [...products].sort((a, b) => (Number(b.stockQuantity) || 0) - (Number(a.stockQuantity) || 0))[0];
  const customerNames = Array.from(new Set(orders.map((o) => o.buyerName).filter(Boolean)));
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
    avgOrderValue
  };
}
function buildRelevantSellerContext(userQuery, sellerProfile, products = [], orders = [], metrics) {
  const casual = isCasualGreeting(userQuery);
  if (casual.isCasual) {
    return `STORE: ${sellerProfile?.businessName || "Store"} (${sellerProfile?.businessCategory || "General"}, in ${sellerProfile?.location?.area || ""}, ${sellerProfile?.location?.city || "India"})`;
  }
  const q = userQuery.toLowerCase();
  const sections = [];
  sections.push(
    `STORE: ${sellerProfile?.businessName || "Store"} (${sellerProfile?.businessCategory || "General"}, in ${sellerProfile?.location?.area || ""}, ${sellerProfile?.location?.city || "India"})`
  );
  const isStock = q.includes("stock") || q.includes("restock") || q.includes("inventory") || q.includes("running out") || q.includes("unit");
  const isOrder = q.includes("order") || q.includes("pending") || q.includes("deliver") || q.includes("dispatch") || q.includes("today") || q.includes("status");
  const isSales = q.includes("sale") || q.includes("revenue") || q.includes("sold") || q.includes("income") || q.includes("money") || q.includes("best-selling") || q.includes("top product") || q.includes("top selling");
  const isProduct = q.includes("what product") || q.includes("my product") || q.includes("product") || q.includes("item") || q.includes("catalog") || q.includes("price") || q.includes("pricing") || q.includes("discount");
  const isCustomer = q.includes("customer") || q.includes("buyer") || q.includes("who bought");
  if (isStock || isProduct || !isOrder && !isSales && !isCustomer) {
    sections.push(`PRODUCTS & INVENTORY (${products.length} total products listed):`);
    if (metrics.lowStock.length > 0) {
      sections.push(`- Low Stock Items (\u22645 units): ${metrics.lowStock.map((p) => `"${p.name}" (${p.stockQuantity} left, \u20B9${p.finalPrice})`).join("; ")}`);
    } else {
      sections.push(`- Low Stock Items: None (all active products have >5 units)`);
    }
    if (metrics.outOfStock.length > 0) {
      sections.push(`- Out of Stock Items (0 units): ${metrics.outOfStock.map((p) => `"${p.name}"`).join("; ")}`);
    }
    if (metrics.highestStock) {
      sections.push(`- Highest Stock Item: "${metrics.highestStock.name}" (${metrics.highestStock.stockQuantity} units)`);
    }
    if (products.length > 0) {
      const itemsList = products.map((p) => `\u2022 ${p.name} (\u20B9${p.finalPrice}, Stock: ${p.stockQuantity}${p.inStock ? "" : " - Out of Stock"})`).join("\n");
      sections.push(`- Listed Products:
${itemsList}`);
    } else {
      sections.push(`- Listed Products: No products listed yet`);
    }
  }
  if (isOrder || isSales || !isStock && !isProduct) {
    sections.push(`ORDERS SUMMARY (${orders.length} total orders):`);
    sections.push(`- Valid Orders: ${metrics.validOrders.length}`);
    sections.push(`- Pending Approval: ${metrics.pendingOrders.length}`);
    sections.push(`- Active / Preparing / Out for Delivery: ${metrics.activeOrders.length}`);
    sections.push(`- Delivered: ${metrics.deliveredOrders.length}`);
    if (orders.length > 0) {
      const recent = orders.slice(-6).map((o) => `Order #${o.orderNumber || "N/A"} (${o.status}, \u20B9${o.total}): ${(o.items || []).map((i) => `${i.productName} x${i.quantity}`).join(", ")}`);
      sections.push(`- Recent Orders: ${recent.join("; ")}`);
    }
  }
  if (isSales || !isStock && !isOrder && !isProduct) {
    sections.push(`SALES & REVENUE:`);
    sections.push(`- Total Recorded Revenue: \u20B9${metrics.totalRevenue}`);
    sections.push(`- Average Order Value: \u20B9${metrics.avgOrderValue}`);
    if (metrics.sortedSales.length > 0) {
      sections.push(`- Top Selling Products: ${metrics.sortedSales.slice(0, 5).map((s) => `"${s.name}" (${s.quantity} units, \u20B9${s.revenue})`).join("; ")}`);
    } else {
      sections.push(`- Top Selling Products: No completed product sales recorded yet`);
    }
  }
  if (isCustomer) {
    sections.push(`CUSTOMERS:`);
    sections.push(`- Unique Customers Count: ${metrics.customerNames.length}`);
    if (metrics.customerNames.length > 0) {
      sections.push(`- Customer Names: ${metrics.customerNames.slice(0, 6).join(", ")}`);
    }
  }
  return sections.join("\n");
}
function getSuggestedQuestions(userQuery, metrics) {
  const casual = isCasualGreeting(userQuery);
  if (casual.isCasual) {
    return [
      "What products do I have?",
      "What products are low in stock?",
      "How many orders do I have?"
    ];
  }
  const q = userQuery.toLowerCase();
  if (q.includes("what product") || q.includes("my product") || q.includes("catalog")) {
    return [
      "What products are low in stock?",
      "Which product is selling the most?",
      "How many orders do I have?"
    ];
  }
  if (q.includes("stock") || q.includes("restock") || q.includes("inventory")) {
    return [
      "What products do I have?",
      "Which product has the highest stock?",
      "Show my total sales"
    ];
  }
  if (q.includes("order") || q.includes("pending") || q.includes("deliver")) {
    return [
      "What products do I have?",
      "What products are low in stock?",
      "What is my total sales?"
    ];
  }
  if (q.includes("sale") || q.includes("revenue") || q.includes("selling the most")) {
    return [
      "What products do I have?",
      "What products are low in stock?",
      "How many orders did I receive?"
    ];
  }
  return [
    "What products do I have?",
    "What products are low in stock?",
    "How many orders do I have?"
  ];
}
function computeDeterministicAnswer(userQuery, products, orders, metrics, sellerProfile) {
  const casual = isCasualGreeting(userQuery);
  if (casual.isCasual) {
    if (casual.type === "greeting") {
      return `Hello! I am your LocalCart Seller Assistant. How can I help you manage ${sellerProfile?.businessName || "your store"} today?`;
    }
    if (casual.type === "thanks") {
      return `You're welcome! Let me know if you need anything else to manage ${sellerProfile?.businessName || "your store"}.`;
    }
    return `I'm here to help you manage ${sellerProfile?.businessName || "your store"}. You can ask about your products, inventory levels, orders, or sales performance.`;
  }
  const qLower = userQuery.toLowerCase();
  if (qLower.includes("low in stock") || qLower.includes("low stock") || qLower.includes("restock") || qLower.includes("running out")) {
    if (metrics.lowStock.length > 0) {
      return `You have ${metrics.lowStock.length} product(s) running low in stock (5 or fewer units remaining):
` + metrics.lowStock.map((p) => `\u2022 ${p.name}: ${p.stockQuantity} remaining (\u20B9${p.finalPrice})`).join("\n") + `

We recommend restocking these soon to avoid missing incoming customer orders.`;
    } else if (metrics.outOfStock.length > 0) {
      return `None of your active products have \u22645 stock, but you have ${metrics.outOfStock.length} product(s) marked Out of Stock:
` + metrics.outOfStock.map((p) => `\u2022 ${p.name}`).join("\n");
    } else {
      return `All ${products.length} products in your store currently have healthy stock levels above 5 units. No urgent restocking is needed.`;
    }
  } else if (qLower.includes("what product") || qLower.includes("my product") || qLower.includes("which product") || qLower.includes("list product") || qLower === "products" || qLower === "all products" || qLower.includes("show my product") || qLower.includes("show products")) {
    if (products.length === 0) {
      return `You currently have no products listed in ${sellerProfile?.businessName || "your store"}. You can add new products from your inventory dashboard.`;
    } else {
      return `Here are the products currently listed in ${sellerProfile?.businessName || "your store"} (${products.length} total):
` + products.map((p) => `\u2022 ${p.name}: \u20B9${p.finalPrice} (${p.stockQuantity} in stock${p.inStock ? "" : " - Out of Stock"})`).join("\n");
    }
  } else if (qLower.includes("highest stock") || qLower.includes("most stock")) {
    if (metrics.highestStock) {
      return `The product with the highest inventory in your store is "${metrics.highestStock.name}" with ${metrics.highestStock.stockQuantity} units in stock.`;
    } else {
      return `You do not have any products added to your store yet.`;
    }
  } else if (qLower.includes("selling the most") || qLower.includes("best-selling") || qLower.includes("top product") || qLower.includes("top 3")) {
    if (metrics.sortedSales.length === 0) {
      return `You don't have enough completed orders yet to identify a best-selling product. Once customers purchase from your store, your top-performing products will be tracked here.`;
    } else {
      const top3 = metrics.sortedSales.slice(0, 3);
      return `Here are your top-selling products based on customer orders:
` + top3.map((s, idx) => `${idx + 1}. ${s.name} \u2014 ${s.quantity} units sold (\u20B9${s.revenue})`).join("\n");
    }
  } else if (qLower.includes("how many order") || qLower.includes("order count") || qLower.includes("orders did i receive") || qLower.includes("show me today") || qLower.includes("orders are pending")) {
    return `Order summary for ${sellerProfile?.businessName || "your store"}:
\u2022 Total orders received: ${orders.length}
\u2022 Pending approval: ${metrics.pendingOrders.length}
\u2022 In preparation / dispatched: ${metrics.activeOrders.length}
\u2022 Delivered & completed: ${metrics.deliveredOrders.length}`;
  } else if (qLower.includes("sale") || qLower.includes("revenue") || qLower.includes("income") || qLower.includes("how much revenue")) {
    let reply = `Your total sales revenue is \u20B9${metrics.totalRevenue.toLocaleString()} across ${metrics.validOrders.length} confirmed orders.`;
    if (metrics.avgOrderValue > 0) {
      reply += ` Your average order value is \u20B9${metrics.avgOrderValue}.`;
    }
    return reply;
  } else if (qLower.includes("customer") || qLower.includes("bought from me")) {
    if (metrics.customerNames.length === 0) {
      return `No customer orders have been recorded yet. Share your store link with local buyers to receive your first order!`;
    } else {
      return `You have served ${metrics.customerNames.length} unique customer(s). Recent customers include: ${metrics.customerNames.slice(0, 5).join(", ")}.`;
    }
  } else if (qLower.includes("summary") || qLower.includes("give me a summary")) {
    return `Store Summary for ${sellerProfile?.businessName || "Your Store"}:
\u2022 Products cataloged: ${products.length}
\u2022 Total orders: ${orders.length} (\u20B9${metrics.totalRevenue.toLocaleString()} revenue)
\u2022 Low stock items: ${metrics.lowStock.length}
\u2022 Pending orders to accept: ${metrics.pendingOrders.length}`;
  } else if (qLower.includes("how should i price") || qLower.includes("pricing")) {
    return `General Pricing Advice for Local Stores:
1. Cost-Plus: Calculate raw ingredients/materials + labor + packaging, then add a 30-50% markup.
2. Competitor Check: Compare with nearby local shops for similar items in your city.
3. Bundles: Offer combo packs or volume discounts (e.g. Buy 2 get 10% off) to increase average order value.

(Note: This is general business advice; store records do not track your cost of goods.)`;
  } else if (qLower.includes("improve my sales") || qLower.includes("more customers") || qLower.includes("promote")) {
    return `Tips to Increase Store Sales:
1. Keep stock counts updated and add clear, bright product photos.
2. Enable free delivery above a reasonable cart value (e.g. \u20B9${sellerProfile?.deliveryOptions?.freeDeliveryAbove || 500}) to encourage bigger orders.
3. Quickly accept pending orders \u2014 fast response times build customer loyalty in your local neighborhood.
4. Share your public store link on WhatsApp groups and local community channels.`;
  } else {
    return `I'm your LocalCart Assistant for ${sellerProfile?.businessName || "your store"}. You currently have ${products.length} products and ${orders.length} total orders recorded in your store database. Feel free to ask about your products, stock levels, orders, or sales revenue.`;
  }
}
apiRouter.post("/ai/seller-assistant/stream", async (req, res) => {
  try {
    const { userQuery, sellerProfile, products = [], orders = [], history = [] } = req.body;
    if (!userQuery || typeof userQuery !== "string") {
      return res.status(400).json({ error: "userQuery is required" });
    }
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}

`);
    };
    const casual = isCasualGreeting(userQuery);
    if (casual.isCasual) {
      let msg = `Hello! I am your LocalCart Seller Assistant. How can I help you manage ${sellerProfile?.businessName || "your store"} today?`;
      if (casual.type === "thanks") {
        msg = `You're welcome! Let me know if you need anything else to manage ${sellerProfile?.businessName || "your store"}.`;
      } else if (casual.type === "pleasantry") {
        msg = `I'm here to help you manage ${sellerProfile?.businessName || "your store"}. You can ask about your products, inventory levels, orders, or sales performance.`;
      }
      sendEvent({ chunk: msg });
      sendEvent({ done: true, suggestedQuestions: ["What products do I have?", "What products are low in stock?", "How many orders do I have?"] });
      res.end();
      return;
    }
    const metrics = computeSellerMetrics(products, orders);
    const relevantContext = buildRelevantSellerContext(userQuery, sellerProfile, products, orders, metrics);
    const suggestedQuestions = getSuggestedQuestions(userQuery, metrics);
    if (aiClient) {
      try {
        const prompt = `You are the "Seller AI Assistant" for LocalCart, an e-commerce platform for local neighborhood shops and sellers.
You are directly advising the authenticated store owner of "${sellerProfile?.businessName || "Your Shop"}" (${sellerProfile?.businessCategory || "Store"}, located in ${sellerProfile?.location?.area || ""}, ${sellerProfile?.location?.city || "India"}).

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
        const models = GEMINI_MODELS;
        let streamSuccess = false;
        for (const model of models) {
          try {
            const stream = await aiClient.models.generateContentStream({
              model,
              contents: prompt
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
          } catch (streamErr) {
            console.info(`Streaming with ${model} failed, trying alternative:`, streamErr?.message || streamErr);
          }
        }
      } catch (err) {
        console.info("Seller AI Assistant streaming fallback to deterministic:", err?.message || err);
      }
    }
    const fallbackAnswer = computeDeterministicAnswer(userQuery, products, orders, metrics, sellerProfile);
    const words = fallbackAnswer.split(" ");
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(" ") + (i + 3 < words.length ? " " : "");
      sendEvent({ chunk });
      await new Promise((r) => setTimeout(r, 20));
    }
    sendEvent({ done: true, suggestedQuestions });
    res.end();
  } catch (err) {
    console.error("Stream endpoint fatal error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message || "Stream error" })}

`);
      res.end();
    }
  }
});
apiRouter.post("/ai/seller-assistant", async (req, res) => {
  try {
    const { userQuery, sellerProfile, products = [], orders = [], history = [] } = req.body;
    if (!userQuery || typeof userQuery !== "string") {
      return res.status(400).json({ error: "userQuery is required" });
    }
    const casual = isCasualGreeting(userQuery);
    if (casual.isCasual) {
      let msg = `Hello! I am your LocalCart Seller Assistant. How can I help you manage ${sellerProfile?.businessName || "your store"} today?`;
      if (casual.type === "thanks") {
        msg = `You're welcome! Let me know if you need anything else to manage ${sellerProfile?.businessName || "your store"}.`;
      } else if (casual.type === "pleasantry") {
        msg = `I'm here to help you manage ${sellerProfile?.businessName || "your store"}. You can ask about your products, inventory levels, orders, or sales performance.`;
      }
      return res.json({
        message: msg,
        suggestedQuestions: ["What products do I have?", "What products are low in stock?", "How many orders do I have?"]
      });
    }
    const metrics = computeSellerMetrics(products, orders);
    const relevantContext = buildRelevantSellerContext(userQuery, sellerProfile, products, orders, metrics);
    const suggestedQuestions = getSuggestedQuestions(userQuery, metrics);
    if (aiClient) {
      try {
        const prompt = `You are the "Seller AI Assistant" for LocalCart, an e-commerce platform for local neighborhood shops and sellers.
You are directly advising the authenticated store owner of "${sellerProfile?.businessName || "Your Shop"}" (${sellerProfile?.businessCategory || "Store"}, located in ${sellerProfile?.location?.area || ""}, ${sellerProfile?.location?.city || "India"}).

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
          config: { responseMimeType: "application/json" }
        });
        if (response && response.text) {
          const parsed = JSON.parse(response.text.trim());
          return res.json({
            message: parsed.message,
            suggestedQuestions: Array.isArray(parsed.suggestedQuestions) && parsed.suggestedQuestions.length > 0 ? parsed.suggestedQuestions : suggestedQuestions
          });
        }
      } catch (geminiErr) {
        console.info("Seller AI Assistant using grounded live calculation engine:", geminiErr?.message || geminiErr);
      }
    }
    const reply = computeDeterministicAnswer(userQuery, products, orders, metrics, sellerProfile);
    return res.json({ message: reply, suggestedQuestions });
  } catch (err) {
    console.error("Seller AI Assistant error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate assistant response" });
  }
});
app.use("/api", apiRouter);
app.use("/", apiRouter);
async function setupViteMiddleware() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LocalCart AI Server running on http://0.0.0.0:${PORT}`);
  });
}
if (!process.env.VERCEL) {
  setupViteMiddleware();
}
var server_default = app;
export {
  server_default as default
};
