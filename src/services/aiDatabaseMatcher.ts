import { Product, SellerProfile, Order, LocationInfo } from '../types';

export interface GroundedBuyerContext {
  intent: 
    | 'CASUAL'
    | 'PRODUCT_PRICE'
    | 'PRODUCT_STOCK'
    | 'PRODUCT_AVAILABILITY'
    | 'PRODUCT_SELLER'
    | 'PRODUCT_SEARCH'
    | 'CATEGORY_SEARCH'
    | 'SELLER_PRODUCTS'
    | 'SELLER_SEARCH'
    | 'LOCATION_SEARCH'
    | 'UNAVAILABLE_SEARCH'
    | 'ORDER_STATUS'
    | 'GENERAL_SHOPPING';
  matchedProducts: Product[];
  matchedSellers: SellerProfile[];
  matchedOrders: Order[];
  filtersApplied: {
    productNameQuery?: string;
    category?: string;
    sellerName?: string;
    maxPrice?: number;
    minPrice?: number;
    locationArea?: string;
    locationCity?: string;
    inStockOnly?: boolean;
    outOfStockOnly?: boolean;
    isCheapest?: boolean;
    isHighestRated?: boolean;
  };
  summaryFact: string;
}

/**
 * Normalizes text for case-insensitive matching
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Detects casual greetings, pleasantries, and thank-yous
 */
export function isCasualGreeting(query: string): { isCasual: boolean; type: 'greeting' | 'thanks' | 'pleasantry' | 'none' } {
  if (!query || typeof query !== 'string') return { isCasual: false, type: 'none' };
  const q = query.trim().toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(hi|hello|hey|heya|howdy|sup|greetings|good\s+(morning|afternoon|evening|day))(\s+there|\s+localcart|\s+assistant)?$/i.test(q)) {
    return { isCasual: true, type: 'greeting' };
  }
  if (/^(thanks|thank\s+you|thx|many\s+thanks|thank\s+you\s+so\s+much)$/i.test(q)) {
    return { isCasual: true, type: 'thanks' };
  }
  if (/^(how\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do|what\s+is\s+this|help|good\s+to\s+see\s+you)$/i.test(q)) {
    return { isCasual: true, type: 'pleasantry' };
  }
  return { isCasual: false, type: 'none' };
}

/**
 * Checks if query words match a target string
 */
function matchesKeywords(target: string, queryWords: string[]): boolean {
  const normTarget = normalize(target);
  if (queryWords.length === 0) return true;
  return queryWords.every(word => normTarget.includes(word));
}

/**
 * Analyzes a buyer query against LIVE Firestore database records.
 * Extracts matched products, sellers, and orders with zero hallucination.
 */
