import {
  db,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  getDocs,
  where,
} from './firebase';
import { OrderMessage, MessageType, Conversation } from '../types';

/**
 * Subscribe to real-time messages for an order conversation using Firestore onSnapshot
 * Orders messages by createdAt ASC, limited to latest 50 for optimal performance.
 */
export function subscribeToConversationMessages(
  orderId: string,
  onUpdate: (messages: OrderMessage[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!orderId) return () => {};

  try {
    const messagesCol = collection(db, 'conversations', orderId, 'messages');
    const q = query(messagesCol, orderBy('createdAt', 'asc'), limit(50));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: OrderMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Handle Firestore serverTimestamp or ISO strings safely
          let timestamp = new Date().toISOString();
          if (data.createdAt) {
            if (typeof data.createdAt === 'string') {
              timestamp = data.createdAt;
            } else if (data.createdAt?.toDate) {
              timestamp = data.createdAt.toDate().toISOString();
            }
          } else if (data.timestamp) {
            timestamp = data.timestamp;
          }

          msgs.push({
            id: docSnap.id,
            messageId: docSnap.id,
            orderId: data.orderId || orderId,
            conversationId: orderId,
            senderId: data.senderId || '',
            senderRole: data.senderRole || 'SYSTEM',
            senderName: data.senderName || 'Anonymous',
            text: data.text || data.message || '',
            timestamp,
            createdAt: timestamp,
            type: data.type || (data.isSystemEvent ? 'SYSTEM' : 'TEXT'),
            read: data.read ?? false,
            status: data.status || 'sent',
            isSystemEvent: data.isSystemEvent ?? (data.senderRole === 'SYSTEM'),
          });
        });

        onUpdate(msgs);
      },
      (err) => {
        console.warn(`[RealtimeChat] Listener error on conversations/${orderId}/messages:`, err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[RealtimeChat] Failed to attach conversation listener:', err);
    return () => {};
  }
}

/**
 * Send human or system chat message directly to Firestore without ANY AI interference.
 */
export async function sendChatMessage(params: {
  orderId: string;
  senderId: string;
  senderRole: 'BUYER' | 'SELLER' | 'SYSTEM';
  senderName: string;
  text: string;
  type?: MessageType;
  recipientId?: string;
  orderNumber?: string;
}): Promise<OrderMessage> {
  const { orderId, senderId, senderRole, senderName, text, type = 'TEXT', recipientId, orderNumber } = params;
  if (!text.trim()) throw new Error('Message text cannot be empty.');

  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const messageData = {
    id: messageId,
    messageId,
    orderId,
    conversationId: orderId,
    senderId,
    senderRole,
    senderName,
    text: text.trim(),
    type,
    read: false,
    status: 'sent',
    isSystemEvent: senderRole === 'SYSTEM' || type === 'SYSTEM' || type === 'ORDER_UPDATE',
    createdAt: nowIso,
    timestamp: nowIso,
  };

  // 1. Write message to conversations/{orderId}/messages/{messageId}
  const msgDocRef = doc(db, 'conversations', orderId, 'messages', messageId);
  await setDoc(msgDocRef, messageData);

  // 2. Update conversation header in conversations/{orderId}
  const convDocRef = doc(db, 'conversations', orderId);
  await setDoc(
    convDocRef,
    {
      conversationId: orderId,
      orderId,
      lastMessage: text.trim(),
      lastMessageAt: nowIso,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  // 3. Create notification for recipient if not system / self
  if (recipientId && recipientId !== senderId && senderRole !== 'SYSTEM') {
    try {
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const notifRef = doc(db, 'notifications', notifId);
      await setDoc(notifRef, {
        id: notifId,
        userId: recipientId,
        recipientId,
        orderId,
        type: 'NEW_MESSAGE',
        title: `Message from ${senderName}`,
        message: text.trim().length > 60 ? `${text.trim().substring(0, 57)}...` : text.trim(),
        read: false,
        createdAt: nowIso,
      });
    } catch (notifErr) {
      console.warn('[RealtimeChat] Notification write skipped/failed:', notifErr);
    }
  }

  return messageData as OrderMessage;
}

/**
 * Mark messages in conversation as read for the current user
 */
export async function markConversationAsRead(orderId: string, currentUserId: string): Promise<void> {
  if (!orderId || !currentUserId) return;
  try {
    const messagesCol = collection(db, 'conversations', orderId, 'messages');
    const q = query(messagesCol, where('read', '==', false), limit(20));
    const snap = await getDocs(q);

    const updatePromises: Promise<void>[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.senderId && data.senderId !== currentUserId) {
        updatePromises.push(updateDoc(docSnap.ref, { read: true, status: 'read' }));
      }
    });

    await Promise.all(updatePromises);
  } catch (err) {
    // Non-critical, ignore
  }
}
