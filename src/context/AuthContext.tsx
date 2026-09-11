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
  onSnapshot,
  FirebaseUser,
} from '../services/firebase';
import { setCachedUserProfile } from '../services/userProfileCache';

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
  signInWithGoogle: () => Promise<{ success: boolean; isNewUser?: boolean; role?: UserRole; error?: string }>;
  register: (params: RegisterParams) => Promise<{ success: boolean; isNewUser?: boolean; role?: UserRole; error?: string }>;
  login: (email: string, password?: string) => Promise<{ success: boolean; role?: UserRole; error?: string }>;
  switchDemoUser: (personaKey: 'seller1' | 'seller2' | 'seller3' | 'seller4' | 'buyer1' | 'buyer2' | string) => void;
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
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('localcart_active_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return null;
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Sync active user to local storage for persistent recovery
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('localcart_active_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('localcart_active_user');
    }
  }, [currentUser]);

  // Listen to real Firebase Auth state with real-time profile synchronization
  useEffect(() => {
    let userDocUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
        userDocUnsubscribe = null;
      }

      setAuthError(null);

      if (!fbUser) {
        setFirebaseUser(null);
        setCurrentUser(null);
        setIsLoading(false);
        setIsProfileLoading(false);
        localStorage.removeItem('localcart_active_user');
        return;
      }

      // Firebase User authenticated
      setFirebaseUser(fbUser);
      setIsLoading(false);
      setIsProfileLoading(true);

      const userDocRef = doc(db, 'users', fbUser.uid);

      // Check whether a LocalCart profile exists for this Firebase Auth UID
      try {
        const userSnap = await getDoc(userDocRef);
        if (!userSnap.exists()) {
          // Brand-new Google user: Create minimal profile in Firestore with UID as canonical key
          const initialData = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || 'Customer',
            fullName: fbUser.displayName || 'Customer',
            photoURL: fbUser.photoURL || '',
            role: 'unassigned',
            onboardingCompleted: false,
            phone: fbUser.phoneNumber || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            location: {
              city: APP_CONFIG.defaultLocation.city,
              state: APP_CONFIG.defaultLocation.state,
              pincode: APP_CONFIG.defaultLocation.pincode,
              area: APP_CONFIG.defaultLocation.area,
              address: '',
            },
          };
          await setDoc(userDocRef, initialData, { merge: true });
        }
      } catch (err: any) {
        console.error('Firestore user profile initialization error in onAuthStateChanged:', err);
        setAuthError('Unable to finish setting up your account. Please try again.');
        setIsProfileLoading(false);
        return;
      }

      // Real-time synchronization of Firestore user profile
      userDocUnsubscribe = onSnapshot(
        userDocRef,
        (userSnap) => {
          setIsProfileLoading(false);
          setAuthError(null);
          if (userSnap.exists()) {
            const data = userSnap.data();
            const rawRole = (data.role || '').toLowerCase();
            const normalizedRole: UserRole =
              rawRole === 'buyer'
                ? 'BUYER'
                : rawRole === 'seller'
                ? 'SELLER'
                : 'UNASSIGNED';

            const canonicalLocation = extractCanonicalLocation(data);

            const resolvedUser: User = {
              id: fbUser.uid,
              email: data.email || fbUser.email || '',
              phone: data.phone || data.phoneNumber || fbUser.phoneNumber || '',
              fullName: data.displayName || data.fullName || fbUser.displayName || 'Customer',
              role: normalizedRole,
              avatarUrl: data.photoURL || fbUser.photoURL || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80`,
              createdAt: data.createdAt || new Date().toISOString(),
              location: canonicalLocation,
              onboardingCompleted: data.onboardingCompleted ?? (normalizedRole !== 'UNASSIGNED'),
            };

            setCurrentUser(resolvedUser);
            localStorage.setItem('localcart_active_user', JSON.stringify(resolvedUser));
          } else {
            // Document missing, role unassigned
            const fallbackUser: User = {
              id: fbUser.uid,
              email: fbUser.email || '',
              phone: fbUser.phoneNumber || '',
              fullName: fbUser.displayName || 'Customer',
              role: 'UNASSIGNED',
              avatarUrl: fbUser.photoURL || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80`,
              createdAt: new Date().toISOString(),
              location: {
                city: APP_CONFIG.defaultLocation.city,
                state: APP_CONFIG.defaultLocation.state,
                pincode: APP_CONFIG.defaultLocation.pincode,
                area: APP_CONFIG.defaultLocation.area,
                address: '',
              },
              onboardingCompleted: false,
            };
            setCurrentUser(fallbackUser);
          }
        },
        (err) => {
          console.error('Real-time Firestore user profile notice:', err);
          setAuthError('Unable to finish setting up your account. Please try again.');
          setIsProfileLoading(false);
        }
      );
    });

    return () => {
      if (userDocUnsubscribe) userDocUnsubscribe();
      authUnsubscribe();
    };
  }, []);

  // Retry Firestore profile lookup/creation if an error occurred
  const retryProfileLoad = async () => {
    if (!firebaseUser) return;
    setIsProfileLoading(true);
    setAuthError(null);
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        const initialData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Customer',
          fullName: firebaseUser.displayName || 'Customer',
          photoURL: firebaseUser.photoURL || '',
          role: 'unassigned',
          onboardingCompleted: false,
          phone: firebaseUser.phoneNumber || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          location: {
            city: APP_CONFIG.defaultLocation.city,
            state: APP_CONFIG.defaultLocation.state,
            pincode: APP_CONFIG.defaultLocation.pincode,
            area: APP_CONFIG.defaultLocation.area,
            address: '',
          },
        };
        await setDoc(userDocRef, initialData, { merge: true });
      }
      setIsProfileLoading(false);
    } catch (err: any) {
      console.error('Retry profile load error:', err);
      setAuthError('Unable to finish setting up your account. Please try again.');
      setIsProfileLoading(false);
    }
  };

  // Google Sign-In with canonical UID matching
  const signInWithGoogle = async (): Promise<{ success: boolean; isNewUser?: boolean; role?: UserRole; error?: string }> => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      setFirebaseUser(fbUser);

      // Check if user document exists in Firestore using Firebase UID
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        // Create initial minimal profile document
        const initialData = {
          uid: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'Customer',
          fullName: fbUser.displayName || 'Customer',
          photoURL: fbUser.photoURL || '',
          role: 'unassigned',
          onboardingCompleted: false,
          phone: fbUser.phoneNumber || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          location: {
            city: APP_CONFIG.defaultLocation.city,
            state: APP_CONFIG.defaultLocation.state,
            pincode: APP_CONFIG.defaultLocation.pincode,
            area: APP_CONFIG.defaultLocation.area,
            address: '',
          },
        };
        await setDoc(userDocRef, initialData, { merge: true });

        const newUser: User = {
          id: fbUser.uid,
          email: fbUser.email || '',
          phone: '',
          fullName: fbUser.displayName || 'Customer',
          role: 'UNASSIGNED',
          avatarUrl: fbUser.photoURL || '',
          createdAt: initialData.createdAt,
          location: initialData.location,
          onboardingCompleted: false,
        };
        setCurrentUser(newUser);
        localStorage.setItem('localcart_active_user', JSON.stringify(newUser));
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
          phone: data.phone || data.phoneNumber || fbUser.phoneNumber || '',
          fullName: data.displayName || data.fullName || fbUser.displayName || 'Customer',
          role: normalizedRole,
          avatarUrl: data.photoURL || fbUser.photoURL || '',
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
        localStorage.setItem('localcart_active_user', JSON.stringify(existingUser));
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
        console.warn('Google sign-in popup was blocked by browser.');
        const errMsg = 'Popup was blocked by your browser. Please allow popups or open in a new tab.';
        setAuthError(errMsg);
        return { success: false, error: errMsg };
      } else {
        console.error('Google Sign-In notice:', err?.message || err);
        const errMsg = err?.message || 'Unable to finish setting up your account. Please try again.';
        setAuthError(errMsg);
        return { success: false, error: errMsg };
      }
    }
  };

  // Register function - delegates strictly to verified Google authentication
  const register = async (_params: RegisterParams): Promise<{ success: boolean; isNewUser?: boolean; error?: string }> => {
    return signInWithGoogle();
  };

  // Login function - delegates strictly to verified Google authentication
  const login = async (_email: string, _password?: string): Promise<{ success: boolean; error?: string }> => {
    return signInWithGoogle();
  };

  // Switch demo persona (no-op in production)
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
    localStorage.removeItem('localcart_active_user');
  };

  const setRole = async (newRole: UserRole) => {
    if (!currentUser) return;
    const updated: User = { ...currentUser, role: newRole };
    setCurrentUser(updated);

    try {
      const userDocRef = doc(db, 'users', currentUser.id);
      await updateDoc(userDocRef, {
        role: newRole.toLowerCase(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Notice updating role in Firestore:', err);
    }
  };

  const confirmUserNameAndRole = async (name: string, newRole: UserRole) => {
    if (!currentUser) return;
    const cleanName = name.trim() || currentUser.fullName || 'Member';
    const updated: User = { ...currentUser, fullName: cleanName, role: newRole };
    setCurrentUser(updated);

    try {
      const userDocRef = doc(db, 'users', currentUser.id);
      await updateDoc(userDocRef, {
        displayName: cleanName,
        fullName: cleanName,
        role: newRole.toLowerCase(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Notice updating name and role in Firestore:', err);
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

    const updated: User = { ...currentUser, location: canonical };
    setCurrentUser(updated);

    try {
      const userDocRef = doc(db, 'users', currentUser.id);
      await updateDoc(userDocRef, {
        location: canonical,
        savedAddress: canonical.address,
        address: canonical.address,
        city: canonical.city,
        state: canonical.state,
        pincode: canonical.pincode,
        area: canonical.area,
        latitude: lat ?? null,
        longitude: lng ?? null,
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
      } catch (_) {}

      // Cache to localStorage
      if (canonical.city) {
        localStorage.setItem('localcart_current_city_v2', canonical.city);
      }
      if (canonical.area) {
        localStorage.setItem('localcart_current_area_v2', canonical.area);
      }
    } catch (err) {
      console.warn('Notice updating location in Firestore:', err);
    }
  };

  const updateUserProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    const updated: User = { ...currentUser, ...updates };
    setCurrentUser(updated);

    try {
      const userDocRef = doc(db, 'users', currentUser.id);
      const firestoreUpdates: any = {
        updatedAt: new Date().toISOString(),
      };
      if (updates.fullName) {
        firestoreUpdates.displayName = updates.fullName;
        firestoreUpdates.fullName = updates.fullName;
      }
      if (updates.phone !== undefined) firestoreUpdates.phone = updates.phone;
      if (updates.avatarUrl !== undefined) {
        firestoreUpdates.photoURL = updates.avatarUrl;
        firestoreUpdates.avatarUrl = updates.avatarUrl;
        firestoreUpdates.profilePhotoUrl = updates.avatarUrl;
        setCachedUserProfile(currentUser.id, {
          avatarUrl: updates.avatarUrl,
          fullName: updates.fullName || currentUser.fullName,
        });
      }
      if (updates.location) firestoreUpdates.location = updates.location;
      if (updates.role) firestoreUpdates.role = updates.role.toLowerCase();

      await updateDoc(userDocRef, firestoreUpdates);
    } catch (err) {
      console.warn('Notice updating profile in Firestore:', err);
    }
  };

  const completeOnboarding = async (params: {
    fullName: string;
    phoneNumber: string;
    location: LocationInfo;
    role: UserRole;
  }) => {
    const targetUid = currentUser?.id || firebaseUser?.uid;
    if (!targetUid) return;

    const cleanName = params.fullName.trim() || currentUser?.fullName || firebaseUser?.displayName || 'Customer';
    const cleanPhone = params.phoneNumber.trim() || currentUser?.phone || firebaseUser?.phoneNumber || '';
    const cleanRole = params.role;

    const updatedUser: User = {
      id: targetUid,
      email: currentUser?.email || firebaseUser?.email || '',
      phone: cleanPhone,
      fullName: cleanName,
      role: cleanRole,
      avatarUrl: currentUser?.avatarUrl || firebaseUser?.photoURL || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80`,
      createdAt: currentUser?.createdAt || new Date().toISOString(),
      location: params.location,
      onboardingCompleted: true,
    };
    setCurrentUser(updatedUser);
    localStorage.setItem('localcart_active_user', JSON.stringify(updatedUser));

    try {
      const userDocRef = doc(db, 'users', targetUid);
      const profileData = {
        uid: targetUid,
        email: updatedUser.email,
        displayName: cleanName,
        fullName: cleanName,
        phoneNumber: cleanPhone,
        phone: cleanPhone,
        location: params.location,
        address: params.location.address || '',
        city: params.location.city || APP_CONFIG.defaultLocation.city,
        state: params.location.state || APP_CONFIG.defaultLocation.state,
        postalCode: params.location.pincode || APP_CONFIG.defaultLocation.pincode,
        pincode: params.location.pincode || APP_CONFIG.defaultLocation.pincode,
        area: params.location.area || APP_CONFIG.defaultLocation.area,
        role: cleanRole.toLowerCase(),
        onboardingCompleted: true,
        photoURL: updatedUser.avatarUrl || '',
        profilePhotoUrl: updatedUser.avatarUrl || '',
        avatarUrl: updatedUser.avatarUrl || '',
        createdAt: updatedUser.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, profileData, { merge: true });

      if (cleanRole === 'BUYER') {
        try {
          const buyerDocRef = doc(db, 'buyerProfiles', targetUid);
          await setDoc(
            buyerDocRef,
            {
              id: targetUid,
              userId: targetUid,
              fullName: cleanName,
              email: updatedUser.email,
              phone: cleanPhone,
              location: params.location,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (bErr) {
          console.warn('Notice establishing buyer profile record:', bErr);
        }
      }

      setCachedUserProfile(targetUid, {
        uid: targetUid,
        fullName: cleanName,
        avatarUrl: updatedUser.avatarUrl || '',
        role: cleanRole.toLowerCase(),
      });
    } catch (err: any) {
      console.error('Firebase save complete onboarding error:', err);
      setAuthError('Unable to finish setting up your account. Please try again.');
      throw err;
    }
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
