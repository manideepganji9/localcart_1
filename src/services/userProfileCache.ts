import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import { useState, useEffect } from 'react';

export interface UserProfileSnapshot {
  uid: string;
  fullName: string;
  avatarUrl: string; // canonical profile photo URL
  role?: string;
}

// In-memory cache keyed by Firebase UID to prevent duplicate Firestore queries
const profileCache: Record<string, UserProfileSnapshot> = {};
const activeUnsubscribes: Record<string, () => void> = {};
const listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

/**
 * Seeds or updates local profile cache directly (e.g. from AuthContext currentUser)
 */
export function setCachedUserProfile(uid: string, profile: Partial<UserProfileSnapshot>) {
  if (!uid) return;
  const existing = profileCache[uid] || { uid, fullName: '', avatarUrl: '' };
  profileCache[uid] = {
    ...existing,
    ...profile,
    uid,
  };
  notifyListeners();
}

/**
 * Ensures a single real-time Firestore listener exists on doc(db, 'users', uid)
 * without duplicate listeners or unnecessary reads.
 */
export function subscribeToUserProfile(uid: string) {
  if (!uid || activeUnsubscribes[uid]) {
    return;
  }

  // Under strict Firestore security rules, users may only read their own private profile doc.
  // Other users' display names and avatars in orders/conversations come from cached metadata.
  if (auth.currentUser?.uid !== uid) {
    return;
  }

  try {
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const avatar =
            data.profilePhotoUrl ||
            data.photoURL ||
            data.avatarUrl ||
            '';

          profileCache[uid] = {
            uid,
            fullName: data.fullName || data.displayName || profileCache[uid]?.fullName || '',
            avatarUrl: avatar,
            role: data.role || profileCache[uid]?.role,
          };
          notifyListeners();
        }
      },
      (err) => {
        console.warn(`[ProfileCache] Error watching user profile ${uid}:`, err);
      }
    );
    activeUnsubscribes[uid] = unsub;
  } catch (err) {
    console.warn(`[ProfileCache] Failed to subscribe to user profile ${uid}:`, err);
  }
}

/**
 * Hook to retrieve profile for a given UID, automatically subscribing to real-time updates.
 */
export function useUserProfile(uid: string | undefined): UserProfileSnapshot | undefined {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!uid) return;
    subscribeToUserProfile(uid);

    const onUpdate = () => setTick((t) => t + 1);
    listeners.add(onUpdate);
    return () => {
      listeners.delete(onUpdate);
    };
  }, [uid]);

  return uid ? profileCache[uid] : undefined;
}

/**
 * Hook to batch-watch a list of UIDs (e.g. from messages list)
 */
export function useUserProfiles(uids: (string | undefined)[]) {
  const [, setTick] = useState(0);
  const uidsKey = Array.from(new Set(uids.filter((id): id is string => Boolean(id)))).sort().join(',');

  useEffect(() => {
    if (!uidsKey) return;
    const validUids = uidsKey.split(',');
    validUids.forEach((id) => subscribeToUserProfile(id));

    const onUpdate = () => setTick((t) => t + 1);
    listeners.add(onUpdate);
    return () => {
      listeners.delete(onUpdate);
    };
  }, [uidsKey]);

  return profileCache;
}

export function getCachedUserProfile(uid: string): UserProfileSnapshot | undefined {
  return profileCache[uid];
}
