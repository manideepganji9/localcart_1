import { User, SellerProfile, BuyerProfile, Product, Order } from '../types';

/**
 * End-user production configuration.
 * All marketplace records are stored and retrieved live from Firestore.
 */
export const SEED_USERS: User[] = [];
export const SEED_SELLER_PROFILES: SellerProfile[] = [];
export const SEED_BUYER_PROFILES: BuyerProfile[] = [];
export const SEED_PRODUCTS: Product[] = [];
export const SEED_ORDERS: Order[] = [];
