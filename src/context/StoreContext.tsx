import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
  SellerProfile,
  BuyerProfile,
  Product,
  Order,
  OrderStatus,
  DeliveryMethod,
  OrderItemSnapshot,
  CartItem,
  SearchFilters,
  LocationInfo,
  AppNotification,
} from '../types';
import { APP_CONFIG } from '../constants/config';
import {
  db,
  auth,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  runTransaction,
  query,
  orderBy,
  where,
} from '../services/firebase';
import { sendChatMessage } from '../services/chatService';
import { cleanupStoreStorage, deleteStorageImage } from '../services/imageStorageService';
import { logFirestoreDiag } from '../services/firestoreDiagnostic';

interface StoreContextType {
  sellerProfiles: SellerProfile[];
  buyerProfiles: BuyerProfile[];
  products: Product[];
  orders: Order[];
  notifications: AppNotification[];
  unreadNotificationCount: number;
  markNotificationAsRead: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  currentCity: string;
  setCurrentCity: (city: string) => void;
  currentArea: string;
  setCurrentArea: (area: string) => void;
  customerLocation: LocationInfo | null;
  updateCustomerLocation: (location: LocationInfo) => Promise<void>;

  // Seller operations
  getSellerById: (sellerId: string) => SellerProfile | undefined;
  getSellerBySlug: (slug: string) => SellerProfile | undefined;
  getSellerByUserId: (userId: string) => SellerProfile | undefined;
  updateSellerProfile: (profile: Partial<SellerProfile> & { id: string }) => Promise<void>;
  createSellerProfile: (profile: Omit<SellerProfile, 'id' | 'createdAt' | 'rating' | 'reviewCount' | 'isVerified'>) => Promise<SellerProfile>;
  deleteSellerStore: (sellerId: string) => Promise<void>;

  // Buyer operations
  getBuyerByUserId: (userId: string) => BuyerProfile | undefined;
  updateBuyerProfile: (profile: Partial<BuyerProfile> & { id: string }) => Promise<void>;
  createBuyerProfile: (profile: Omit<BuyerProfile, 'id' | 'createdAt' | 'favoriteSellerIds'>) => Promise<BuyerProfile>;
  toggleFavoriteSeller: (buyerId: string, sellerId: string) => Promise<void>;

  // Product CRUD
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Product>;
  updateProduct: (productId: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  toggleProductStock: (productId: string) => Promise<void>;

  // Order workflow & Bill Locking
  createOrderRequest: (params: {
    buyerId: string;
    buyerName: string;
    buyerPhone: string;
    buyerLocation: LocationInfo;
    sellerId: string;
    items: CartItem[];
    customerNotes?: string;
  }) => Promise<Order>;
  acceptOrder: (
    orderId: string,
    options?: {
      expectedDeliveryDate?: string;
      deliveryMethod?: DeliveryMethod;
      deliveryFee?: number;
      sellerNotes?: string;
    }
  ) => Promise<void>;
  rejectOrder: (orderId: string, reason?: string) => Promise<void>;
  cancelOrder: (orderId: string, reason?: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string) => Promise<void>;
  addOrderMessage: (orderId: string, senderRole: 'BUYER' | 'SELLER', senderName: string, text: string) => Promise<void>;

  // Search & Filtering
  searchProducts: (filters: SearchFilters) => Product[];
  
  // Cart management per Business Room
  activeCart: { [sellerId: string]: { [productId: string]: number } };
  addToCart: (sellerId: string, product: Product, quantity?: number) => void;
  updateCartQuantity: (sellerId: string, productId: string, delta: number) => void;
  removeFromCart: (sellerId: string, productId: string) => void;
  clearCart: (sellerId: string) => void;
  getSellerCartItems: (sellerId: string) => CartItem[];
  getSellerCartSubtotal: (sellerId: string) => number;

  // Reset demo
  resetToDemoData: () => void;

  // Cleanup & Maintenance
  purgeOrphanedProducts: () => Promise<{ purgedCount: number }>;
  deleteAllStoresAndReset: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CITY: 'localcart_current_city_v2',
  AREA: 'localcart_current_area_v2',
  CART: 'localcart_active_cart_v2'
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, updateUserLocation } = useAuth();
  const [firestoreSellers, setFirestoreSellers] = useState<SellerProfile[]>([]);
  const [firestoreBuyers, setFirestoreBuyers] = useState<BuyerProfile[]>([]);
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [firestoreOrders, setFirestoreOrders] = useState<Order[]>([]);
  const [firestoreNotifications, setFirestoreNotifications] = useState<AppNotification[]>([]);

