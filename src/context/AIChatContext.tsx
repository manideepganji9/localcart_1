import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { Product, SellerProfile, Order, AIChatMessage } from '../types';
import { aiSearchConcierge, askSellerAIAssistantStream } from '../services/geminiService';
import { saveUserAIChatMessage, subscribeToUserAIChat } from '../services/aiChatService';
import { db, doc, getDoc, setDoc } from '../services/firebase';

interface AIChatContextType {
  // Buyer AI state
  isBuyerThinking: boolean;
  hasUnreadBuyerAi: boolean;
  clearBuyerAiUnread: () => void;
  sendBuyerQuery: (
    queryText: string,
    allProducts: Product[],
    allSellers: SellerProfile[],
    buyerOrders: Order[],
    userLocation: { city: string; area?: string }
  ) => Promise<void>;

  // Seller AI state
  isSellerThinking: boolean;
  hasUnreadSellerAi: boolean;
  clearSellerAiUnread: () => void;
  currentSellerStreamingText: string;
  sendSellerQuery: (
    queryText: string,
    seller: SellerProfile,
    products: Product[],
    orders: Order[],
    history: Array<{ role: 'ai' | 'user'; text: string }>
  ) => Promise<void>;

  // Tab tracking to know if user is currently looking at AI
  activeAppTab: string;
  setActiveAppTab: (tab: string) => void;
}

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

export const AIChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [activeAppTab, setActiveAppTab] = useState<string>('landing');
  const activeTabRef = useRef(activeAppTab);
  useEffect(() => {
    activeTabRef.current = activeAppTab;
    if (activeAppTab === 'buyer-ai') {
      setHasUnreadBuyerAi(false);
    }
    if (activeAppTab === 'seller-ai') {
      setHasUnreadSellerAi(false);
    }
  }, [activeAppTab]);

  // Buyer AI
  const [isBuyerThinking, setIsBuyerThinking] = useState(false);
  const [hasUnreadBuyerAi, setHasUnreadBuyerAi] = useState(false);

  // Seller AI
  const [isSellerThinking, setIsSellerThinking] = useState(false);
  const [hasUnreadSellerAi, setHasUnreadSellerAi] = useState(false);
  const [currentSellerStreamingText, setCurrentSellerStreamingText] = useState('');

  const clearBuyerAiUnread = () => setHasUnreadBuyerAi(false);
  const clearSellerAiUnread = () => setHasUnreadSellerAi(false);

  /**
   * Sends a Buyer AI query asynchronously in the background.
   * Does not fail or abort even if user navigates away from Buyer AI page!
   */
  const sendBuyerQuery = async (
    queryText: string,
    allProducts: Product[],
    allSellers: SellerProfile[],
    buyerOrders: Order[],
    userLocation: { city: string; area?: string }
  ) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery) return;

    const userMessageId = `msg-u-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const userId = currentUser?.id || 'guest';

    const userMsg: AIChatMessage = {
      id: userMessageId,
      userId,
      role: 'user',
      text: cleanQuery,
      createdAt: nowIso,
    };

    // Save user message to Firestore immediately
    if (currentUser?.id) {
      saveUserAIChatMessage(currentUser.id, userMsg).catch((err) => {
        console.warn('[AIChatContext] Failed to save user message to Firestore:', err);
      });
    }

    setIsBuyerThinking(true);

    try {
      // Execute query against live catalog and Gemini service
      const response = await aiSearchConcierge(
        cleanQuery,
        allProducts,
        allSellers,
        userLocation,
        buyerOrders
      );

      const aiMessageId = `msg-ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const aiMsg: AIChatMessage = {
        id: aiMessageId,
        userId,
        role: 'ai',
        text: response.message,
        matchedProducts: response.matchedProducts,
        sellerTips: response.suggestions,
        createdAt: new Date().toISOString(),
      };

      // Save AI response to Firestore
      if (currentUser?.id) {
        await saveUserAIChatMessage(currentUser.id, aiMsg);
      }

      // If user is currently on another tab, flag unread message
      if (activeTabRef.current !== 'buyer-ai') {
        setHasUnreadBuyerAi(true);
      }
    } catch (err) {
      console.error('[AIChatContext] Error processing buyer AI query in background:', err);
      const errorMsg: AIChatMessage = {
        id: `msg-err-${Date.now()}`,
        userId,
        role: 'ai',
        text: 'I encountered a temporary connection issue while querying the local catalog. Please try again.',
        createdAt: new Date().toISOString(),
      };
      if (currentUser?.id) {
        saveUserAIChatMessage(currentUser.id, errorMsg).catch(() => {});
      }
    } finally {
      setIsBuyerThinking(false);
    }
  };

  /**
   * Sends a Seller AI query asynchronously in the background.
   */
  const sendSellerQuery = async (
    queryText: string,
    seller: SellerProfile,
    products: Product[],
    orders: Order[],
    history: Array<{ role: 'ai' | 'user'; text: string }>
  ) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery || !currentUser?.id) return;

    setIsSellerThinking(true);
    setCurrentSellerStreamingText('');

    const storageKey = `localcart_seller_ai_history_${currentUser.id}`;
    const userMsg = { role: 'user' as const, text: cleanQuery };

    // Update local storage history optimistically
    try {
      const existingStr = localStorage.getItem(storageKey);
      const existing = existingStr ? JSON.parse(existingStr) : [];
      existing.push(userMsg);
      localStorage.setItem(storageKey, JSON.stringify(existing));
    } catch (e) {
      // Ignore local storage error
    }

    let finalAiText = '';
    let finalSuggestions: string[] = [];

    try {
      await askSellerAIAssistantStream({
        userQuery: cleanQuery,
        sellerProfile: seller,
        products,
        orders,
        currentUserUid: currentUser.id,
        history,
        onChunk: (chunk) => {
          finalAiText = chunk;
          setCurrentSellerStreamingText(chunk);
        },
        onDone: (suggestions) => {
          finalSuggestions = suggestions;
        },
      });

      // Save completed AI message to persistent storage & Firestore
      const aiMsg = {
        role: 'ai' as const,
        text: finalAiText || 'I have analyzed your store records.',
        tips: finalSuggestions,
      };

      try {
        const existingStr = localStorage.getItem(storageKey);
        const existing = existingStr ? JSON.parse(existingStr) : [];
        existing.push(aiMsg);
        localStorage.setItem(storageKey, JSON.stringify(existing));

        // Sync to Firestore
        const chatDocRef = doc(db, 'users', currentUser.id, 'aiChats', 'seller_assistant');
        await setDoc(chatDocRef, { messages: existing, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (e) {
        console.warn('[AIChatContext] Failed to persist seller AI history:', e);
      }

      if (activeTabRef.current !== 'seller-ai') {
        setHasUnreadSellerAi(true);
      }
    } catch (err) {
      console.error('[AIChatContext] Error in seller AI query:', err);
    } finally {
      setIsSellerThinking(false);
      setCurrentSellerStreamingText('');
    }
  };

  return (
    <AIChatContext.Provider
      value={{
        isBuyerThinking,
        hasUnreadBuyerAi,
        clearBuyerAiUnread,
        sendBuyerQuery,
        isSellerThinking,
        hasUnreadSellerAi,
        clearSellerAiUnread,
        currentSellerStreamingText,
        sendSellerQuery,
        activeAppTab,
        setActiveAppTab,
      }}
    >
      {children}
    </AIChatContext.Provider>
  );
};

export const useAIChat = () => {
  const context = useContext(AIChatContext);
  if (!context) {
    throw new Error('useAIChat must be used within an AIChatProvider');
  }
  return context;
};
