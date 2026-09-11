export type UserRole = 'SELLER' | 'BUYER' | 'UNASSIGNED';

export interface LocationInfo {
  label?: string;
  city: string;
  state: string;
  pincode: string;
  area: string;
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  latitude?: number;
  longitude?: number;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  location?: LocationInfo;
  onboardingCompleted?: boolean;
}

export interface DeliveryOptions {
  sellerDelivery: boolean;
  thirdParty: boolean;
  buyerPickup: boolean;
  baseDeliveryFee: number;
  freeDeliveryAbove?: number;
  estimatedTime?: string;
}

export interface SellerProfile {
  id: string;
  userId: string;
  businessName: string;
  businessSlug: string;
  businessCategory: string; // e.g. "Bakery & Desserts", "Handmade Jewellery"
  businessDescription: string;
  tagline: string;
  rating: number;
  reviewCount: number;
  location: LocationInfo;
  serviceRadiusKm: number;
  bannerUrl: string;
  logoUrl: string;
  storePhotoUrl?: string;
  openingHours: string;
  deliveryOptions: DeliveryOptions;
  contactPhone: string;
  contactEmail: string;
  isVerified: boolean;
  tags: string[];
  createdAt: string;
}

export interface BuyerProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  location: LocationInfo;
  preferredCategories: string[];
  favoriteSellerIds: string[];
  createdAt: string;
}

export interface Product {
  id: string;
  sellerId: string;
  businessName: string;
  name: string;
  description: string;
  category: string;
  originalPrice: number;
  discountPercent: number; // e.g. 10 for 10%
  finalPrice: number;
  stockQuantity: number;
  lowStockThreshold?: number; // Product-specific threshold (defaults to 5 if undefined)
  inStock: boolean;
  imageUrl: string;
  images?: string[]; // Multiple photos support with primary image as first
  preparationTime?: string; // e.g. "2 hours", "1 day"
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemSnapshot {
  productId: string;
  productName: string;
  productImage: string;
  category: string;
  originalPrice: number;
  discountPercent: number;
  unitPrice: number; // finalPrice at time of order
  quantity: number;
  itemTotal: number;
}

export type OrderItem = OrderItemSnapshot;

export type OrderStatus =
  | 'CONFIRMED'
  | 'PENDING_SELLER_APPROVAL'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED';

export type DeliveryMethod = 'SELLER_DELIVERY' | 'THIRD_PARTY' | 'BUYER_PICKUP';

export type MessageType = 'TEXT' | 'SYSTEM' | 'ORDER' | 'ORDER_UPDATE' | 'AI_SUGGESTION';
export type MessageDeliveryStatus = 'sending' | 'sent' | 'read' | 'failed';

export interface OrderMessage {
  id: string;
  messageId?: string;
  orderId: string;
  conversationId?: string;
  senderId?: string;
  senderRole: 'BUYER' | 'SELLER' | 'SYSTEM';
  senderName: string;
  text: string;
  timestamp: string;
  createdAt?: string;
  type?: MessageType;
  read?: boolean;
  status?: MessageDeliveryStatus;
  isSystemEvent?: boolean;
}

export interface Conversation {
  id: string;
  conversationId: string;
  orderId: string;
  buyerId: string;
  buyerName?: string;
  sellerId: string;
  sellerBusinessName?: string;
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  recipientId?: string;
  orderId?: string;
  type?: 'NEW_ORDER' | 'ORDER_ACCEPTED' | 'ORDER_REJECTED' | 'ORDER_UPDATE' | 'NEW_MESSAGE' | 'ORDER_CANCELLED';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "LC-1048"
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerLocation: LocationInfo;
  sellerId: string;
  sellerBusinessName: string;
  sellerLocation: LocationInfo;
  items: OrderItemSnapshot[];
  subtotal: number;
  deliveryFee: number;
  discountTotal: number;
  total: number;
  status: OrderStatus;
  isBillLocked: boolean;
  lockedAt?: string;
  expectedDeliveryDate?: string;
  deliveryMethod?: DeliveryMethod;
  rejectionReason?: string;
  customerNotes?: string;
  sellerNotes?: string;
  messages: OrderMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface BusinessRoomCart {
  sellerId: string;
  sellerName: string;
  items: { [productId: string]: CartItem };
}

export interface SearchFilters {
  query: string;
  category: string;
  city: string;
  area?: string;
  minPrice?: number;
  maxPrice?: number;
  maxDistanceKm?: number;
  inStockOnly?: boolean;
  sortBy: 'recommended' | 'nearest' | 'price_low' | 'price_high' | 'rating' | 'discount';
}

export interface AIChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'ai';
  text: string;
  matchedProducts?: Product[];
  sellerTips?: string[];
  createdAt: string;
}