  const [currentCity, setCurrentCity] = useState<string>(() => {
    if (currentUser?.location?.city) return currentUser.location.city;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CITY);
      if (stored) return stored;
    } catch (e) {}
    return APP_CONFIG.defaultLocation.city;
  });

  const [currentArea, setCurrentArea] = useState<string>(() => {
    if (currentUser?.location?.area) return currentUser.location.area;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.AREA);
      if (stored) return stored;
    } catch (e) {}
    return APP_CONFIG.defaultLocation.area;
  });

  // Always keep currentCity and currentArea in lockstep with the authenticated user's canonical location
  useEffect(() => {
    if (currentUser?.location?.city) {
      setCurrentCity(currentUser.location.city);
    }
    if (currentUser?.location?.area) {
      setCurrentArea(currentUser.location.area);
    }
  }, [currentUser?.location?.city, currentUser?.location?.area]);

  const handleSetCity = (city: string) => {
    setCurrentCity(city);
    try {
      localStorage.setItem(STORAGE_KEYS.CITY, city);
    } catch (_) {}
    if (currentUser) {
      updateUserLocation({
        ...(currentUser.location || {
          state: '',
          pincode: '',
          area: '',
          address: '',
        }),
        city,
      });
    }
  };

  const handleSetArea = (area: string) => {
    setCurrentArea(area);
    try {
      localStorage.setItem(STORAGE_KEYS.AREA, area);
    } catch (_) {}
    if (currentUser) {
      updateUserLocation({
        ...(currentUser.location || {
          state: '',
          pincode: '',
          city: '',
          address: '',
        }),
        area,
      });
    }
  };

  const updateCustomerLocation = async (location: LocationInfo) => {
    if (location.city) setCurrentCity(location.city);
    if (location.area) setCurrentArea(location.area);
    try {
      if (location.city) localStorage.setItem(STORAGE_KEYS.CITY, location.city);
      if (location.area) localStorage.setItem(STORAGE_KEYS.AREA, location.area);
    } catch (_) {}
    if (currentUser) {
      await updateUserLocation(location);
    }
  };

  const [activeCart, setActiveCart] = useState<{ [sellerId: string]: { [productId: string]: number } }>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CART);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {};
  });

  // 1. Subscribe to Firestore Seller Profiles in real-time
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    try {
      const colRef = collection(db, 'sellerProfiles');
      unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          const items: SellerProfile[] = [];
          snapshot.forEach((docSnap) => {
            items.push({ id: docSnap.id, ...(docSnap.data() as any) });
          });
          setFirestoreSellers(items);
        },
        (err) => {
          logFirestoreDiag({
            path: 'sellerProfiles',
            operationType: 'listener',
            currentRole: currentUser?.role || null,
            error: err,
          });
          console.warn('Firestore sellers snapshot error:', err);
        }
      );
    } catch (err) {
      logFirestoreDiag({
        path: 'sellerProfiles',
        operationType: 'listener',
        currentRole: currentUser?.role || null,
        error: err,
      });
      console.warn('Failed to listen to sellerProfiles:', err);
    }
    return () => unsubscribe();
  }, []);

  // 2. Subscribe to current Buyer Profile in real-time (authenticated buyers only)
  useEffect(() => {
    if (!currentUser?.id || currentUser.role === 'UNASSIGNED' || currentUser.role !== 'BUYER') {
      setFirestoreBuyers([]);
      return;
    }
    let unsubscribe: () => void = () => {};
    try {
      const buyerDocRef = doc(db, 'buyerProfiles', currentUser.id);
      unsubscribe = onSnapshot(
        buyerDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const profile: BuyerProfile = { id: docSnap.id, ...(docSnap.data() as any) };
            setFirestoreBuyers([profile]);
          } else {
            setFirestoreBuyers([]);
          }
        },
        (err) => {
          logFirestoreDiag({
            path: `buyerProfiles/${currentUser.id}`,
            operationType: 'listener',
            currentRole: currentUser?.role || null,
            error: err,
          });
          console.warn('Firestore buyer profile snapshot notice:', err?.message || err);
        }
      );
    } catch (err) {
      logFirestoreDiag({
        path: `buyerProfiles/${currentUser.id}`,
        operationType: 'listener',
        currentRole: currentUser?.role || null,
        error: err,
      });
      console.warn('Failed to listen to buyerProfile:', err);
    }
    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.role]);

  // 3. Subscribe to Firestore Products in real-time
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    try {
      const colRef = collection(db, 'products');
      unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          const items: Product[] = [];
          snapshot.forEach((docSnap) => {
            items.push({ id: docSnap.id, ...(docSnap.data() as any) });
          });
          setFirestoreProducts(items);
        },
        (err) => {
          logFirestoreDiag({
            path: 'products',
            operationType: 'listener',
            currentRole: currentUser?.role || null,
            error: err,
          });
          console.warn('Firestore products snapshot error:', err);
        }
      );
    } catch (err) {
      logFirestoreDiag({
        path: 'products',
        operationType: 'listener',
        currentRole: currentUser?.role || null,
        error: err,
      });
      console.warn('Failed to listen to products:', err);
    }
    return () => unsubscribe();
  }, []);

  // 4. Subscribe to Firestore Orders in real-time with role-based queries (authenticated completed-onboarding users only)
  useEffect(() => {
    if (!currentUser?.id || currentUser.role === 'UNASSIGNED' || !currentUser.onboardingCompleted) {
      setFirestoreOrders([]);
      return;
    }
    let unsubscribe: () => void = () => {};
    try {
      const isSeller = currentUser.role === 'SELLER';
      let ordersQuery;

      if (isSeller) {
        // Look up currently authenticated seller profile ID
        const sellerProfile = firestoreSellers.find(
          s => s.userId === currentUser.id || s.id === currentUser.id
        );
        const currentSellerId = sellerProfile?.id || currentUser.id;
        ordersQuery = query(
          collection(db, 'orders'),
          where('sellerId', '==', currentSellerId)
        );
      } else {
        // Buyer query: orders where buyerId == authenticated UID
        ordersQuery = query(
          collection(db, 'orders'),
          where('buyerId', '==', currentUser.id)
        );
      }

      unsubscribe = onSnapshot(
        ordersQuery,
        (snapshot) => {
          const items: Order[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            items.push({ id: docSnap.id, ...data });
          });
          // Sort newest first
          items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setFirestoreOrders(items);
        },
        (err) => {
          logFirestoreDiag({
            path: isSeller ? `orders (sellerId: ${currentUser.id})` : `orders (buyerId: ${currentUser.id})`,
            operationType: 'listener',
            currentRole: currentUser?.role || null,
            error: err,
          });
          console.warn('Firestore role-based orders snapshot notice:', err?.message || err);
        }
      );
    } catch (err) {
      logFirestoreDiag({
        path: `orders (user: ${currentUser.id})`,
        operationType: 'listener',
        currentRole: currentUser?.role || null,
        error: err,
      });
      console.warn('Failed to listen to orders:', err);
    }

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.role, currentUser?.onboardingCompleted, firestoreSellers]);

  // 5. Subscribe to Notifications in real-time (authenticated users only)
  useEffect(() => {
    if (!currentUser?.id || currentUser.role === 'UNASSIGNED') {
      setFirestoreNotifications([]);
      return;
    }
    let unsubscribe: () => void = () => {};
    try {
      const notifQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.id)
      );
      unsubscribe = onSnapshot(
        notifQuery,
        (snapshot) => {
          const notifs: AppNotification[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            notifs.push({
              id: docSnap.id,
              userId: data.userId || currentUser.id,
              recipientId: data.recipientId || data.userId || currentUser.id,
              orderId: data.orderId,
              type: data.type,
              title: data.title || 'Notification',
              message: data.message || '',
              read: data.read ?? false,
              createdAt: data.createdAt || new Date().toISOString(),
            });
          });
          notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setFirestoreNotifications(notifs);
        },
        (err) => {
          logFirestoreDiag({
            path: `notifications?userId==${currentUser.id}`,
            operationType: 'listener',
            currentRole: currentUser?.role || null,
            error: err,
          });
          console.warn('Notifications snapshot notice:', err?.message || err);
        }
      );
    } catch (err) {
      logFirestoreDiag({
        path: `notifications?userId==${currentUser.id}`,
        operationType: 'listener',
        currentRole: currentUser?.role || null,
        error: err,
      });
      console.warn('Failed to listen to notifications:', err);
    }
    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.role]);

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(activeCart));
    } catch (e) {}
  }, [activeCart]);

  const sellerProfiles = React.useMemo(() => firestoreSellers, [firestoreSellers]);
  const buyerProfiles = React.useMemo(() => firestoreBuyers, [firestoreBuyers]);

  // Data Integrity Guarantee: Every product shown in buyer search/discovery MUST belong to an active existing store.
  // Orphaned products (where the seller was deleted or does not exist) are strictly filtered out across all views!
  const activeSellerIds = React.useMemo(() => {
    const ids = new Set<string>();
    firestoreSellers.forEach(s => {
      if (s.id) ids.add(s.id);
      if (s.userId) ids.add(s.userId);
    });
    return ids;
  }, [firestoreSellers]);

  const products = React.useMemo(() => {
    return firestoreProducts.filter(p => p.sellerId && activeSellerIds.has(p.sellerId));
  }, [firestoreProducts, activeSellerIds]);

  const orders = React.useMemo(() => firestoreOrders, [firestoreOrders]);
  const notifications = React.useMemo(() => firestoreNotifications, [firestoreNotifications]);

  // Automated Orphan Product Cleanup (deduplicated to avoid redundant network overhead):
  const cleanedProductIdsRef = React.useRef<Set<string>>(new Set());
  useEffect(() => {
    if (firestoreSellers.length > 0 && firestoreProducts.length > 0) {
      const activeIds = new Set<string>();
      firestoreSellers.forEach(s => {
        if (s.id) activeIds.add(s.id);
        if (s.userId) activeIds.add(s.userId);
      });
      const orphaned = firestoreProducts.filter(p => (!p.sellerId || !activeIds.has(p.sellerId)) && !cleanedProductIdsRef.current.has(p.id));
      if (orphaned.length > 0) {
        orphaned.forEach((p) => {
          cleanedProductIdsRef.current.add(p.id);
          deleteDoc(doc(db, 'products', p.id)).catch(() => {});
        });
      }
    }
  }, [firestoreSellers, firestoreProducts]);

  const unreadNotificationCount = React.useMemo(() => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return 0;
    return firestoreNotifications.filter(
      (n) => (n.userId === currentUid || n.recipientId === currentUid) && !n.read
    ).length;
  }, [firestoreNotifications]);

  const markNotificationAsRead = async (id: string) => {
    try {
      const notifRef = doc(db, 'notifications', id);
      await updateDoc(notifRef, { read: true });
    } catch (err) {
      setFirestoreNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  const clearAllNotifications = async () => {
    setFirestoreNotifications([]);
  };

  // Fast Map lookups for sub-millisecond query performance
  const sellerMap = React.useMemo(() => {
    const map = new Map<string, SellerProfile>();
    sellerProfiles.forEach(s => {
      if (s.id) map.set(s.id, s);
      if (s.userId) map.set(s.userId, s);
    });
    return map;
  }, [sellerProfiles]);

  const productMap = React.useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => {
      if (p.id) map.set(p.id, p);
    });
    return map;
  }, [products]);

  // Seller lookups
  const getSellerById = React.useCallback(
    (sellerId: string) => sellerMap.get(sellerId),
    [sellerMap]
  );
  const getSellerBySlug = React.useCallback(
    (slug: string) => sellerProfiles.find(s => s.businessSlug === slug || s.id === slug),
    [sellerProfiles]
  );
  const getSellerByUserId = React.useCallback(
    (userId: string) => sellerProfiles.find(s => s.userId === userId),
    [sellerProfiles]
  );

  // Buyer lookups
  const getBuyerByUserId = React.useCallback(
    (userId: string) => buyerProfiles.find(b => b.userId === userId),
    [buyerProfiles]
  );

  const updateSellerProfile = async (updates: Partial<SellerProfile> & { id: string }) => {
    const { id, ...cleanUpdates } = updates;
    const targetDocId = id;

    // Optimistically update local state immediately so UI updates in 0ms without requiring page refresh
    setFirestoreSellers(prev =>
      prev.map(s => (s.id === targetDocId || s.userId === targetDocId ? { ...s, ...cleanUpdates } : s))
    );

    const docRef = doc(db, 'sellerProfiles', targetDocId);
    const payload = { ...cleanUpdates, updatedAt: new Date().toISOString() };

    try {
      await updateDoc(docRef, payload);
    } catch (err: any) {
      console.warn('Firestore updateDoc failed, attempting setDoc with merge:', err?.message || err);
      try {
        await setDoc(docRef, payload, { merge: true });
      } catch (mergeErr: any) {
        logFirestoreDiag({
          path: `sellerProfiles/${targetDocId}`,
          operationType: 'update',
          currentRole: currentUser?.role || null,
          error: mergeErr,
        });
        console.error('Firestore updateSellerProfile fatal error:', mergeErr);
        throw mergeErr;
      }
    }
  };

  const createSellerProfile = async (
    profileData: Omit<SellerProfile, 'id' | 'createdAt' | 'rating' | 'reviewCount' | 'isVerified'>
  ): Promise<SellerProfile> => {
    const sellerId = `seller-${Date.now()}`;
    const newProfile: SellerProfile = {
      ...profileData,
      id: sellerId,
      rating: 5.0,
      reviewCount: 1,
      isVerified: true,
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = doc(db, 'sellerProfiles', sellerId);
      await setDoc(docRef, newProfile);
    } catch (err) {
      console.warn('Firestore createSellerProfile error, updating local state:', err);
      setFirestoreSellers(prev => [...prev, newProfile]);
    }
    return newProfile;
  };

  const deleteSellerStore = async (sellerId: string) => {
    // 1. Locate the seller
    const seller = sellerProfiles.find(s => s.id === sellerId || s.userId === sellerId);
    const currentUid = auth.currentUser?.uid;

    if (!currentUid) {
      throw new Error('Please sign in to delete your store.');
    }

    // Permission check: Verify ownership (UID match) before allowing deletion
    if (seller && seller.userId && seller.userId !== currentUid) {
      throw new Error('Permission denied. You can only delete your own store.');
    }

    const targetSellerId = seller ? seller.id : sellerId;
    const targetUserId = seller?.userId || currentUid;
    const targetBusinessName = seller?.businessName;

    // 2. Immediately update local state so UI updates in real-time
    setFirestoreSellers(prev => prev.filter(s => s.id !== targetSellerId && s.userId !== targetUserId));
    setFirestoreProducts(prev => prev.filter(p => p.sellerId !== targetSellerId && p.sellerId !== targetUserId));
    
    // Clear active cart for this seller
    clearCart(targetSellerId);
    if (targetUserId && targetUserId !== targetSellerId) {
      clearCart(targetUserId);
    }

    // 3. Query all products belonging to this seller from Firestore
    const productsToDelete = new Set<string>();

    try {
      const qSeller = query(collection(db, 'products'), where('sellerId', '==', targetSellerId));
      const snapSeller = await getDocs(qSeller);
      snapSeller.forEach(d => productsToDelete.add(d.id));
    } catch (e) {
      console.warn('Error querying products by sellerId:', e);
    }

    if (targetUserId && targetUserId !== targetSellerId) {
      try {
        const qUser = query(collection(db, 'products'), where('sellerId', '==', targetUserId));
        const snapUser = await getDocs(qUser);
        snapUser.forEach(d => productsToDelete.add(d.id));
      } catch (e) {
        console.warn('Error querying products by userId:', e);
      }
    }

    // Also include any product in memory matching seller ID or businessName
    firestoreProducts.forEach(p => {
      if (p.sellerId === targetSellerId || p.sellerId === targetUserId || (targetBusinessName && p.businessName === targetBusinessName)) {
        productsToDelete.add(p.id);
      }
    });

    // 4. Delete all matching products from Firestore and storage
    for (const prodId of productsToDelete) {
      try {
        const prod = firestoreProducts.find(p => p.id === prodId);
        if (prod?.imageUrl) {
          deleteStorageImage(prod.imageUrl).catch(() => {});
        }
        await deleteDoc(doc(db, 'products', prodId));
      } catch (e) {
        console.warn(`Error deleting product ${prodId} from Firestore:`, e);
      }
    }

    // Clean up store assets in Firebase Storage
    try {
      await cleanupStoreStorage(targetSellerId);
    } catch (e) {
      console.warn('Notice during store storage cleanup:', e);
    }

    // 5. Delete the sellerProfile document from Firestore
    try {
      await deleteDoc(doc(db, 'sellerProfiles', targetSellerId));
    } catch (e) {
      console.error('Error deleting sellerProfile doc from Firestore:', e);
      if (targetUserId && targetUserId !== targetSellerId) {
        try {
          await deleteDoc(doc(db, 'sellerProfiles', targetUserId));
        } catch (_) {}
      }
      throw e;
    }

    // 6. Update user role in Firestore users/{targetUserId} to 'buyer'
    if (targetUserId) {
      try {
        const userDocRef = doc(db, 'users', targetUserId);
        await updateDoc(userDocRef, {
          role: 'buyer',
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Notice updating user role in users collection:', e);
      }
    }

    // 7. Remove from any buyer's favorite sellers in state
    setFirestoreBuyers(prev =>
      prev.map(b => ({
        ...b,
        favoriteSellerIds: (b.favoriteSellerIds || []).filter(id => id !== targetSellerId && id !== targetUserId),
      }))
    );
  };

  // Utility to purge orphaned products (products without an active store in sellerProfiles)
  const purgeOrphanedProducts = async (): Promise<{ purgedCount: number }> => {
    let purgedCount = 0;
    try {
      const activeIds = new Set<string>();
      firestoreSellers.forEach(s => {
        if (s.id) activeIds.add(s.id);
        if (s.userId) activeIds.add(s.userId);
      });

      const snap = await getDocs(collection(db, 'products'));
      const toDelete: string[] = [];

      snap.forEach(docSnap => {
        const data = docSnap.data() as any;
        if (!data.sellerId || !activeIds.has(data.sellerId)) {
          toDelete.push(docSnap.id);
        }
      });

      for (const pId of toDelete) {
        try {
          await deleteDoc(doc(db, 'products', pId));
          purgedCount++;
        } catch (e) {
          console.warn(`Error purging orphaned product ${pId}:`, e);
        }
      }

      if (purgedCount > 0) {
        setFirestoreProducts(prev => prev.filter(p => !toDelete.includes(p.id)));
      }
    } catch (err) {
      console.error('Error during purgeOrphanedProducts:', err);
    }
    return { purgedCount };
  };

  // Complete clean reset: deletes all stores and products in Firestore, cleans local storage & resets user role
  const deleteAllStoresAndReset = async (): Promise<void> => {
    try {
      // 1. Delete all products
      const prodSnap = await getDocs(collection(db, 'products'));
      for (const d of prodSnap.docs) {
        try {
          await deleteDoc(doc(db, 'products', d.id));
        } catch (e) {}
      }

      // 2. Delete all seller profiles
      const sellerSnap = await getDocs(collection(db, 'sellerProfiles'));
      for (const d of sellerSnap.docs) {
        try {
          await deleteDoc(doc(db, 'sellerProfiles', d.id));
        } catch (e) {}
      }

      // 3. Reset current user's role to 'buyer' in Firestore
      const currentUid = auth.currentUser?.uid;
      if (currentUid) {
        try {
          await updateDoc(doc(db, 'users', currentUid), {
            role: 'buyer',
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {}
      }

      // 4. Reset in-memory state & local storage
      setFirestoreSellers([]);
      setFirestoreProducts([]);
      setActiveCart({});
      localStorage.removeItem(STORAGE_KEYS.CART);
    } catch (err) {
      console.error('Error during deleteAllStoresAndReset:', err);
      throw err;
    }
  };

  const updateBuyerProfile = async (updates: Partial<BuyerProfile> & { id: string }) => {
    try {
      const docRef = doc(db, 'buyerProfiles', updates.id);
      await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.warn('Firestore updateBuyerProfile fallback to local state:', err);
      setFirestoreBuyers(prev =>
        prev.map(b => (b.id === updates.id ? { ...b, ...updates } : b))
      );
    }
  };

  const createBuyerProfile = async (
    profileData: Omit<BuyerProfile, 'id' | 'createdAt' | 'favoriteSellerIds'>
  ): Promise<BuyerProfile> => {
    const buyerId = `buyer-${Date.now()}`;
    const newProfile: BuyerProfile = {
      ...profileData,
      id: buyerId,
      favoriteSellerIds: [],
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = doc(db, 'buyerProfiles', buyerId);
      await setDoc(docRef, newProfile);
    } catch (err) {
      console.warn('Firestore createBuyerProfile error, updating local state:', err);
      setFirestoreBuyers(prev => [...prev, newProfile]);
    }
    return newProfile;
  };

  const toggleFavoriteSeller = async (buyerId: string, sellerId: string) => {
    const buyer = buyerProfiles.find(b => b.id === buyerId || b.userId === buyerId);
    if (!buyer) return;
    const exists = buyer.favoriteSellerIds?.includes(sellerId) || false;
    const updatedFavorites = exists
      ? buyer.favoriteSellerIds.filter(id => id !== sellerId)
      : [...(buyer.favoriteSellerIds || []), sellerId];

    try {
      const docRef = doc(db, 'buyerProfiles', buyer.id);
      await updateDoc(docRef, { favoriteSellerIds: updatedFavorites });
    } catch (err) {
      console.warn('Firestore toggleFavoriteSeller error:', err);
      setFirestoreBuyers(prev =>
        prev.map(b => (b.id === buyer.id ? { ...b, favoriteSellerIds: updatedFavorites } : b))
      );
    }
  };

  // Product CRUD
  const addProduct = async (
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Product> => {
    const finalPrice = Math.round(
      productData.originalPrice * (1 - (productData.discountPercent || 0) / 100)
    );
    const prodId = `prod-${Date.now()}`;
    const newProduct: Product = {
      ...productData,
      id: prodId,
      finalPrice: isNaN(finalPrice) ? productData.originalPrice : finalPrice,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Immediate optimistic update
    setFirestoreProducts(prev => [newProduct, ...prev.filter(p => p.id !== prodId)]);

    try {
      const docRef = doc(db, 'products', prodId);
      await setDoc(docRef, newProduct);
    } catch (err) {
      console.warn('Firestore addProduct error, retained in local state:', err);
    }
    return newProduct;
  };

  const updateProduct = async (productId: string, updates: Partial<Product>) => {
    const current = products.find(p => p.id === productId);
    if (!current) return;

    // Security check: Only the owning seller may update their products
    const currentUid = auth.currentUser?.uid;
    const seller = sellerProfiles.find(s => s.id === current.sellerId || s.userId === current.sellerId);
    if (!currentUid || (seller && seller.userId && seller.userId !== currentUid)) {
      console.warn('Product security notice: Only the owning seller can edit this product.');
      return;
    }

    const originalPrice = updates.originalPrice ?? current.originalPrice ?? 0;
    const discountPercent = updates.discountPercent ?? current.discountPercent ?? 0;
    const calculatedFinal = Math.round(originalPrice * (1 - (discountPercent || 0) / 100));
    const safeStock = Math.max(0, updates.stockQuantity ?? current.stockQuantity ?? 0);

    // Whitelist only seller-controlled editable fields; prevent tampering with sellerId
    const safeUpdates: Partial<Product> = {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.category !== undefined && { category: updates.category }),
      originalPrice,
      discountPercent,
      finalPrice: calculatedFinal,
      stockQuantity: safeStock,
      inStock: safeStock > 0 ? (updates.inStock ?? current.inStock) : false,
      ...(updates.lowStockThreshold !== undefined && { lowStockThreshold: Math.max(0, updates.lowStockThreshold) }),
      ...(updates.imageUrl !== undefined && { imageUrl: updates.imageUrl }),
      ...(updates.images !== undefined && { images: updates.images }),
      ...(updates.preparationTime !== undefined && { preparationTime: updates.preparationTime }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
      updatedAt: new Date().toISOString()
    };

    // Immediate optimistic update
    setFirestoreProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, ...safeUpdates } : p))
    );

    try {
      const docRef = doc(db, 'products', productId);
      await updateDoc(docRef, safeUpdates);
    } catch (err) {
      console.warn('Firestore updateProduct fallback:', err);
    }
  };

  const deleteProduct = async (productId: string) => {
    const target = products.find(p => p.id === productId);
    if (!target) return;

    // Security check: Only the owning seller may delete their products
    const currentUid = auth.currentUser?.uid;
    const seller = sellerProfiles.find(s => s.id === target.sellerId || s.userId === target.sellerId);
    if (!currentUid || (seller && seller.userId && seller.userId !== currentUid)) {
      console.warn('Product security notice: Only the owning seller can delete this product.');
      return;
    }

    if (target.imageUrl) {
      deleteStorageImage(target.imageUrl).catch(() => {});
    }

    // Immediate optimistic update
    setFirestoreProducts(prev => prev.filter(p => p.id !== productId));

    try {
      const docRef = doc(db, 'products', productId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Firestore deleteProduct fallback:', err);
    }
  };

  const toggleProductStock = async (productId: string) => {
    const target = products.find(p => p.id === productId);
    if (!target) return;

    // Security check: Only the owning seller may toggle product stock
    const currentUid = auth.currentUser?.uid;
    const seller = sellerProfiles.find(s => s.id === target.sellerId || s.userId === target.sellerId);
    if (!currentUid || (seller && seller.userId && seller.userId !== currentUid)) {
      console.warn('Product security notice: Only the owning seller can toggle product stock.');
      return;
    }

    const updatedStock = !target.inStock;
    const nowIso = new Date().toISOString();

    // Immediate optimistic update
    setFirestoreProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, inStock: updatedStock, updatedAt: nowIso } : p))
    );

    try {
      const docRef = doc(db, 'products', productId);
      await updateDoc(docRef, { inStock: updatedStock, updatedAt: nowIso });
    } catch (err) {
      console.warn('Firestore toggleProductStock fallback:', err);
    }
  };

  // Order workflow & Bill Locking via trusted Server-Side API
  const createOrderRequest = async (params: {
    buyerId: string;
    buyerName: string;
    buyerPhone: string;
    buyerLocation: LocationInfo;
    sellerId: string;
    items: CartItem[];
    customerNotes?: string;
  }): Promise<Order> => {
    const seller = getSellerById(params.sellerId);
    if (!seller) throw new Error('Seller store not found.');

    if (seller.userId === params.buyerId) {
      throw new Error('Sellers cannot purchase products from their own storefront. Please switch to a buyer account.');
    }

    if (!params.items || params.items.length === 0) {
      throw new Error('Cannot create an order with an empty bag.');
    }

    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error('Authentication required. Please sign in to place an order.');
    }

    const idempotencyKey = `req-${params.buyerId}-${params.sellerId}-${Date.now()}`;

    const res = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        idempotencyKey,
        sellerId: params.sellerId,
        items: params.items.map(ci => ({
          productId: ci.product.id,
          quantity: ci.quantity,
        })),
        buyerName: params.buyerName,
        buyerPhone: params.buyerPhone,
        buyerLocation: params.buyerLocation,
        customerNotes: params.customerNotes || '',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to process order checkout on the server.');
    }

    const createdOrder: Order = data.order;

    // Optimistically record the returned created order in local state
    setFirestoreOrders(prev => [createdOrder, ...prev.filter(o => o.id !== createdOrder.id)]);

    // Clear cart for this seller
    clearCart(params.sellerId);

    return createdOrder;
  };

  const acceptOrder = async (
    orderId: string,
    options?: {
      expectedDeliveryDate?: string;
      deliveryMethod?: DeliveryMethod;
      deliveryFee?: number;
      sellerNotes?: string;
    }
  ) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const effectiveDeliveryFee = options?.deliveryFee !== undefined ? options.deliveryFee : order.deliveryFee;
    const lockedTotal = order.subtotal + effectiveDeliveryFee;
    const nowIso = new Date().toISOString();
    const systemText = `Order accepted by ${order.sellerBusinessName}! Final bill locked at ₹${lockedTotal}. Status: ACCEPTED.`;

    const updatedOrder: Order = {
      ...order,
      status: 'ACCEPTED',
      isBillLocked: true, // IMMUTABLE FINAL BILL LOCKED
      lockedAt: nowIso,
      deliveryFee: effectiveDeliveryFee,
      total: lockedTotal,
      expectedDeliveryDate: options?.expectedDeliveryDate || order.expectedDeliveryDate || '',
      deliveryMethod: options?.deliveryMethod || 'SELLER_DELIVERY',
      sellerNotes: options?.sellerNotes || order.sellerNotes || '',
      updatedAt: nowIso,
      messages: [
        ...order.messages,
        {
          id: `msg-${Date.now()}`,
          orderId: order.id,
          senderRole: 'SYSTEM',
          senderName: 'LocalCart System',
          text: systemText,
          timestamp: nowIso,
          isSystemEvent: true,
        },
      ],
    };

    // Immediate optimistic update
    setFirestoreOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));

    try {
      const docRef = doc(db, 'orders', orderId);
      await setDoc(docRef, updatedOrder, { merge: true });

      // Add system message to conversations/{orderId}/messages
      await sendChatMessage({
        orderId,
        senderId: 'system',
        senderRole: 'SYSTEM',
        senderName: 'LocalCart System',
        text: systemText,
        type: 'ORDER_UPDATE',
      }).catch(() => {});

      // Notify Buyer
      const notifRef = doc(db, 'notifications', `notif-${Date.now()}`);
      await setDoc(notifRef, {
        id: notifRef.id,
        userId: order.buyerId,
        recipientId: order.buyerId,
        orderId,
        type: 'ORDER_ACCEPTED',
        title: 'Order Accepted & Bill Locked',
        message: `Your order #${order.orderNumber} was authorized by ${order.sellerBusinessName}. Final bill locked at ₹${lockedTotal}.`,
        read: false,
        createdAt: nowIso,
      });
    } catch (err) {
      console.warn('Firestore acceptOrder fallback:', err);
    }
  };

  const rejectOrder = async (orderId: string, reason?: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const nowIso = new Date().toISOString();
    const systemText = `Order request was rejected by seller${reason ? `: "${reason}"` : '.'}`;

    const updatedOrder: Order = {
      ...order,
      status: 'REJECTED',
      rejectionReason: reason || 'Seller is unable to fulfill this order request at this time.',
      updatedAt: nowIso,
      messages: [
        ...order.messages,
        {
          id: `msg-${Date.now()}`,
          orderId: order.id,
          senderRole: 'SYSTEM',
          senderName: 'LocalCart System',
          text: systemText,
          timestamp: nowIso,
          isSystemEvent: true,
        },
      ],
    };

    // Immediate optimistic update for order & restock products
    setFirestoreOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));
    setFirestoreProducts(prev =>
      prev.map(p => {
        const itemToRestock = order.items.find(i => i.productId === p.id);
        if (itemToRestock) {
          const newQty = (p.stockQuantity || 0) + itemToRestock.quantity;
          return { ...p, stockQuantity: newQty, inStock: true, updatedAt: nowIso };
        }
        return p;
      })
    );

    try {
      // Restock atomically in Firestore
      await runTransaction(db, async transaction => {
        for (const item of order.items) {
          const prodRef = doc(db, 'products', item.productId);
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists()) {
            const data = prodSnap.data();
            const currentStock = typeof data.stockQuantity === 'number' ? data.stockQuantity : 0;
            const restoredStock = currentStock + item.quantity;
            transaction.update(prodRef, {
              stockQuantity: restoredStock,
              inStock: true,
              updatedAt: nowIso,
            });
          }
        }

        const docRef = doc(db, 'orders', orderId);
        transaction.set(docRef, updatedOrder, { merge: true });

        const notifRef = doc(db, 'notifications', `notif-${Date.now()}`);
        transaction.set(notifRef, {
          id: notifRef.id,
          userId: order.buyerId,
          recipientId: order.buyerId,
          orderId,
          type: 'ORDER_REJECTED',
          title: 'Order Request Declined',
          message: `Your order request #${order.orderNumber} was declined by ${order.sellerBusinessName}.${reason ? ` Reason: ${reason}` : ''}`,
          read: false,
          createdAt: nowIso,
        });
      });

      // System message to chat
      await sendChatMessage({
        orderId,
        senderId: 'system',
        senderRole: 'SYSTEM',
        senderName: 'LocalCart System',
        text: systemText,
        type: 'ORDER_UPDATE',
      }).catch(() => {});
    } catch (err) {
      console.warn('Firestore rejectOrder transaction fallback:', err);
      const docRef = doc(db, 'orders', orderId);
      await setDoc(docRef, updatedOrder, { merge: true }).catch(() => {});
    }
  };

  const cancelOrder = async (orderId: string, reason?: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Buyer cancellation policy: only allowed before PREPARING
    if (
      order.status === 'PREPARING' ||
      order.status === 'READY' ||
      order.status === 'OUT_FOR_DELIVERY' ||
      order.status === 'DELIVERED'
    ) {
      throw new Error('This order is already in production or transit and can no longer be cancelled.');
    }

    const nowIso = new Date().toISOString();
    const systemText = `Order was cancelled by the buyer${reason ? `: "${reason}"` : '.'}`;

    const updatedOrder: Order = {
      ...order,
      status: 'CANCELLED',
      updatedAt: nowIso,
      messages: [
        ...order.messages,
        {
          id: `msg-${Date.now()}`,
          orderId: order.id,
          senderRole: 'SYSTEM',
          senderName: 'LocalCart System',
          text: systemText,
          timestamp: nowIso,
          isSystemEvent: true,
        },
      ],
    };

    // Immediate optimistic update for order & restock products
    setFirestoreOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));
    setFirestoreProducts(prev =>
      prev.map(p => {
        const itemToRestock = order.items.find(i => i.productId === p.id);
        if (itemToRestock) {
          const newQty = (p.stockQuantity || 0) + itemToRestock.quantity;
          return { ...p, stockQuantity: newQty, inStock: true, updatedAt: nowIso };
        }
        return p;
      })
    );

    try {
      // Restock items atomically on cancellation
      await runTransaction(db, async transaction => {
        for (const item of order.items) {
          const prodRef = doc(db, 'products', item.productId);
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists()) {
            const data = prodSnap.data();
            const currentStock = typeof data.stockQuantity === 'number' ? data.stockQuantity : 0;
            const restoredStock = currentStock + item.quantity;
            transaction.update(prodRef, {
              stockQuantity: restoredStock,
              inStock: true,
              updatedAt: nowIso,
            });
          }
        }

        const docRef = doc(db, 'orders', orderId);
        transaction.set(docRef, updatedOrder, { merge: true });

        const seller = getSellerById(order.sellerId);
        if (seller) {
          const notifRef = doc(db, 'notifications', `notif-${Date.now()}`);
          transaction.set(notifRef, {
            id: notifRef.id,
            userId: seller.userId || seller.id,
            recipientId: seller.userId || seller.id,
            orderId,
            type: 'ORDER_CANCELLED',
            title: 'Order Cancelled by Buyer',
            message: `Order #${order.orderNumber} was cancelled by the buyer.`,
            read: false,
            createdAt: nowIso,
          });
        }
      });

      await sendChatMessage({
        orderId,
        senderId: 'system',
        senderRole: 'SYSTEM',
        senderName: 'LocalCart System',
        text: systemText,
        type: 'ORDER_UPDATE',
      }).catch(() => {});
    } catch (err) {
      console.warn('Firestore cancelOrder fallback:', err);
      const docRef = doc(db, 'orders', orderId);
      await setDoc(docRef, updatedOrder, { merge: true }).catch(() => {});
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus, note?: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const statusLabels: Record<OrderStatus, string> = {
      CONFIRMED: 'Confirmed Order',
      PENDING_SELLER_APPROVAL: 'Confirmed Order',
      ACCEPTED: 'Confirmed (Bill Locked)',
      PREPARING: 'Preparing / In Production',
      READY: 'Ready for Dispatch / Delivery',
      READY_FOR_DELIVERY: 'Ready for Dispatch / Delivery',
      OUT_FOR_DELIVERY: 'Out for Delivery',
      DELIVERED: 'Delivered',
      REJECTED: 'Declined',
      CANCELLED: 'Cancelled'
    };

    const nowIso = new Date().toISOString();
    const systemText = `Order status updated to: ${statusLabels[status]}${note ? ` - ${note}` : ''}`;

    const newMsg = {
      id: `msg-${Date.now()}`,
      orderId: order.id,
      senderRole: 'SYSTEM' as const,
      senderName: 'LocalCart System',
      text: systemText,
      timestamp: nowIso,
      isSystemEvent: true
    };

    const updatedOrder: Order = {
      ...order,
      status,
      updatedAt: nowIso,
      messages: [...order.messages, newMsg]
    };

    // 1. Immediate optimistic local update so UI reflects the new state instantly
    setFirestoreOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));

    try {
      const docRef = doc(db, 'orders', orderId);
      await setDoc(docRef, updatedOrder, { merge: true });

      // Add to conversations
      await sendChatMessage({
        orderId,
        senderId: 'system',
        senderRole: 'SYSTEM',
        senderName: 'LocalCart System',
        text: systemText,
        type: 'ORDER_UPDATE',
      }).catch(() => {});

      // Notify Buyer
      const notifRef = doc(db, 'notifications', `notif-${Date.now()}`);
      await setDoc(notifRef, {
        id: notifRef.id,
        userId: order.buyerId,
        recipientId: order.buyerId,
        orderId,
        type: 'ORDER_UPDATE',
        title: `Order Status: ${statusLabels[status]}`,
        message: `Your order #${order.orderNumber} from ${order.sellerBusinessName} is now ${statusLabels[status]}.`,
        read: false,
        createdAt: nowIso,
      });
    } catch (err) {
      console.warn('Firestore updateOrderStatus fallback:', err);
    }
  };

  const addOrderMessage = async (
    orderId: string,
    senderRole: 'BUYER' | 'SELLER',
    senderName: string,
    text: string
  ) => {
    if (!text.trim()) return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const recipientId = senderRole === 'BUYER' ? (getSellerById(order.sellerId)?.userId || order.sellerId) : order.buyerId;
    const currentUid = auth.currentUser?.uid || (senderRole === 'BUYER' ? order.buyerId : order.sellerId);
    const nowIso = new Date().toISOString();

    const msg = {
      id: `msg-${Date.now()}`,
      orderId: order.id,
      senderRole,
      senderName,
      text: text.trim(),
      timestamp: nowIso
    };

    const updatedOrder: Order = {
      ...order,
      updatedAt: nowIso,
      messages: [...order.messages, msg]
    };

    // Immediate optimistic update
    setFirestoreOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));

    // Call direct Firestore chat service
    await sendChatMessage({
      orderId,
      senderId: currentUid,
      senderRole,
      senderName,
      text,
      type: 'TEXT',
      recipientId,
    }).catch(err => {
      console.warn('sendChatMessage notice:', err);
    });

    try {
      const docRef = doc(db, 'orders', orderId);
      await setDoc(docRef, updatedOrder, { merge: true });
    } catch (err) {
      console.warn('Firestore addOrderMessage fallback:', err);
    }
  };

  // Cart operations with Stock Limit Enforcements & Auth Gating
  const addToCart = (sellerId: string, product: Product, quantity = 1) => {
    // Unauthenticated users cannot add items to cart (enforced at business logic level)
    if (!currentUser) {
      console.warn('[StoreContext] Authentication required to add items to cart.');
      return;
    }

    // Check available stock
    const availableStock = typeof product.stockQuantity === 'number' ? product.stockQuantity : 0;
    if (availableStock <= 0) return;

    setActiveCart(prev => {
      const sellerCart = prev[sellerId] || {};
      const currentQty = sellerCart[product.id] || 0;
      const targetQty = Math.min(availableStock, currentQty + quantity);
      return {
        ...prev,
        [sellerId]: {
          ...sellerCart,
          [product.id]: targetQty,
        },
      };
    });
  };

  const updateCartQuantity = (sellerId: string, productId: string, delta: number) => {
    if (!currentUser) return;
    const product = products.find(p => p.id === productId);
    const availableStock = product ? (typeof product.stockQuantity === 'number' ? product.stockQuantity : 999) : 999;

    setActiveCart(prev => {
      const sellerCart = prev[sellerId] || {};
      const currentQty = sellerCart[productId] || 0;
      let newQty = currentQty + delta;

      if (newQty > availableStock) {
        newQty = availableStock;
      }

      if (newQty <= 0) {
        const nextCart = { ...sellerCart };
        delete nextCart[productId];
        return { ...prev, [sellerId]: nextCart };
      }
      return {
        ...prev,
        [sellerId]: {
          ...sellerCart,
          [productId]: newQty,
        },
      };
    });
  };

  const removeFromCart = (sellerId: string, productId: string) => {
    setActiveCart(prev => {
      const sellerCart = prev[sellerId] || {};
      const nextCart = { ...sellerCart };
      delete nextCart[productId];
      return { ...prev, [sellerId]: nextCart };
    });
  };

  const clearCart = (sellerId: string) => {
    setActiveCart(prev => {
      const next = { ...prev };
      delete next[sellerId];
      return next;
    });
  };

  const getSellerCartItems = React.useCallback((sellerId: string): CartItem[] => {
    const sellerCart = activeCart[sellerId] || {};
    const items: CartItem[] = [];
    Object.entries(sellerCart).forEach(([prodId, qty]) => {
      const quantity = qty as number;
      const prod = productMap.get(prodId);
      if (prod && quantity > 0) {
        items.push({ product: prod, quantity });
      }
    });
    return items;
  }, [activeCart, productMap]);

  const getSellerCartSubtotal = React.useCallback((sellerId: string): number => {
    const items = getSellerCartItems(sellerId);
    return items.reduce((sum, item) => sum + item.product.finalPrice * item.quantity, 0);
  }, [getSellerCartItems]);

  // Search and discovery grounded in real database products
  const searchProducts = React.useCallback((filters: SearchFilters): Product[] => {
    const q = filters.query.toLowerCase().trim();

    return products.filter(p => {
      if (filters.inStockOnly && !p.inStock) return false;
      if (filters.category && filters.category !== 'all' && p.category.toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }
      if (filters.minPrice !== undefined && filters.minPrice >= 0 && p.finalPrice < filters.minPrice) return false;
      if (filters.maxPrice !== undefined && filters.maxPrice >= 0 && p.finalPrice > filters.maxPrice) return false;

      if (q) {
        const seller = sellerMap.get(p.sellerId);
        const searchableText = `${p.name} ${p.description} ${p.category} ${(p.tags || []).join(' ')} ${p.businessName} ${seller?.businessDescription || ''}`.toLowerCase();
        return searchableText.includes(q);
      }

      return true;
    }).sort((a, b) => {
      if (filters.sortBy === 'price_low') return a.finalPrice - b.finalPrice;
      if (filters.sortBy === 'price_high') return b.finalPrice - a.finalPrice;
      if (filters.sortBy === 'discount') return (b.discountPercent || 0) - (a.discountPercent || 0);
      if (filters.sortBy === 'rating') {
        const sellerA = sellerMap.get(a.sellerId);
        const sellerB = sellerMap.get(b.sellerId);
        return (sellerB?.rating || 0) - (sellerA?.rating || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [products, sellerMap]);

  const resetToDemoData = () => {
    setFirestoreSellers([]);
    setFirestoreBuyers([]);
    setFirestoreProducts([]);
    setFirestoreOrders([]);
    setActiveCart({});
    setCurrentCity(APP_CONFIG.defaultLocation.city);
    setCurrentArea(APP_CONFIG.defaultLocation.area);
    localStorage.removeItem(STORAGE_KEYS.CART);
  };

  return (
    <StoreContext.Provider
      value={{
        sellerProfiles,
        buyerProfiles,
        products,
        orders,
        notifications,
        unreadNotificationCount,
        markNotificationAsRead,
        clearAllNotifications,
        currentCity,
        setCurrentCity: handleSetCity,
        currentArea,
        setCurrentArea: handleSetArea,
        customerLocation: currentUser?.location || null,
        updateCustomerLocation,
        getSellerById,
        getSellerBySlug,
        getSellerByUserId,
        updateSellerProfile,
        createSellerProfile,
        deleteSellerStore,
        getBuyerByUserId,
        updateBuyerProfile,
        createBuyerProfile,
        toggleFavoriteSeller,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductStock,
        createOrderRequest,
        acceptOrder,
        rejectOrder,
        cancelOrder,
        updateOrderStatus,
        addOrderMessage,
        searchProducts,
        activeCart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        getSellerCartItems,
        getSellerCartSubtotal,
        resetToDemoData,
        purgeOrphanedProducts,
        deleteAllStoresAndReset,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