export function analyzeBuyerQuery(
  userQuery: string,
  products: Product[],
  sellers: SellerProfile[],
  buyerOrders: Order[],
  userLocation: { city: string; area?: string }
): GroundedBuyerContext {
  // Check for conversational intent first (Hi, Hello, Thanks, etc.)
  const casual = isCasualGreeting(userQuery);
  if (casual.isCasual) {
    let reply = "Hi! 👋 What are you looking for today?";
    if (casual.type === 'thanks') reply = "You're welcome! Let me know if you need anything.";
    if (casual.type === 'pleasantry') reply = "I'm doing well, thank you! What local creations or shops are you looking for today?";
    return {
      intent: 'CASUAL',
      matchedProducts: [],
      matchedSellers: [],
      matchedOrders: [],
      filtersApplied: {},
      summaryFact: reply,
    };
  }

  const qClean = normalize(userQuery);
  const words = qClean.split(' ').filter(w => w.length > 0);

  // Stopwords to ignore when searching product names
  const stopWords = new Set([
    'what', 'is', 'the', 'price', 'of', 'cost', 'rate', 'how', 'much', 'many',
    'are', 'there', 'in', 'stock', 'available', 'availability', 'do', 'you',
    'have', 'who', 'sells', 'sell', 'seller', 'where', 'can', 'i', 'buy', 'find',
    'show', 'me', 'get', 'under', 'below', 'less', 'than', 'within', 'budget',
    'above', 'over', 'more', 'near', 'nearby', 'right', 'now', 'currently',
    'cheapest', 'best', 'highest', 'rated', 'popular', 'any', 'some', 'please',
    'tell', 'give', 'details', 'info', 'about', 'from', 'at', 'store', 'shop',
    'bakery', 'status', 'my', 'order', 'orders',
    'item', 'items', 'product', 'products', 'rupees', 'rs', 'inr'
  ]);

  const searchKeywords = words.filter(w => !stopWords.has(w) && w.length > 1);

  // 1. Detect Intent
  const isPriceQuery = /price|cost|rate|how much|mrp/i.test(userQuery);
  const isStockQuery = /how many|quantity|stock|units|count/i.test(userQuery);
  const isAvailabilityQuery = /available|in stock|in-stock|out of stock|unavailable|have/i.test(userQuery) && !isStockQuery;
  const isSellerQuery = /who sells|which bakery|which shop|which seller|which store|where to buy|find a .* shop|find a .* store|find .* shop|find .* store/i.test(userQuery);
  const isOrderQuery = /my order|order status|where is my order|has my order|dispatched|tracking|track order|what did i order|recent order|past order|orders/i.test(userQuery);
  const isUnavailableQuery = /unavailable|out of stock|sold out|out-of-stock|depleted/i.test(userQuery);
  const isCheapest = /cheapest|lowest price|least expensive|budget friendly/i.test(userQuery);
  const isHighestRated = /highest rated|top rated|best rated|highest rating|best review/i.test(userQuery);

  // 2. Extract Price Constraints
  const underPriceMatch = userQuery.match(/(?:under|below|less than|within|budget of|<|<=)\s*(?:₹|rs\.?|inr)?\s*(\d{2,6})/i)
    || userQuery.match(/(?:₹|rs\.?|inr)\s*(\d{2,6})\s*(?:or less|under|below)/i);
  const maxPrice = underPriceMatch ? parseInt(underPriceMatch[1], 10) : undefined;

  const abovePriceMatch = userQuery.match(/(?:above|over|more than|>|>=)\s*(?:₹|rs\.?|inr)?\s*(\d{2,6})/i);
  const minPrice = abovePriceMatch ? parseInt(abovePriceMatch[1], 10) : undefined;

  // 3. Match Specific Product by Name (Exact or High-Confidence Partial)
  // Check exact full-name matches or phrase matches first
  let exactProductMatch: Product | undefined = undefined;
  
  // Sort products by length of name descending so longer names get matched first
  const sortedProductsByLen = [...products].sort((a, b) => b.name.length - a.name.length);
  for (const prod of sortedProductsByLen) {
    const pNameNorm = normalize(prod.name);
    // Check if query contains product name or product name contains the query without stopwords
    if (qClean.includes(pNameNorm)) {
      exactProductMatch = prod;
      break;
    }
  }

  // If not found by full string, match by all non-stopword tokens
  if (!exactProductMatch && searchKeywords.length > 0) {
    const candidates = products.filter(p => {
      const pNorm = normalize(`${p.name} ${p.category} ${p.businessName}`);
      return searchKeywords.every(k => pNorm.includes(k));
    });
    if (candidates.length === 1) {
      exactProductMatch = candidates[0];
    } else if (candidates.length > 1) {
      // Find candidate whose name has most overlap with searchKeywords
      const best = candidates.find(p => {
        const nameNorm = normalize(p.name);
        return searchKeywords.every(k => nameNorm.includes(k));
      });
      if (best) exactProductMatch = best;
    }
  }

  // 4. Match Specific Seller by Name
  let matchedSeller: SellerProfile | undefined = undefined;
  for (const s of sellers) {
    const sNameNorm = normalize(s.businessName);
    if (qClean.includes(sNameNorm) || (s.businessSlug && qClean.includes(normalize(s.businessSlug)))) {
      matchedSeller = s;
      break;
    }
  }

  // 5. Match Location (Area or City)
  let matchedLocationArea: string | undefined = undefined;
  let matchedLocationCity: string | undefined = undefined;

  for (const s of sellers) {
    if (s.location.area && qClean.includes(normalize(s.location.area))) {
      matchedLocationArea = s.location.area;
    }
    if (s.location.city && qClean.includes(normalize(s.location.city))) {
      matchedLocationCity = s.location.city;
    }
  }

  if (/near me|nearby|my area/i.test(userQuery) && userLocation.area) {
    matchedLocationArea = userLocation.area;
  }

  // 6. Match Category
  const categoryKeywords: { [key: string]: string[] } = {
    'Bakery & Desserts': ['cake', 'cakes', 'bakery', 'bake', 'dessert', 'desserts', 'pastry', 'pastries', 'brownie', 'brownies', 'cookie', 'cookies', 'bread', 'sourdough', 'choko', 'chocolate', 'croissant', 'truffle', 'gateau', 'cupcake', 'pie'],
    'Handmade Jewellery': ['jewel', 'jewellery', 'jewelry', 'earring', 'earrings', 'stud', 'studs', 'necklace', 'pendant', 'bracelet', 'bangle', 'silver', 'brass', 'ring', 'rings', 'pearl', 'filigree', 'choker', 'gemstone'],
    'Home Decor & Art': ['decor', 'candle', 'candles', 'pottery', 'ceramic', 'vase', 'planter', 'art', 'frame', 'sculpture', 'painting', 'cushion', 'tapestry', 'craft', 'terracotta'],
    'Boutique & Fashion': ['fashion', 'dress', 'dresses', 'saree', 'sarees', 'kurti', 'kurtis', 'cloth', 'apparel', 'cotton', 'silk', 'handspun', 'linen', 'scarf', 'dupatta', 'wear', 'shawl'],
    'Organic & Gourmet Snacks': ['snack', 'snacks', 'organic', 'pickle', 'pickles', 'spices', 'spice', 'honey', 'tea', 'coffee', 'gourmet', 'crisps', 'chips', 'oil', 'masala', 'nut', 'nuts'],
    'Handmade Soaps & Skincare': ['soap', 'soaps', 'skincare', 'skin', 'bath', 'scrub', 'lotion', 'balm', 'essential', 'organic soap', 'glow', 'botanical'],
    'Gifts & Handcrafted Studio': ['gift', 'gifts', 'hamper', 'hampers', 'souvenir', 'keepsake', 'handcrafted', 'handmade', 'custom', 'bespoke']
  };

  let matchedCategory: string | undefined = undefined;
  for (const [catName, catWords] of Object.entries(categoryKeywords)) {
    if (qClean.includes(normalize(catName)) || catWords.some(w => words.includes(w))) {
      matchedCategory = catName;
      break;
    }
  }

  // 7. Execute Multi-Dimension Filtering on LIVE Products
  let filteredProducts: Product[] = [];

  if (exactProductMatch) {
    filteredProducts = [exactProductMatch];
  } else {
    filteredProducts = products.filter(p => {
      // Out of stock filter
      if (isUnavailableQuery) {
        if (p.inStock && p.stockQuantity > 0) return false;
      } else {
        // Default to in-stock for generic searches unless user explicitly asks for unavailable
        // But if searching for a specific product name, don't filter out of stock so AI can report availability!
      }

      // Category match
      if (matchedCategory && p.category !== matchedCategory) {
        // Check if words match in tags or name
        const matchCatWords = categoryKeywords[matchedCategory] || [];
        const hasWord = matchCatWords.some(cw => p.name.toLowerCase().includes(cw) || p.description.toLowerCase().includes(cw) || (p.tags || []).some(t => t.toLowerCase().includes(cw)));
        if (!hasWord) return false;
      }

      // Seller match
      if (matchedSeller && p.sellerId !== matchedSeller.id) {
        return false;
      }

      // Location match
      if (matchedLocationArea || matchedLocationCity) {
        const seller = sellers.find(s => s.id === p.sellerId);
        if (matchedLocationArea && seller?.location.area.toLowerCase() !== matchedLocationArea.toLowerCase()) {
          return false;
        }
        if (matchedLocationCity && seller?.location.city.toLowerCase() !== matchedLocationCity.toLowerCase()) {
          return false;
        }
      }

      // Price constraints
      if (maxPrice !== undefined && p.finalPrice > maxPrice) return false;
      if (minPrice !== undefined && p.finalPrice < minPrice) return false;

      // Keyword search in product fields
      if (searchKeywords.length > 0 && !matchedCategory && !matchedSeller) {
        const fullSearchString = normalize(`${p.name} ${p.description} ${p.category} ${(p.tags || []).join(' ')} ${p.businessName}`);
        const anyKeywordMatches = searchKeywords.some(k => fullSearchString.includes(k));
        if (!anyKeywordMatches) return false;
      }

      return true;
    });
  }

  // 8. Sorting
  if (isCheapest) {
    filteredProducts.sort((a, b) => a.finalPrice - b.finalPrice);
  } else if (isHighestRated) {
    filteredProducts.sort((a, b) => {
      const sellerA = sellers.find(s => s.id === a.sellerId)?.rating || 0;
      const sellerB = sellers.find(s => s.id === b.sellerId)?.rating || 0;
      return sellerB - sellerA;
    });
  }

  // 9. Match Buyer Orders (for order tracking queries)
  let matchedOrders: Order[] = [];
  if (isOrderQuery) {
    // Check if query has specific order number
    const orderNumMatch = userQuery.match(/(?:order\s*#?\s*|#)([a-zA-Z0-9_-]+)/i);
    if (orderNumMatch && buyerOrders.length > 0) {
      const targetNum = orderNumMatch[1].toLowerCase();
      matchedOrders = buyerOrders.filter(o => o.orderNumber.toLowerCase().includes(targetNum) || o.id.toLowerCase().includes(targetNum));
    }
    if (matchedOrders.length === 0 && buyerOrders.length > 0) {
      // Sort newest first and take latest
      matchedOrders = [...buyerOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);
    }
  }

  // 10. Matched Sellers
  let matchedSellers: SellerProfile[] = [];
  if (matchedSeller) {
    matchedSellers = [matchedSeller];
  } else if (filteredProducts.length > 0) {
    const sIds = new Set(filteredProducts.map(p => p.sellerId));
    matchedSellers = sellers.filter(s => sIds.has(s.id));
  } else if (matchedLocationArea || matchedLocationCity) {
    matchedSellers = sellers.filter(s => {
      if (matchedLocationArea && s.location.area.toLowerCase() === matchedLocationArea.toLowerCase()) return true;
      if (matchedLocationCity && s.location.city.toLowerCase() === matchedLocationCity.toLowerCase()) return true;
      return false;
    });
  }

  // 11. Determine Final Intent Tag
  let finalIntent: GroundedBuyerContext['intent'] = 'GENERAL_SHOPPING';
  if (isOrderQuery) finalIntent = 'ORDER_STATUS';
  else if (exactProductMatch) {
    if (isPriceQuery) finalIntent = 'PRODUCT_PRICE';
    else if (isStockQuery) finalIntent = 'PRODUCT_STOCK';
    else if (isAvailabilityQuery) finalIntent = 'PRODUCT_AVAILABILITY';
    else if (isSellerQuery) finalIntent = 'PRODUCT_SELLER';
    else finalIntent = 'PRODUCT_SEARCH';
  } else if (isUnavailableQuery) finalIntent = 'UNAVAILABLE_SEARCH';
  else if (matchedSeller) finalIntent = 'SELLER_PRODUCTS';
  else if (matchedCategory) finalIntent = 'CATEGORY_SEARCH';
  else if (matchedLocationArea || matchedLocationCity) finalIntent = 'LOCATION_SEARCH';
  else if (filteredProducts.length > 0) finalIntent = 'PRODUCT_SEARCH';

  // 12. Create Structured Summary Fact (Deterministic Single Source of Truth)
  let summaryFact = '';
  if (exactProductMatch) {
    const p = exactProductMatch;
    const seller = sellers.find(s => s.id === p.sellerId);
    const sellerName = seller?.businessName || p.businessName;
    const sellerArea = seller?.location.area || '';
    const stockStr = p.inStock && p.stockQuantity > 0 ? `${p.stockQuantity} units available in stock` : 'currently out of stock';
    
    if (isPriceQuery) {
      summaryFact = `${p.name} is currently ₹${p.finalPrice}${p.discountPercent > 0 ? ` (original price ₹${p.originalPrice}, ${p.discountPercent}% off)` : ''} at ${sellerName}. There are ${p.stockQuantity} units available.`;
    } else if (isStockQuery) {
      summaryFact = `There are ${p.stockQuantity} units of ${p.name} available in stock at ${sellerName} (₹${p.finalPrice} each).`;
    } else if (isAvailabilityQuery) {
      summaryFact = p.inStock && p.stockQuantity > 0
        ? `Yes. ${sellerName} currently has ${p.name} available at ₹${p.finalPrice}, with ${p.stockQuantity} units in stock.`
        : `Currently, ${p.name} at ${sellerName} is out of stock.`;
    } else if (isSellerQuery) {
      summaryFact = `${p.name} is available and sold by ${sellerName}${sellerArea ? ` located in ${sellerArea}` : ''} at ₹${p.finalPrice}.`;
    } else {
      summaryFact = `${p.name} is offered by ${sellerName} for ₹${p.finalPrice}. Availability: ${stockStr}.`;
    }
  } else if (isOrderQuery) {
    if (matchedOrders.length === 0) {
      summaryFact = `You do not have any recent orders recorded in your account.`;
    } else {
      const statusLabels: { [key: string]: string } = {
        CONFIRMED: 'Confirmed & Accepted by Seller',
        PENDING_SELLER_APPROVAL: 'Pending Seller Approval',
        ACCEPTED: 'Accepted & Slated for Production',
        PREPARING: 'Under Active Preparation in Store',
        READY: 'Ready for Dispatch / Pickup',
        OUT_FOR_DELIVERY: 'Dispatched & Out for Delivery',
        DELIVERED: 'Delivered to Destination',
        REJECTED: 'Declined by Seller',
        CANCELLED: 'Cancelled'
      };

      if (matchedOrders.length === 1) {
        const latest = matchedOrders[0];
        summaryFact = `Your recent order #${latest.orderNumber} from ${latest.sellerBusinessName} for ₹${latest.total} is currently ${statusLabels[latest.status] || latest.status}. Expected delivery: ${latest.expectedDeliveryDate || 'Standard dispatch timeline'}.`;
      } else {
        const orderSummaries = matchedOrders.slice(0, 3).map(o => `#${o.orderNumber} from ${o.sellerBusinessName} (₹${o.total}, ${statusLabels[o.status] || o.status})`).join('; ');
        summaryFact = `You have ${matchedOrders.length} recent order(s): ${orderSummaries}.`;
      }
    }
  } else if (filteredProducts.length > 0) {
    const top = filteredProducts.slice(0, 4);
    summaryFact = `Found ${filteredProducts.length} matching product${filteredProducts.length > 1 ? 's' : ''} in the local catalog: ${top.map(p => `"${p.name}" (₹${p.finalPrice} at ${p.businessName})`).join(', ')}.`;
  } else if (matchedSellers.length > 0) {
    const top = matchedSellers.slice(0, 3);
    summaryFact = `Found ${matchedSellers.length} local store(s): ${top.map(s => `"${s.businessName}" in ${s.location.area || s.location.city} (${s.whatYouSell || s.businessCategory})`).join(', ')}.`;
  } else {
    summaryFact = `I couldn't find that in the current LocalCart catalog.`;
  }

  return {
    intent: finalIntent,
    matchedProducts: filteredProducts,
    matchedSellers,
    matchedOrders,
    filtersApplied: {
      productNameQuery: exactProductMatch?.name,
      category: matchedCategory,
      sellerName: matchedSeller?.businessName,
      maxPrice,
      minPrice,
      locationArea: matchedLocationArea,
      locationCity: matchedLocationCity,
      inStockOnly: !isUnavailableQuery,
      outOfStockOnly: isUnavailableQuery,
      isCheapest,
      isHighestRated,
    },
    summaryFact,
  };
}
