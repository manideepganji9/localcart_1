export const APP_CONFIG = {
  name: "LocalCart AI",
  shortName: "LocalCart",
  tagline: "Shop from sellers near you.",
  description: "Discover products from local businesses and buy directly.",
  currencySymbol: "₹",
  currencyCode: "INR",
  defaultLocation: {
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500034",
    area: "Banjara Hills",
  },
  supportPhone: "+91 98765 43210",
  supportEmail: "hello@localcart.ai",
  // Configurable hero video URL - easily replaceable
  heroVideoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  heroVideoPoster: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1920&q=80",
};

export const POPULAR_CITIES = [
  { city: "Hyderabad", state: "Telangana", areas: ["Banjara Hills", "Jubilee Hills", "Madhapur", "Gachibowli", "Kondapur", "Begumpet", "Kukatpally"] },
  { city: "Bengaluru", state: "Karnataka", areas: ["Indiranagar", "Koramangala", "HSR Layout", "Whitefield", "Jayanagar"] },
  { city: "Mumbai", state: "Maharashtra", areas: ["Bandra", "Andheri", "Juhu", "Powai", "Colaba"] },
  { city: "Chennai", state: "Tamil Nadu", areas: ["T. Nagar", "Adyar", "Anna Nagar", "Velachery", "Mylapore"] },
  { city: "Pune", state: "Maharashtra", areas: ["Koregaon Park", "Viman Nagar", "Kothrud", "Baner", "Aundh"] },
  { city: "Delhi NCR", state: "Delhi", areas: ["Connaught Place", "South Extension", "Gurugram Sector 29", "Noida Sector 18"] },
];

export const PRODUCT_CATEGORIES = [
  { id: "bakery", name: "Bakery & Desserts", icon: "Cake", description: "Cakes, pastries, cookies, brownies & fresh breads" },
  { id: "jewellery", name: "Handmade Jewellery", icon: "Gem", description: "Custom earrings, bracelets, necklace sets & silver crafts" },
  { id: "gifts", name: "Gifts & Handcrafted Studio", icon: "Gift", description: "Gift hampers, personalized wooden crafts, cards & keepsakes" },
  { id: "fashion", name: "Boutique & Fashion", icon: "Shirt", description: "Kurtis, designer dresses, handloom sarees & ethnic wear" },
  { id: "home-decor", name: "Home Decor & Art", icon: "Home", description: "Scented candles, ceramic pottery, planters & wall art" },
  { id: "organic-food", name: "Organic & Gourmet Snacks", icon: "Apple", description: "Homemade pickles, sweets, cold-pressed oils & snacks" },
  { id: "beauty", name: "Handmade Soaps & Skincare", icon: "Sparkles", description: "Natural soaps, body butters, herbal oils & bath essentials" },
];

export const BUSINESS_TYPES = [
  "Home Bakery / Cloud Kitchen",
  "Handmade Crafter / Maker",
  "Boutique / Fashion Studio",
  "Custom Gifts & Studio",
  "Organic / Natural Foods",
  "Pottery & Home Decor",
  "Independent Retailer",
];
