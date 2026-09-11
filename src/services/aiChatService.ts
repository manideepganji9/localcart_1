import {
  db,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
} from './firebase';
import { AIChatMessage, Product } from '../types';

const AI_CONVERSATION_ID = 'default';

/**
 * Normalizes a product object so it is safe to persist in Firestore without undefined values
 */
function sanitizeProductForStorage(p: Product): any {
  return {
    id: p.id || '',
    sellerId: p.sellerId || '',
    businessName: p.businessName || '',
    name: p.name || '',
    description: p.description || '',
    category: p.category || '',
    originalPrice: Number(p.originalPrice || p.finalPrice || 0),
    discountPercent: Number(p.discountPercent || 0),
    finalPrice: Number(p.finalPrice || 0),
    stockQuantity: Number(p.stockQuantity || 0),
    inStock: Boolean(p.inStock),
    imageUrl: p.imageUrl || '',
    preparationTime: p.preparationTime || '',
    tags: Array.isArray(p.tags) ? p.tags : [],
  };
}

/**
 * Subscribes to persistent AI Concierge messages for the authenticated user from Firestore.
 * Listens to users/{userId}/aiChats/default/messages ordered chronologically.
 */
export function subscribeToUserAIChat(
  userId: string,
  onUpdate: (messages: AIChatMessage[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!userId || userId.trim() === '') {
    onUpdate([]);
    return () => {};
  }

  try {
    const messagesCol = collection(db, 'users', userId, 'aiChats', AI_CONVERSATION_ID, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'), limit(150));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: AIChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          let createdAt = new Date().toISOString();
          if (data.createdAt) {
            if (typeof data.createdAt === 'string') {
              createdAt = data.createdAt;
            } else if (data.createdAt?.toDate) {
              createdAt = data.createdAt.toDate().toISOString();
            }
          }

          const role: 'user' | 'ai' = data.role === 'user' ? 'user' : 'ai';

          msgs.push({
            id: docSnap.id,
            userId,
            role,
            text: data.text || data.content || '',
            matchedProducts: Array.isArray(data.matchedProducts) ? data.matchedProducts : undefined,
            sellerTips: Array.isArray(data.sellerTips) ? data.sellerTips : undefined,
            createdAt,
          });
        });

        onUpdate(msgs);
      },
      (err) => {
        console.warn(`[AIChatService] Error listening to aiChats for ${userId}:`, err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[AIChatService] Failed to establish AI chat listener:', err);
    return () => {};
  }
}

/**
 * Persists an AI Concierge message (user question or AI response) to Firestore
 * at users/{userId}/aiChats/default/messages/{messageId}
 */
export async function saveUserAIChatMessage(
  userId: string,
  message: {
    id: string;
    role: 'user' | 'ai';
    text: string;
    matchedProducts?: Product[];
    sellerTips?: string[];
    createdAt?: string;
  }
): Promise<void> {
  if (!userId || !message.text.trim()) return;

  const nowIso = message.createdAt || new Date().toISOString();
  const msgDocRef = doc(db, 'users', userId, 'aiChats', AI_CONVERSATION_ID, 'messages', message.id);

  const payload: any = {
    id: message.id,
    userId,
    role: message.role,
    text: message.text.trim(),
    createdAt: nowIso,
  };

  if (message.matchedProducts && message.matchedProducts.length > 0) {
    payload.matchedProducts = message.matchedProducts.map(sanitizeProductForStorage);
  }

  if (message.sellerTips && message.sellerTips.length > 0) {
    payload.sellerTips = message.sellerTips.map(t => String(t).trim());
  }

  // 1. Write message document
  await setDoc(msgDocRef, payload, { merge: true });

  // 2. Touch parent conversation metadata
  try {
    const convDocRef = doc(db, 'users', userId, 'aiChats', AI_CONVERSATION_ID);
    await setDoc(
      convDocRef,
      {
        conversationId: AI_CONVERSATION_ID,
        userId,
        lastMessage: message.text.trim().substring(0, 150),
        lastMessageRole: message.role,
        lastMessageAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true }
    );
  } catch (err) {
    // Non-blocking metadata touch
  }
}

/**
 * Loads one-shot history from Firestore if ever needed
 */
export async function loadUserAIChatHistory(userId: string): Promise<AIChatMessage[]> {
  if (!userId) return [];
  try {
    const messagesCol = collection(db, 'users', userId, 'aiChats', AI_CONVERSATION_ID, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'), limit(150));
    const snapshot = await getDocs(q);

    const msgs: AIChatMessage[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let createdAt = new Date().toISOString();
      if (data.createdAt) {
        if (typeof data.createdAt === 'string') createdAt = data.createdAt;
        else if (data.createdAt?.toDate) createdAt = data.createdAt.toDate().toISOString();
      }

      msgs.push({
        id: docSnap.id,
        userId,
        role: data.role === 'user' ? 'user' : 'ai',
        text: data.text || '',
        matchedProducts: data.matchedProducts,
        sellerTips: data.sellerTips,
        createdAt,
      });
    });
    return msgs;
  } catch (err) {
    console.warn('[AIChatService] Error loading history:', err);
    return [];
  }
}

/**
 * Clears all persistent AI Concierge messages for the authenticated user in Firestore.
 */
export async function clearUserAIChat(userId: string): Promise<void> {
  if (!userId || userId.trim() === '') return;

  try {
    const messagesCol = collection(db, 'users', userId, 'aiChats', AI_CONVERSATION_ID, 'messages');
    const snapshot = await getDocs(messagesCol);

    const deletePromises = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);

    // Reset parent conversation document
    const convDocRef = doc(db, 'users', userId, 'aiChats', AI_CONVERSATION_ID);
    await setDoc(
      convDocRef,
      {
        conversationId: AI_CONVERSATION_ID,
        userId,
        lastMessage: '',
        lastMessageRole: 'ai',
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[AIChatService] Error clearing AI chat history:', err);
    throw err;
  }
}
