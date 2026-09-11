import { useState, useEffect, useRef, useCallback } from 'react';
import { OrderMessage } from '../types';
import {
  subscribeToConversationMessages,
  sendChatMessage,
  markConversationAsRead,
} from '../services/chatService';

interface UseOrderChatProps {
  orderId: string | null | undefined;
  fallbackMessages?: OrderMessage[];
  currentUserId?: string;
  currentUserName?: string;
  currentUserRole?: 'BUYER' | 'SELLER';
  recipientId?: string;
}

export function useOrderChat({
  orderId,
  fallbackMessages = [],
  currentUserId,
  currentUserName = 'User',
  currentUserRole = 'BUYER',
  recipientId,
}: UseOrderChatProps) {
  const [messages, setMessages] = useState<OrderMessage[]>(() => fallbackMessages);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optimisticMapRef = useRef<Map<string, OrderMessage>>(new Map());

  // Subscribe to real-time messages via Firestore onSnapshot
  useEffect(() => {
    if (!orderId) {
      setMessages(fallbackMessages);
      return;
    }

    const unsubscribe = subscribeToConversationMessages(
      orderId,
      (remoteMessages) => {
        if (remoteMessages.length > 0) {
          // Merge remote messages and keep any pending optimistic messages that haven't arrived yet
          const remoteIds = new Set(remoteMessages.map((m) => m.id));
          const pendingOptimistic: OrderMessage[] = [];

          optimisticMapRef.current.forEach((optMsg, tempId) => {
            // If remote has a matching message (by text and sender within same minute), clear optimistic
            const matched = remoteMessages.some(
              (rm) => rm.text === optMsg.text && rm.senderRole === optMsg.senderRole
            );
            if (matched || remoteIds.has(tempId)) {
              optimisticMapRef.current.delete(tempId);
            } else if (optMsg.status === 'sending' || optMsg.status === 'failed') {
              pendingOptimistic.push(optMsg);
            }
          });

          // Combine remote + remaining optimistic
          const combined = [...remoteMessages, ...pendingOptimistic];
          // Sort by timestamp
          combined.sort(
            (a, b) => new Date(a.timestamp || a.createdAt || 0).getTime() - new Date(b.timestamp || b.createdAt || 0).getTime()
          );

          setMessages(combined);
        } else if (fallbackMessages.length > 0) {
          setMessages(fallbackMessages);
        }
      },
      (err) => {
        console.warn(`[useOrderChat] Error on order ${orderId}:`, err);
      }
    );

    // Mark messages as read when opening conversation
    if (currentUserId) {
      markConversationAsRead(orderId, currentUserId).catch(() => {});
    }

    return () => {
      unsubscribe();
    };
  }, [orderId, currentUserId]);

  // Send message handler with optimistic UI
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !orderId) return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const nowIso = new Date().toISOString();

      const optimisticMsg: OrderMessage = {
        id: tempId,
        messageId: tempId,
        orderId,
        conversationId: orderId,
        senderId: currentUserId || '',
        senderRole: currentUserRole,
        senderName: currentUserName,
        text: text.trim(),
        timestamp: nowIso,
        createdAt: nowIso,
        type: 'TEXT',
        read: false,
        status: 'sending',
        isSystemEvent: false,
      };

      // 1. Immediately display in React State (Optimistic UI)
      optimisticMapRef.current.set(tempId, optimisticMsg);
      setMessages((prev) => [...prev, optimisticMsg]);
      setIsSending(true);
      setError(null);

      // 2. Parallel Firestore write directly
      try {
        const sentMsg = await sendChatMessage({
          orderId,
          senderId: currentUserId || '',
          senderRole: currentUserRole,
          senderName: currentUserName,
          text: text.trim(),
          type: 'TEXT',
          recipientId,
        });

        // Update optimistic state to 'sent'
        optimisticMapRef.current.delete(tempId);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...sentMsg, status: 'sent' } : m))
        );
      } catch (err: any) {
        console.error('[useOrderChat] Send error:', err);
        const failedMsg: OrderMessage = { ...optimisticMsg, status: 'failed' };
        optimisticMapRef.current.set(tempId, failedMsg);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? failedMsg : m))
        );
        setError(err.message || 'Failed to send message');
      } finally {
        setIsSending(false);
      }
    },
    [orderId, currentUserId, currentUserName, currentUserRole, recipientId]
  );

  // Retry sending a failed message
  const retryMessage = useCallback(
    async (failedMsg: OrderMessage) => {
      if (!failedMsg.text || !orderId) return;

      // Update state to 'sending'
      setMessages((prev) =>
        prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'sending' } : m))
      );

      try {
        const sentMsg = await sendChatMessage({
          orderId,
          senderId: currentUserId || '',
          senderRole: currentUserRole,
          senderName: currentUserName,
          text: failedMsg.text,
          type: 'TEXT',
          recipientId,
        });

        optimisticMapRef.current.delete(failedMsg.id);
        setMessages((prev) =>
          prev.map((m) => (m.id === failedMsg.id ? { ...sentMsg, status: 'sent' } : m))
        );
      } catch (err: any) {
        setMessages((prev) =>
          prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'failed' } : m))
        );
        setError(err.message || 'Retry failed');
      }
    },
    [orderId, currentUserId, currentUserName, currentUserRole, recipientId]
  );

  return {
    messages,
    sendMessage,
    retryMessage,
    isSending,
    sending: isSending,
    error,
  };
}
