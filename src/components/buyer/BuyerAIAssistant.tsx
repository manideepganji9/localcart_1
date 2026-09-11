import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Product, AIChatMessage } from '../../types';
import { aiSearchConcierge } from '../../services/geminiService';
import { subscribeToUserAIChat, saveUserAIChatMessage, clearUserAIChat } from '../../services/aiChatService';
import { ChatAvatar } from '../common/ChatAvatar';
import {
  Send,
  Bot,
  Plus,
  Loader2,
  Trash2,
  Sparkles,
  Store,
  Copy,
  Check,
  ShoppingBag,
  ExternalLink,
  User,
} from 'lucide-react';
import { DEFAULT_PRODUCT_IMAGE } from '../../services/imageStorageService';

interface BuyerAIAssistantProps {
  initialQuery?: string;
  onOpenProductDetail: (product: Product) => void;
  onOpenBusinessRoom: (sellerId: string) => void;
  onOpenOrderDrawer: (sellerId: string) => void;
  onOpenLogin?: () => void;
}

export const BuyerAIAssistant: React.FC<BuyerAIAssistantProps> = ({
  initialQuery = '',
  onOpenProductDetail,
  onOpenBusinessRoom,
  onOpenOrderDrawer,
  onOpenLogin,
}) => {
  const { currentUser, isAuthenticated } = useAuth();
  const { products, sellerProfiles, orders, currentCity, currentArea, addToCart } = useStore();

  const buyerOrders = currentUser ? orders.filter((o) => o.buyerId === currentUser.id) : [];

  const [inputQuery, setInputQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingHistory, setIsSyncingHistory] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const defaultWelcomeMessage: AIChatMessage = {
    id: 'welcome-default',
    userId: currentUser?.id || 'guest',
    role: 'ai',
    text: `Hello${currentUser?.fullName ? ` ${currentUser.fullName}` : ''}! I am your LocalCart Assistant for ${currentCity}. Ask me about any local products, prices, gifts, bakeries, fashion, or store recommendations nearby.`,
    createdAt: new Date().toISOString(),
  };

  const [chatHistory, setChatHistory] = useState<AIChatMessage[]>([defaultWelcomeMessage]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasHandledInitialQuery = useRef(false);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleClearChat = async () => {
    setIsClearing(true);
    try {
      if (currentUser?.id) {
        await clearUserAIChat(currentUser.id);
      }
      setChatHistory([defaultWelcomeMessage]);
      setShowClearConfirm(false);
    } catch (err) {
      console.error('[BuyerAIAssistant] Error clearing chat history:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleCopyText = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Subscribe to persistent Firestore chat history for the active authenticated user
  useEffect(() => {
    if (!currentUser?.id) {
      setIsSyncingHistory(false);
      setChatHistory([defaultWelcomeMessage]);
      return;
    }

    setIsSyncingHistory(true);

    const unsubscribe = subscribeToUserAIChat(
      currentUser.id,
      (persistedMessages) => {
        if (persistedMessages.length > 0) {
          // Enrich products with latest live catalog data if available
          const enriched = persistedMessages.map((msg) => {
            if (msg.matchedProducts && msg.matchedProducts.length > 0) {
              const liveMatched = msg.matchedProducts.map((p) => {
                const live = products.find((lp) => lp.id === p.id);
                return live ? { ...p, ...live } : p;
              });
              return { ...msg, matchedProducts: liveMatched };
            }
            return msg;
          });

          setChatHistory(enriched);
        } else {
          // New user with no prior history in Firestore
          setChatHistory([defaultWelcomeMessage]);
        }
        setIsSyncingHistory(false);
      },
      (err) => {
        console.warn('[BuyerAIAssistant] Error receiving Firestore chat history:', err);
        setIsSyncingHistory(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id, products, currentCity]);

  // Scroll down when chat messages update or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  const runConciergeQuery = async (queryText: string) => {
    const cleanQuery = queryText.trim();
    if (!cleanQuery) return;

    const userMessageId = `msg-u-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const userMsg: AIChatMessage = {
      id: userMessageId,
      userId: currentUser?.id || 'guest',
      role: 'user',
      text: cleanQuery,
      createdAt: nowIso,
    };

    // 1. Instant User Message: Optimistically show user message immediately in chat
    setChatHistory((prev) => {
      const filtered = prev.filter((m) => m.id !== userMessageId && m.id !== 'welcome-default');
      return [...filtered, userMsg];
    });

    setInputQuery('');
    // 2. Immediate Thinking state: User sees the assistant working right away
    setIsLoading(true);

    // Persist user message to Firestore if authenticated
    if (currentUser?.id) {
      saveUserAIChatMessage(currentUser.id, userMsg).catch((err) => {
        console.warn('[BuyerAIAssistant] Could not save user message to Firestore:', err);
      });
    }

    try {
      // Query the live AI concierge service grounded strictly in current live Firestore catalog
      const response = await aiSearchConcierge(
        cleanQuery,
        products,
        sellerProfiles,
        { city: currentCity, area: currentArea },
        buyerOrders
      );

      const aiMessageId = `msg-ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const aiMsg: AIChatMessage = {
        id: aiMessageId,
        userId: currentUser?.id || 'guest',
        role: 'ai',
        text: response.message,
        matchedProducts: response.matchedProducts,
        sellerTips: response.suggestions,
        createdAt: new Date().toISOString(),
      };

      // Optimistically append AI response
      setChatHistory((prev) => {
        const filtered = prev.filter((m) => m.id !== aiMessageId);
        return [...filtered, aiMsg];
      });

      // Persist AI response to Firestore
      if (currentUser?.id) {
        saveUserAIChatMessage(currentUser.id, aiMsg).catch((err) => {
          console.warn('[BuyerAIAssistant] Could not save AI message to Firestore:', err);
        });
      }
    } catch (err) {
      console.error('[BuyerAIAssistant] AI Concierge error:', err);
      const fallbackAiMsg: AIChatMessage = {
        id: `msg-err-${Date.now()}`,
        userId: currentUser?.id || 'guest',
        role: 'ai',
        text: 'I encountered a brief connection delay while checking local stores. Please try asking your question again.',
        createdAt: new Date().toISOString(),
      };
      setChatHistory((prev) => [...prev, fallbackAiMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle initialQuery if passed from other views
  useEffect(() => {
    if (initialQuery && !hasHandledInitialQuery.current) {
      hasHandledInitialQuery.current = true;
      runConciergeQuery(initialQuery);
    }
  }, [initialQuery]);

  const quickPrompts = [
    'Handcrafted chocolate cakes under ₹900',
    'Fresh sourdough & local bakery',
    'Organic spices & whole grains',
    'Silver earrings & bespoke jewelry',
  ];

  return (
    <div className="space-y-6 text-stone-900 pb-16">
      {/* Header Container */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-800 font-semibold font-mono">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span>Local Shopping Assistant</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1 flex items-center gap-2">
              <span>LocalCart Assistant</span>
              <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {currentCity}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Real-time recommendations strictly grounded in verified local shop inventories.
            </p>
          </div>

          {/* Clear Chat Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {showClearConfirm ? (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 p-1.5 px-3 rounded-2xl">
                <span className="text-xs text-rose-800 font-medium">Clear history?</span>
                <button
                  type="button"
                  onClick={handleClearChat}
                  disabled={isClearing}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-full transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isClearing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  <span>{isClearing ? 'Clearing...' : 'Confirm'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  disabled={isClearing}
                  className="px-3 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 text-xs rounded-full transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (chatHistory.length <= 1 && chatHistory[0]?.id === 'welcome-default') return;
                  setShowClearConfirm(true);
                }}
                disabled={chatHistory.length <= 1 && chatHistory[0]?.id === 'welcome-default'}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-700 hover:text-stone-950 text-xs font-medium rounded-full transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Clear conversation history"
              >
                <Trash2 className="h-3.5 w-3.5 text-stone-500" />
                <span>Clear Chat</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="pt-4 border-t border-stone-100 mt-5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold font-mono mr-1">
            Suggestions:
          </span>
          {quickPrompts.map((prompt, pIdx) => (
            <button
              key={pIdx}
              onClick={() => runConciergeQuery(prompt)}
              disabled={isLoading}
              className="px-3.5 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 hover:text-stone-950 text-xs font-medium rounded-full transition cursor-pointer disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="bg-white border border-stone-200 rounded-3xl flex flex-col h-[620px] shadow-xs overflow-hidden">
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {chatHistory.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Profile Photo: Canonical profile photo for authenticated buyer; Bot icon for AI */}
                {isUser ? (
                  <ChatAvatar
                    userId={currentUser?.id}
                    name={currentUser?.fullName || 'Buyer'}
                    isCurrentUser={true}
                    currentUserAvatar={currentUser?.avatarUrl}
                    sizeClassName="w-8 h-8 rounded-full shrink-0 border border-stone-200 shadow-xs"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-amber-100 text-amber-800 border border-amber-200 shadow-xs">
                    <Bot className="h-4 w-4 text-amber-700" />
                  </div>
                )}

                {/* Message Content Bubble */}
                <div
                  className={`p-4 max-w-xl text-xs space-y-3 rounded-2xl ${
                    isUser
                      ? 'bg-stone-950 text-white rounded-tr-none'
                      : 'bg-stone-50 text-stone-900 border border-stone-200 rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-line leading-relaxed">{msg.text}</div>

                  {/* Matched Product Cards */}
                  {msg.matchedProducts && msg.matchedProducts.length > 0 && (
                    <div className="pt-3 border-t border-stone-200 space-y-2.5">
                      <span className="text-[10px] uppercase tracking-wider text-amber-800 font-bold font-mono block">
                        Matching Items in {currentCity} ({msg.matchedProducts.length}):
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {msg.matchedProducts.map((prod) => (
                          <div
                            key={prod.id}
                            className="bg-white p-3 border border-stone-200 rounded-2xl flex flex-col justify-between shadow-xs hover:border-amber-400 transition"
                          >
                            <div
                              onClick={() => onOpenProductDetail(prod)}
                              className="flex items-start gap-3 cursor-pointer"
                            >
                              <img
                                src={prod.imageUrl || DEFAULT_PRODUCT_IMAGE}
                                alt={prod.name}
                                className="w-14 h-14 object-cover rounded-xl border border-stone-100 shrink-0 bg-stone-100"
                                onError={(e) => {
                                  e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                                }}
                              />
                              <div className="min-w-0">
                                <h5 className="font-semibold text-xs text-stone-900 truncate hover:text-amber-800 transition">
                                  {prod.name}
                                </h5>
                                <div className="text-[10px] text-stone-500 truncate mt-0.5">
                                  🏪 {prod.businessName}
                                </div>
                                <div className="text-sm font-bold text-stone-900 mt-1">
                                  ₹{prod.finalPrice}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-stone-100 flex items-center gap-2">
                              {isAuthenticated ? (
                                <button
                                  onClick={() => {
                                    addToCart(prod.sellerId, prod, 1);
                                    onOpenOrderDrawer(prod.sellerId);
                                  }}
                                  className="flex-1 py-1.5 px-2.5 bg-stone-950 hover:bg-stone-800 text-white text-[11px] font-semibold rounded-full transition flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>Add to Bill</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => (onOpenLogin ? onOpenLogin() : onOpenProductDetail(prod))}
                                  className="flex-1 py-1.5 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-900 text-[11px] font-semibold rounded-full transition flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <User className="h-3 w-3" />
                                  <span>Sign in</span>
                                </button>
                              )}

                              <button
                                onClick={() => onOpenBusinessRoom(prod.sellerId)}
                                className="p-1.5 text-stone-600 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 rounded-full transition cursor-pointer"
                                title="View Store"
                              >
                                <Store className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Copy message button */}
                  {!isUser && (
                    <div className="pt-2 border-t border-stone-200 flex justify-end">
                      <button
                        onClick={() => handleCopyText(msg.text, msg.id)}
                        className="text-[10px] text-stone-400 hover:text-stone-700 flex items-center gap-1 transition cursor-pointer"
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span className="text-emerald-700 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Thinking State */}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-amber-100 text-amber-800 border border-amber-200 shadow-xs">
                <Bot className="h-4 w-4 text-amber-700" />
              </div>
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl rounded-tl-none flex items-center gap-2 text-stone-600">
                <div className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="text-xs font-medium">Checking local catalogs...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-stone-200 bg-stone-50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runConciergeQuery(inputQuery);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask about cakes, jewelry, decor, spices, or gifts in your city..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-white border border-stone-200 rounded-2xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              className="px-5 py-3 bg-stone-950 hover:bg-stone-800 text-white rounded-2xl text-xs font-semibold disabled:opacity-40 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">Ask</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
