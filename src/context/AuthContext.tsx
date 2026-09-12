import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, LocationInfo } from '../types';
import { APP_CONFIG } from '../constants/config';
import {
  auth,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  onAuthStateChanged,
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  FirebaseUser,
} from '../services/firebase';
import { setCachedUserProfile } from '../services/userProfileCache';
import { DEFAULT_AVATAR } from '../services/imageStorageService';
import { logFirestoreDiag } from '../services/firestoreDiagnostic';

function extractCanonicalLocation(data: any): LocationInfo {
  const rawLoc = data?.location || {};
  const lat =
    typeof rawLoc.latitude === 'number'
      ? rawLoc.latitude
      : typeof rawLoc.coordinates?.lat === 'number'
      ? rawLoc.coordinates.lat
      : typeof data?.latitude === 'number'
      ? data.latitude
      : undefined;
  const lng =
    typeof rawLoc.longitude === 'number'
      ? rawLoc.longitude
      : typeof rawLoc.coordinates?.lng === 'number'
      ? rawLoc.coordinates.lng
      : typeof data?.longitude === 'number'
      ? data.longitude
      : undefined;

  return {
    label: rawLoc.label || data?.savedAddressLabel || '',
    address: rawLoc.address || data?.savedAddress || data?.address || '',
    city: rawLoc.city || data?.city || '',
    state: rawLoc.state || data?.state || '',
    pincode: rawLoc.pincode || data?.postalCode || data?.pincode || '',
    area: rawLoc.area || data?.area || '',
    coordinates: (lat !== undefined && lng !== undefined) ? { lat, lng } : undefined,
    latitude: lat,
    longitude: lng,
  };
}

export type AuthStage =
  | 'loading'
  | 'profile-loading'
  | 'unauthenticated'
  | 'onboarding'
  | 'buyer'
  | 'seller';

interface RegisterParams {
  fullName: string;
  email: string;
  phone: string;
  password?: string;
  role?: UserRole;
}

export interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isProfileLoading: boolean;
  authStage: AuthStage;
  userRole: UserRole | null;
  role: UserRole | null;
  isLoading: boolean;
  authError: string | null;
  retryProfileLoad: () => Promise<void>;
  signInWithGoogle: () => Promise<{
    success: boolean;
    isNewUser?: boolean;
    role?: UserRole;
    error?: string;
    isUnauthorizedDomain?: boolean;
    domain?: string;
  }>;
  register: (params: RegisterParams) => Promise<{
    success: boolean;
    isNewUser?: boolean;
    role?: UserRole;
    error?: string;
    isUnauthorizedDomain?: boolean;
    domain?: string;
  }>;
  login: (email: string, password?: string) => Promise<{
    success: boolean;
    role?: UserRole;
    error?: string;
    isUnauthorizedDomain?: boolean;
    domain?: string;
  }>;
  switchDemoUser: (personaKey: string) => void;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => Promise<void>;
  updateUserLocation: (location: LocationInfo) => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  confirmUserNameAndRole: (name: string, role: UserRole) => Promise<void>;
  completeOnboarding: (params: {
    fullName: string;
    phoneNumber: string;
    location: LocationInfo;
    role: UserRole;
    whatYouSell?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // A brand-new visitor starts strictly unauthenticated (null)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Sync active user to local storage for recovery only when authenticated with Firebase
  useEffect(() => {
    if (currentUser && firebaseUser) {
      localStorage.setItem('localcart_active_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('localcart_active_user');
    }
  }, [currentUser, firebaseUser]);

  // Listen to real Firebase Auth state with real-time profile synchronization
  useEffect(() => {
    let userDocUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
        userDocUnsubscribe = null;
      }

      setAuthError(null);

      // If user is null OR is an anonymous user, treat strictly as unauthenticated
      if (!fbUser || fbUser.isAnonymous) {
        if (fbUser?.isAnonymous) {
          console.info('[Firebase Auth] Clearing anonymous visitor session from browser persistence');
          fbSignOut(auth).catch(() => {});
        }
        setFirebaseUser(null);
        setCurrentUser(null);
        setIsLoading(false);
        setIsProfileLoading(false);
        localStorage.removeItem('localcart_active_user');
        return;
      }

      // Valid real Google-authenticated user
      setFirebaseUser(fbUser);
      setIsLoading(false);
      setIsProfileLoading(true);

      const userDocRef = doc(db, 'users', fbUser.uid);

      try {
        logFirestoreDiag({
          path: `users/${fbUser.uid}`,
          operationType: 'get',
          currentRole: 'none',
        });
        const userSnap = await getDoc(userDocRef);
        if (!userSnap.exists()) {
          // Brand-new Google user: Create minimal profile in Firestore
          const nowIso = new Date().toISOString();
          const initialData = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || 'Customer',
            fullName: fbUser.displayName || 'Customer',
            phone: fbUser.phoneNumber || '',
            photoURL: fbUser.photoURL || '',
            avatarUrl: fbUser.photoURL || '',
            profilePhotoUrl: fbUser.photoURL || '',
            role: 'unassigned',
            onboardingCompleted: false,
            createdAt: nowIso,
            updatedAt: nowIso,
            location: {
              city: APP_CONFIG.defaultLocation.city,
              state: APP_CONFIG.defaultLocation.state,
              pincode: APP_CONFIG.defaultLocation.pincode,
              area: APP_CONFIG.defaultLocation.area,
              address: '',
            },
          };
          logFirestoreDiag({
            path: `users/${fbUser.uid}`,
            operationType: 'set',
            currentRole: 'unassigned',
          });
          await setDoc(userDocRef, initialData);

          const newUser: User = {
            id: fbUser.uid,
            email: fbUser.email || '',
            phone: fbUser.phoneNumber || '',
            fullName: fbUser.displayName || 'Customer',
            role: 'UNASSIGNED',
            avatarUrl: fbUser.photoURL || DEFAULT_AVATAR,
            createdAt: nowIso,
            location: initialData.location,
            onboardingCompleted: false,
          };
          setCurrentUser(newUser);
          setIsProfileLoading(false);
        } else {
          const data = userSnap.data();
          const rawRole = (data.role || '').toLowerCase();
          const normalizedRole: UserRole =
            rawRole === 'buyer'
              ? 'BUYER'
              : rawRole === 'seller'
              ? 'SELLER'
              : 'UNASSIGNED';

          const existingUser: User = {
            id: fbUser.uid,
            email: data.email || fbUser.email || '',
            phone: data.phone || fbUser.phoneNumber || '',
            fullName: data.displayName || data.fullName || fbUser.displayName || 'Customer',
            role: normalizedRole,
            avatarUrl: data.photoURL || data.avatarUrl || fbUser.photoURL || DEFAULT_AVATAR,
            createdAt: data.createdAt || new Date().toISOString(),
            location: extractCanonicalLocation(data) || {
              city: APP_CONFIG.defaultLocation.city,
              state: APP_CONFIG.defaultLocation.state,
              pincode: APP_CONFIG.defaultLocation.pincode,
              area: APP_CONFIG.defaultLocation.area,
              address: '',
            },
            onboardingCompleted: data.onboardingCompleted ?? (normalizedRole !== 'UNASSIGNED'),
          };
          setCurrentUser(existingUser);
          setIsProfileLoading(false);
        }
      } catch (err: any) {
        logFirestoreDiag({
          path: `users/${fbUser.uid}`,
          operationType: 'get',
          currentRole: 'unknown',
          error: err,
        });
        console.error('[Firestore] User profile initialization notice:', {
          code: err?.code,
          message: err?.message,
          userId: fbUser.uid,
        });
        setIsProfileLoading(false);
      }

      // Real-time synchronization of Firestore user profile
      userDocUnsubscribe = onSnapshot(
        userDocRef,
        (snapshot) => {
          setIsProfileLoading(false);
          if (snapshot.exists()) {
            const data = snapshot.data();
            const rawRole = (data.role || '').toLowerCase();
            const normalizedRole: UserRole =
              rawRole === 'buyer'
                ? 'BUYER'
                : rawRole === 'seller'
                ? 'SELLER'
                : 'UNASSIGNED';

            const updated: User = {
              id: fbUser.uid,
              email: data.email || fbUser.email || '',
              phone: data.phone || fbUser.phoneNumber || '',
              fullName: data.displayName || data.fullName || fbUser.displayName || 'Customer',
              role: normalizedRole,
              avatarUrl: data.photoURL || data.avatarUrl || fbUser.photoURL || DEFAULT_AVATAR,
              createdAt: data.createdAt || new Date().toISOString(),
              location: extractCanonicalLocation(data),
              onboardingCompleted: data.onboardingCompleted ?? (normalizedRole !== 'UNASSIGNED'),
            };
            setCurrentUser(updated);
          }
        },
        (snapErr) => {
          logFirestoreDiag({
            path: `users/${fbUser.uid}`,
            operationType: 'listener',
            currentRole: currentUser?.role || null,
            error: snapErr,
          });
          console.error('[Firestore] Profile snapshot error:', {
            code: snapErr?.code,
            message: snapErr?.message,
            userId: fbUser.uid,
          });
          setIsProfileLoading(false);
        }
      );
    });

    return () => {
      if (userDocUnsubscribe) userDocUnsubscribe();
      authUnsubscribe();
    };
  }, []);

  const retryProfileLoad = async () => {
    if (!firebaseUser) return;
    setIsProfileLoading(true);
    setAuthError(null);
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const rawRole = (data.role || '').toLowerCase();
        const normalizedRole: UserRole =
          rawRole === 'buyer'
            ? 'BUYER'
            : rawRole === 'seller'
            ? 'SELLER'
            : 'UNASSIGNED';
        const existingUser: User = {
          id: firebaseUser.uid,
          email: data.email || firebaseUser.email || '',
          phone: data.phone || firebaseUser.phoneNumber || '',
          fullName: data.displayName || data.fullName || firebaseUser.displayName || 'Customer',
          role: normalizedRole,
          avatarUrl: data.photoURL || data.avatarUrl || firebaseUser.photoURL || DEFAULT_AVATAR,
          createdAt: data.createdAt || new Date().toISOString(),
          location: extractCanonicalLocation(data),
          onboardingCompleted: data.onboardingCompleted ?? (normalizedRole !== 'UNASSIGNED'),
        };
        setCurrentUser(existingUser);
      }
    } catch (err: any) {
      console.error('[Firestore] Retry profile load error:', err);
      setAuthError('Unable to connect to your account profile. Please check connection and retry.');
    } finally {
      setIsProfileLoading(false);
    }
  };

  // Google Sign-In with canonical Firebase Auth UID
  const signInWithGoogle = async (): Promise<{
    success: boolean;
    isNewUser?: boolean;
    role?: UserRole;
    error?: string;
    isUnauthorizedDomain?: boolean;
    domain?: string;
  }> => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      setFirebaseUser(fbUser);

      const userDocRef = doc(db, 'users', fbUser.uid);
      let userSnap: any = null;
      try {
        logFirestoreDiag({
          path: `users/${fbUser.uid}`,
          operationType: 'get',
          currentRole: 'none',
        });
        userSnap = await getDoc(userDocRef);
      } catch (docErr: any) {
        logFirestoreDiag({
          path: `users/${fbUser.uid}`,
          operationType: 'get',
          currentRole: 'none',
          error: docErr,
        });
        console.error('[Firestore] Error reading user doc:', {
          code: docErr?.code,
          message: docErr?.message,
          userId: fbUser.uid,
        });
      }

      const nowIso = new Date().toISOString();

      if (!userSnap || !userSnap.exists()) {
        const initialData = {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'Customer',
          fullName: fbUser.displayName || 'Customer',
          phone: fbUser.phoneNumber || '',
          photoURL: fbUser.photoURL || '',
          avatarUrl: fbUser.photoURL || '',
          profilePhotoUrl: fbUser.photoURL || '',
          role: 'unassigned',
          onboardingCompleted: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          location: {
            city: APP_CONFIG.defaultLocation.city,
            state: APP_CONFIG.defaultLocation.state,
            pincode: APP_CONFIG.defaultLocation.pincode,
            area: APP_CONFIG.defaultLocation.area,
            address: '',
          },
        };

        try {
          logFirestoreDiag({
            path: `users/${fbUser.uid}`,
            operationType: 'set',
            currentRole: 'unassigned',
          });
          await setDoc(userDocRef, initialData);
        } catch (setErr: any) {
          logFirestoreDiag({
            path: `users/${fbUser.uid}`,
            operationType: 'set',
            currentRole: 'unassigned',
            error: setErr,
          });
          console.error('[Firestore] Error creating initial user profile:', {
            code: setErr?.code,
            message: setErr?.message,
            userId: fbUser.uid,
          });
        }

        const newUser: User = {
          id: fbUser.uid,
          email: fbUser.email || '',
          phone: '',
          fullName: fbUser.displayName || 'Customer',
          role: 'UNASSIGNED',
          avatarUrl: fbUser.photoURL || DEFAULT_AVATAR,
          createdAt: nowIso,
          location: initialData.location,
          onboardingCompleted: false,
        };
        setCurrentUser(newUser);
        setIsLoading(false);
        setIsProfileLoading(false);
        return { success: true, isNewUser: true, role: 'UNASSIGNED' };
      } else {
        const data = userSnap.data();
        const rawRole = (data.role || '').toLowerCase();
        const normalizedRole: UserRole =
          rawRole === 'buyer'
            ? 'BUYER'
            : rawRole === 'seller'
            ? 'SELLER'
            : 'UNASSIGNED';

        const existingUser: User = {
          id: fbUser.uid,
          email: data.email || fbUser.email || '',
          phone: data.phone || fbUser.phoneNumber || '',
          fullName: data.displayName || data.fullName || fbUser.displayName || 'Customer',
          role: normalizedRole,
          avatarUrl: data.photoURL || data.avatarUrl || fbUser.photoURL || DEFAULT_AVATAR,
          createdAt: data.createdAt || nowIso,
          location: extractCanonicalLocation(data) || {
            city: APP_CONFIG.defaultLocation.city,
            state: APP_CONFIG.defaultLocation.state,
            pincode: APP_CONFIG.defaultLocation.pincode,
            area: APP_CONFIG.defaultLocation.area,
            address: '',
          },
          onboardingCompleted: data.onboardingCompleted ?? (normalizedRole !== 'UNASSIGNED'),
        };
        setCurrentUser(existingUser);
        setIsLoading(false);
        setIsProfileLoading(false);
        return { success: true, isNewUser: normalizedRole === 'UNASSIGNED', role: normalizedRole };
      }
    } catch (err: any) {
      setIsLoading(false);
      setIsProfileLoading(false);
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.info('Google sign-in popup was closed by user.');
        return { success: false, error: 'Sign-in window was closed. Click below to try again.' };
      } else if (err?.code === 'auth/popup-blocked') {
        const errMsg = 'Popup was blocked by your browser. Please allow popups or open in a new tab.';
        return { success: false, error: errMsg };
      } else if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
        console.warn(`[Firebase Auth] Domain "${domain}" is not authorized in Firebase Console.`);
        const errMsg = `This preview domain (${domain}) is not authorized for Google Sign-In in Firebase Console.`;
        return {
          success: false,
          error: errMsg,
          isUnauthorizedDomain: true,
          domain,
        };
      } else {
        console.error('[Firebase Auth] Sign-in error:', err);
        const errMsg = err?.message || 'Google Sign-In failed. Please try again.';
        return { success: false, error: errMsg };
      }
    }
  };

  // Register function - delegates strictly to verified Google authentication
  const register = async (_params: RegisterParams): Promise<{
    success: boolean;
    isNewUser?: boolean;
    role?: UserRole;
    error?: string;
    isUnauthorizedDomain?: boolean;
    domain?: string;
  }> => {
    return signInWithGoogle();
  };

  // Login function - delegates strictly to verified Google authentication
  const login = async (_email: string, _password?: string): Promise<{
    success: boolean;
    role?: UserRole;
    error?: string;
    isUnauthorizedDomain?: boolean;
    domain?: string;
  }> => {
    return signInWithGoogle();
  };

  const switchDemoUser = (_personaKey: string) => {
    // Demo accounts removed for production
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (err) {
      // ignore
    }
    setCurrentUser(null);
    setFirebaseUser(null);
    setAuthError(null);
    localStorage.removeItem('localcart_active_user');
  };

  const setRole = async (newRole: UserRole) => {
    if (!currentUser) return;
    const cleanRole = newRole.toLowerCase();
    const userDocRef = doc(db, 'users', currentUser.id);
    try {
      await updateDoc(userDocRef, {
        role: cleanRole,
        updatedAt: new Date().toISOString(),
      });
      const updated: User = { ...currentUser, role: newRole };
      setCurrentUser(updated);
      localStorage.setItem('localcart_active_user', JSON.stringify(updated));
    } catch (err: any) {
      console.error('[Firestore] Error updating user role:', {
        code: err?.code,
        message: err?.message,
        collection: 'users',
        doc: currentUser.id,
      });
      throw err;
    }
  };

  const confirmUserNameAndRole = async (name: string, newRole: UserRole) => {
    if (!currentUser) return;
    const cleanName = name.trim() || currentUser.fullName || 'Member';
    const cleanRole = newRole.toLowerCase();
    const userDocRef = doc(db, 'users', currentUser.id);
    try {
      await updateDoc(userDocRef, {
        displayName: cleanName,
        fullName: cleanName,
        role: cleanRole,
        updatedAt: new Date().toISOString(),
      });
      const updated: User = { ...currentUser, fullName: cleanName, role: newRole };
      setCurrentUser(updated);
      localStorage.setItem('localcart_active_user', JSON.stringify(updated));
    } catch (err: any) {
      console.error('[Firestore] Error updating name and role:', {
        code: err?.code,
        message: err?.message,
        collection: 'users',
        doc: currentUser.id,
      });
      throw err;
    }
  };

  const updateUserLocation = async (location: LocationInfo) => {
    if (!currentUser) return;
    const lat = location.latitude ?? location.coordinates?.lat;
    const lng = location.longitude ?? location.coordinates?.lng;
    const canonical: LocationInfo = {
      label: location.label || '',
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      pincode: location.pincode || '',
      area: location.area || '',
      coordinates: (lat !== undefined && lng !== undefined) ? { lat, lng } : undefined,
      latitude: lat,
      longitude: lng,
    };

    try {
      const userDocRef = doc(db, 'users', currentUser.id);
      await updateDoc(userDocRef, {
        location: canonical,
        updatedAt: new Date().toISOString(),
      });

      // Keep buyerProfiles in sync if it exists for this user
      try {
        const buyerDocRef = doc(db, 'buyerProfiles', currentUser.id);
        const buyerSnap = await getDoc(buyerDocRef);
        if (buyerSnap.exists()) {
          await updateDoc(buyerDocRef, {
            location: canonical,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (bErr: any) {
        console.error('[Firestore] Error syncing location to buyerProfiles:', {
          code: bErr?.code,
          message: bErr?.message,
          userId: currentUser.id,
        });
      }

      const updated: User = { ...currentUser, location: canonical };
      setCurrentUser(updated);

      if (canonical.city) {
        localStorage.setItem('localcart_current_city_v2', canonical.city);
      }
      if (canonical.area) {
        localStorage.setItem('localcart_current_area_v2', canonical.area);
      }
    } catch (err: any) {
      console.error('[Firestore] Error updating user location in users:', {
        code: err?.code,
        message: err?.message,
        userId: currentUser.id,
      });
      throw err;
    }
  };

  const updateUserProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    const userDocRef = doc(db, 'users', currentUser.id);
    const firestoreUpdates: any = {
      updatedAt: new Date().toISOString(),
    };
    if (updates.fullName !== undefined) {
      firestoreUpdates.displayName = updates.fullName;
      firestoreUpdates.fullName = updates.fullName;
    }
    if (updates.phone !== undefined) {
      firestoreUpdates.phone = updates.phone;
    }
    if (updates.avatarUrl !== undefined) {
      firestoreUpdates.photoURL = updates.avatarUrl;
      firestoreUpdates.avatarUrl = updates.avatarUrl;
      firestoreUpdates.profilePhotoUrl = updates.avatarUrl;
    }
    if (updates.location !== undefined) {
      firestoreUpdates.location = updates.location;
    }
    if (updates.role !== undefined) {
      firestoreUpdates.role = updates.role.toLowerCase();
    }
    if (updates.onboardingCompleted !== undefined) {
      firestoreUpdates.onboardingCompleted = updates.onboardingCompleted;
    }

    try {
      await updateDoc(userDocRef, firestoreUpdates);
      const updated: User = { ...currentUser, ...updates };
      setCurrentUser(updated);
      setCachedUserProfile(currentUser.id, {
        avatarUrl: updates.avatarUrl || currentUser.avatarUrl,
        fullName: updates.fullName || currentUser.fullName,
      });
    } catch (err: any) {
      console.error('[Firestore] Error updating user profile in users:', {
        code: err?.code,
        message: err?.message,
        collection: 'users',
        doc: currentUser.id,
        updates: firestoreUpdates,
      });
      throw err;
    }
  };

  const completeOnboarding = async (params: {
    fullName: string;
    phoneNumber: string;
    location: LocationInfo;
    role: UserRole;
    whatYouSell?: string;
  }) => {
    const targetUid = firebaseUser?.uid || currentUser?.id;
    if (!targetUid) {
      throw new Error('Authentication required to complete account setup.');
    }

    const cleanName = params.fullName.trim() || currentUser?.fullName || firebaseUser?.displayName || 'Customer';
    const cleanPhone = params.phoneNumber.trim() || currentUser?.phone || firebaseUser?.phoneNumber || '';
    const cleanRole = params.role;
    const roleLower = cleanRole.toLowerCase(); // 'buyer' or 'seller'
    const nowIso = new Date().toISOString();

    const canonicalLocation: LocationInfo = {
      city: params.location.city || APP_CONFIG.defaultLocation.city,
      state: params.location.state || APP_CONFIG.defaultLocation.state,
      pincode: params.location.pincode || APP_CONFIG.defaultLocation.pincode,
      area: params.location.area || APP_CONFIG.defaultLocation.area,
      address: params.location.address || '',
      coordinates: params.location.coordinates || {
        lat: params.location.latitude ?? 17.4156,
        lng: params.location.longitude ?? 78.4350,
      },
      latitude: params.location.latitude ?? params.location.coordinates?.lat,
      longitude: params.location.longitude ?? params.location.coordinates?.lng,
    };

    // 1. First, write to users/{uid} and await completion.
    // In firestore.rules, users/{uid} update whitelist is:
    // ['displayName', 'fullName', 'email', 'phone', 'photoURL', 'avatarUrl', 'profilePhotoUrl', 'location', 'onboardingCompleted', 'role', 'updatedAt']
    const userDocRef = doc(db, 'users', targetUid);
    logFirestoreDiag({
      path: `users/${targetUid}`,
      operationType: 'get',
      currentRole: currentUser?.role || null,
    });
    let userSnap: any;
    try {
      userSnap = await getDoc(userDocRef);
    } catch (gErr: any) {
      logFirestoreDiag({
        path: `users/${targetUid}`,
        operationType: 'get',
        currentRole: currentUser?.role || null,
        error: gErr,
      });
      throw gErr;
    }

    try {
      if (!userSnap.exists()) {
        logFirestoreDiag({
          path: `users/${targetUid}`,
          operationType: 'set',
          currentRole: roleLower,
        });
        await setDoc(userDocRef, {
          uid: targetUid,
          displayName: cleanName,
          fullName: cleanName,
          email: currentUser?.email || firebaseUser?.email || '',
          phone: cleanPhone,
          photoURL: currentUser?.avatarUrl || firebaseUser?.photoURL || '',
          avatarUrl: currentUser?.avatarUrl || firebaseUser?.photoURL || '',
          profilePhotoUrl: currentUser?.avatarUrl || firebaseUser?.photoURL || '',
          role: roleLower,
          onboardingCompleted: true,
          location: canonicalLocation,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      } else {
        logFirestoreDiag({
          path: `users/${targetUid}`,
          operationType: 'update',
          currentRole: roleLower,
        });
        await updateDoc(userDocRef, {
          displayName: cleanName,
          fullName: cleanName,
          email: currentUser?.email || firebaseUser?.email || '',
          phone: cleanPhone,
          photoURL: currentUser?.avatarUrl || firebaseUser?.photoURL || '',
          avatarUrl: currentUser?.avatarUrl || firebaseUser?.photoURL || '',
          profilePhotoUrl: currentUser?.avatarUrl || firebaseUser?.photoURL || '',
          role: roleLower,
          onboardingCompleted: true,
          location: canonicalLocation,
          updatedAt: nowIso,
        });
      }
    } catch (err: any) {
      logFirestoreDiag({
        path: `users/${targetUid}`,
        operationType: userSnap?.exists() ? 'update' : 'set',
        currentRole: roleLower,
        error: err,
      });
      console.error('[Firestore] Error writing users document in completeOnboarding:', {
        code: err?.code,
        message: err?.message,
        collection: 'users',
        doc: targetUid,
        operation: userSnap?.exists() ? 'updateDoc' : 'setDoc',
      });
      throw err;
    }

    // 2. Role-specific collection creation/update
    if (cleanRole === 'BUYER') {
      try {
        const buyerDocRef = doc(db, 'buyerProfiles', targetUid);
        logFirestoreDiag({
          path: `buyerProfiles/${targetUid}`,
          operationType: 'get',
          currentRole: 'buyer',
        });
        const buyerSnap = await getDoc(buyerDocRef);
        if (!buyerSnap.exists()) {
          logFirestoreDiag({
            path: `buyerProfiles/${targetUid}`,
            operationType: 'set',
            currentRole: 'buyer',
          });
          await setDoc(buyerDocRef, {
            id: targetUid,
            userId: targetUid,
            fullName: cleanName,
            email: currentUser?.email || firebaseUser?.email || '',
            phone: cleanPhone,
            location: canonicalLocation,
            favoriteSellerIds: [],
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        } else {
          logFirestoreDiag({
            path: `buyerProfiles/${targetUid}`,
            operationType: 'update',
            currentRole: 'buyer',
          });
          await updateDoc(buyerDocRef, {
            fullName: cleanName,
            email: currentUser?.email || firebaseUser?.email || '',
            phone: cleanPhone,
            location: canonicalLocation,
            updatedAt: nowIso,
          });
        }
      } catch (bErr: any) {
        logFirestoreDiag({
          path: `buyerProfiles/${targetUid}`,
          operationType: 'set',
          currentRole: 'buyer',
          error: bErr,
        });
        console.error('[Firestore] Error saving buyerProfiles document:', {
          code: bErr?.code,
          message: bErr?.message,
          collection: 'buyerProfiles',
          doc: targetUid,
        });
        throw bErr;
      }
    } else if (cleanRole === 'SELLER') {
      try {
        logFirestoreDiag({
          path: 'sellerProfiles?userId==' + targetUid,
          operationType: 'query',
          currentRole: 'seller',
        });
        const sellersQuery = query(collection(db, 'sellerProfiles'), where('userId', '==', targetUid));
        const sellersSnap = await getDocs(sellersQuery);
        if (sellersSnap.empty) {
          const sellerId = `seller-${targetUid.slice(0, 8)}-${Date.now().toString().slice(-4)}`;
          const cleanSlug = cleanName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'store';
          const sellerDocRef = doc(db, 'sellerProfiles', sellerId);
          logFirestoreDiag({
            path: `sellerProfiles/${sellerId}`,
            operationType: 'set',
            currentRole: 'seller',
          });
          const cleanWhatYouSell = (params.whatYouSell || '').trim();
          await setDoc(sellerDocRef, {
            id: sellerId,
            userId: targetUid,
            businessName: `${cleanName}'s Store`,
            businessSlug: `${cleanSlug}-${Date.now().toString().slice(-4)}`,
            businessCategory: cleanWhatYouSell || 'General Store',
            whatYouSell: cleanWhatYouSell || 'General Store',
            businessDescription: cleanWhatYouSell ? `Local store specializing in ${cleanWhatYouSell}.` : 'Local neighborhood storefront.',
            tagline: 'Fresh products delivered locally',
            location: canonicalLocation,
            serviceRadiusKm: 15,
            bannerUrl: '',
            logoUrl: currentUser?.avatarUrl || firebaseUser?.photoURL || DEFAULT_AVATAR,
            storePhotoUrl: '',
            openingHours: '09:00 AM - 09:00 PM',
            deliveryOptions: {
              sellerDelivery: true,
              thirdParty: false,
              buyerPickup: true,
              baseDeliveryFee: 40,
              freeDeliveryAbove: 500,
              estimatedTime: '1 - 2 hours',
            },
            contactPhone: cleanPhone,
            contactEmail: currentUser?.email || firebaseUser?.email || '',
            rating: 5.0,
            reviewCount: 1,
            isVerified: true,
            tags: ['Local Store', 'Verified'],
            createdAt: nowIso,
          });
        }
      } catch (sErr: any) {
        logFirestoreDiag({
          path: `sellerProfiles (userId: ${targetUid})`,
          operationType: 'set',
          currentRole: 'seller',
          error: sErr,
        });
        console.error('[Firestore] Error saving sellerProfiles document:', {
          code: sErr?.code,
          message: sErr?.message,
          collection: 'sellerProfiles',
          userId: targetUid,
        });
        throw sErr;
      }
    }

    // 3. Update active React user state
    const updatedUser: User = {
      id: targetUid,
      email: currentUser?.email || firebaseUser?.email || '',
      phone: cleanPhone,
      fullName: cleanName,
      role: cleanRole,
      avatarUrl: currentUser?.avatarUrl || firebaseUser?.photoURL || DEFAULT_AVATAR,
      createdAt: currentUser?.createdAt || nowIso,
      location: canonicalLocation,
      onboardingCompleted: true,
    };
    setCurrentUser(updatedUser);
    localStorage.setItem('localcart_active_user', JSON.stringify(updatedUser));

    if (canonicalLocation.city) {
      localStorage.setItem('localcart_current_city_v2', canonicalLocation.city);
    }
    if (canonicalLocation.area) {
      localStorage.setItem('localcart_current_area_v2', canonicalLocation.area);
    }

    setCachedUserProfile(targetUid, {
      uid: targetUid,
      fullName: cleanName,
      avatarUrl: updatedUser.avatarUrl || '',
      role: roleLower,
    });
  };

  const activeRole = currentUser?.role || null;

  let authStage: AuthStage;
  if (isLoading) {
    authStage = 'loading';
  } else if (!firebaseUser) {
    authStage = 'unauthenticated';
  } else if (isProfileLoading && !currentUser) {
    authStage = 'profile-loading';
  } else if (!currentUser || currentUser.role === 'UNASSIGNED' || !currentUser.role) {
    authStage = 'onboarding';
  } else if (currentUser.role === 'SELLER') {
    authStage = 'seller';
  } else if (currentUser.role === 'BUYER') {
    authStage = 'buyer';
  } else {
    authStage = 'onboarding';
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        isAuthenticated: authStage === 'buyer' || authStage === 'seller',
        isProfileLoading,
        authStage,
        userRole: activeRole,
        role: activeRole,
        isLoading,
        authError,
        retryProfileLoad,
        signInWithGoogle,
        register,
        login,
        switchDemoUser,
        logout,
        setRole,
        updateUserLocation,
        updateUserProfile,
        confirmUserNameAndRole,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
