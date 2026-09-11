import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { generateSellerInsightsFromData, askSellerAIAssistantStream } from '../../services/geminiService';
import { ChatAvatar } from '../common/ChatAvatar';
import { db, doc, getDoc, setDoc, deleteDoc } from '../../services/firebase';
import {
  Sparkles,
  Send,
  Lightbulb,
  Copy,
  Check,
  Trash2,
  Loader2,
  RotateCcw,
} from 'lucide-react';

interface ChatMessage {
  role: 'ai' | 'user';
  text: string;
  tips?: string[];
  streaming?: boolean;
}

export const SellerAIAssistant: React.FC = () => {
  const { currentUser } = useAuth();
  const { getSellerByUserId, products, orders } = useStore();

  const seller = currentUser ? getSellerByUserId(currentUser.id) : undefined;
  // Strictly scope to current authenticated seller's live Firestore records
  const sellerProducts = seller ? products.filter(p => p.sellerId === seller.id) : [];
  const sellerOrders = seller ? orders.filter(o => o.sellerId === seller.id) : [];

  const [inputQuery, setInputQuery] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const storageKey = currentUser ? `localcart_seller_ai_history_${currentUser.id}` : null;

  const initialWelcome: ChatMessage = {
    role: 'ai',
    text: `Hello ${currentUser?.fullName || 'Seller'}! I am your Seller AI Assistant for ${seller?.businessName || 'your store'}. I am grounded directly in your live inventory, orders, and sales data in ${seller?.location?.city || 'your city'}. Feel free to ask me anything about your products, stock levels, orders, or how to grow your business!`,
    tips: [
      'What products are low in stock?',
      'Which product is selling the most?',
      'How many orders did I receive?',
      'What is my total sales?',
      'Give me a summary of my store',
      'How can I improve my sales?'
    ]
  };

  // Initialize from localStorage for instant 0ms render
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse stored chat history:', e);
      }
    }
    return [initialWelcome];
  });

  // Background sync with Firestore on mount to preserve cross-device history
  useEffect(() => {
    if (!currentUser?.id) return;
    let isMounted = true;

    async function loadRemoteHistory() {
      try {
        const chatDocRef = doc(db, 'users', currentUser!.id, 'aiChats', 'seller_assistant');
        const snap = await getDoc(chatDocRef);
        if (snap.exists() && isMounted) {
          const data = snap.data();
          if (Array.isArray(data?.messages) && data.messages.length > 0) {
            setChatHistory(data.messages);
            if (storageKey) {
              localStorage.setItem(storageKey, JSON.stringify(data.messages));
            }
          }
        }
      } catch (e) {
        // Silently ignore remote sync errors, local storage is active
      }
    }

    loadRemoteHistory();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, storageKey]);

  // Persist chat history to localStorage and Firestore
  useEffect(() => {
    if (!storageKey || chatHistory.length === 0) return;

    // Filter out active streaming flag before persisting
    const cleanHistory = chatHistory.map(({ role, text, tips }) => ({ role, text, tips }));

    try {
      localStorage.setItem(storageKey, JSON.stringify(cleanHistory));
    } catch (e) {
      console.warn('Failed to persist chat history to localStorage:', e);
    }

    // Persist to Firestore only when not in an active stream chunk
    if (!loading && currentUser?.id) {
      const chatDocRef = doc(db, 'users', currentUser.id, 'aiChats', 'seller_assistant');
      setDoc(chatDocRef, {
        messages: cleanHistory,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    }
  }, [chatHistory, storageKey, loading, currentUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const handleClearChat = async () => {
    setChatHistory([initialWelcome]);
    setError(null);
    setLastFailedQuery(null);
    setShowClearConfirm(false);

    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
    }

    if (currentUser?.id) {
      try {
        const chatDocRef = doc(db, 'users', currentUser.id, 'aiChats', 'seller_assistant');
        await deleteDoc(chatDocRef);
      } catch (e) {
        console.warn('Failed to delete remote chat history:', e);
      }
    }
  };

  const insights = seller ? generateSellerInsightsFromData(seller, products, orders) : null;

  const handleAsk = async (queryText: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || loading) return;

    // 1. Optimistic UI: Immediately show user message
    const userMsg: ChatMessage = { role: 'user', text: q };
    const historyWithUser = [...chatHistory, userMsg];
    setChatHistory(historyWithUser);
    setInputQuery('');
    setLoading(true);
    setError(null);
    setLastFailedQuery(null);

    if (!seller) {
      setChatHistory(prev => [
        ...prev,
        {
          role: 'ai',
          text: 'Please complete your store setup first so I can access your store catalog and order data.',
        }
      ]);
      setLoading(false);
      return;
    }

    // 2. Add an empty AI placeholder with streaming indicator
    const aiMessageIndex = historyWithUser.length;
    setChatHistory(prev => [
      ...prev,
      {
        role: 'ai',
        text: '',
        streaming: true,
      }
    ]);

    try {
      await askSellerAIAssistantStream({
        userQuery: q,
        sellerProfile: seller,
        products: sellerProducts,
        orders: sellerOrders,
        currentUserUid: currentUser?.id || '',
        history: historyWithUser.map(m => ({ role: m.role, text: m.text })),
        onChunk: (accumulated) => {
          setChatHistory(prev => {
            const next = [...prev];
            if (next[aiMessageIndex]) {
              next[aiMessageIndex] = {
                ...next[aiMessageIndex],
                text: accumulated,
                streaming: true,
              };
            }
            return next;
          });
        },
        onDone: (suggestedQuestions) => {
          setChatHistory(prev => {
            const next = [...prev];
            if (next[aiMessageIndex]) {
              next[aiMessageIndex] = {
                ...next[aiMessageIndex],
                streaming: false,
                tips: suggestedQuestions && suggestedQuestions.length > 0 ? suggestedQuestions : undefined,
              };
            }
            return next;
          });
          setLoading(false);
        },
      });
    } catch (err: any) {
      console.error('Failed to get seller AI response:', err);
      setError('AI response failed. Please check your connection or try again.');
      setLastFailedQuery(q);

      setChatHistory(prev => {
        const next = [...prev];
        if (next[aiMessageIndex]) {
          if (!next[aiMessageIndex].text) {
            next[aiMessageIndex] = {
              role: 'ai',
              text: 'I ran into a temporary issue retrieving live store intelligence. Please click Retry below to try again.',
              streaming: false,
            };
          } else {
            next[aiMessageIndex] = {
              ...next[aiMessageIndex],
              streaming: false,
            };
          }
        }
        return next;
      });
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedQuery) {
      handleAsk(lastFailedQuery);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-8 text-[#F5F5F5]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-[#FFFFFF10]">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#E5C392] font-mono flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-[#E5C392]" /> Store Intelligence
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-white tracking-tight flex items-center gap-2.5 mt-0.5">
            <span>Seller AI Assistant</span>
          </h1>
          <p className="text-xs text-[#8E8E8E] mt-1 font-light">
            Contextual store intelligence grounded strictly in your live products, stock, and orders.
          </p>
        </div>

        {/* Clear Chat Controls with Confirmation Modal/Bar */}
        <div className="flex items-center gap-2 shrink-0">
          {showClearConfirm ? (
            <div className="flex items-center gap-2 bg-[#1A1A1A] border border-red-500/40 p-1.5 px-3 rounded-lg shadow-lg">
              <span className="text-[11px] text-red-300 font-medium">Clear this conversation?</span>
              <button
                type="button"
                onClick={handleClearChat}
                className="px-2.5 py-1 bg-red-900/80 hover:bg-red-800 border border-red-500/50 text-white text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer rounded"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-2.5 py-1 bg-[#242424] hover:bg-[#333] border border-[#FFFFFF20] text-[#AAA] hover:text-white text-[10px] transition cursor-pointer rounded"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (chatHistory.length <= 1) return;
                setShowClearConfirm(true);
              }}
              disabled={chatHistory.length <= 1}
              className="px-3.5 py-2 bg-[#161616] hover:bg-[#202020] border border-[#FFFFFF15] hover:border-[#E5C392]/40 text-[#999] hover:text-white text-[10px] uppercase tracking-[0.15em] font-mono transition flex items-center gap-1.5 disabled:opacity-30 disabled:hover:border-[#FFFFFF15] disabled:hover:text-[#999] cursor-pointer disabled:cursor-not-allowed rounded"
              title="Clear conversation history"
            >
              <Trash2 className="h-3.5 w-3.5 text-[#E5C392]" />
              <span>Clear Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Insights Cards */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.insights.map((ins, idx) => (
            <div
              key={idx}
              className="p-5 bg-[#141414] border border-[#FFFFFF15] space-y-2 rounded-lg"
            >
              <div className="font-serif text-sm text-white flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-[#E5C392] shrink-0" />
                <span>{ins.title}</span>
              </div>
              <p className="text-xs text-[#A0A0A0] leading-relaxed font-light">{ins.description}</p>
              {ins.actionableTip && (
                <p className="text-[#E5C392] text-[10px] font-mono pt-2 border-t border-[#FFFFFF0A]">
                  Recommendation: {ins.actionableTip}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Suggested Question Chips (Optional shortcuts) */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[#888]">
          Quick Suggestions (or type any question below):
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            'What products are low in stock?',
            'Which product is selling the most?',
            'How many orders did I receive?',
            'What is my total sales?',
            'Give me a summary of my store',
            'How can I improve my sales?',
            'How should I price my products?',
          ].map((suggestion, sIdx) => (
            <button
              key={sIdx}
              onClick={() => handleAsk(suggestion)}
              disabled={loading}
              className="px-3 py-1.5 bg-[#161616] hover:bg-[#202020] border border-[#FFFFFF18] hover:border-[#E5C392] text-[#CCC] hover:text-white text-xs transition cursor-pointer disabled:opacity-50 text-left rounded"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Container */}
      <div className="bg-[#121212] border border-[#FFFFFF18] flex flex-col h-[560px] rounded-xl overflow-hidden shadow-2xl">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${
                msg.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              {/* Avatar: Canonical profile photo for seller; Bot avatar for AI */}
              {msg.role === 'user' ? (
                <ChatAvatar
                  userId={currentUser?.id}
                  name={currentUser?.fullName || seller?.businessName || 'Seller'}
                  isCurrentUser={true}
                  currentUserAvatar={currentUser?.avatarUrl}
                  fallbackPhotoUrl={seller?.storePhotoUrl || seller?.logoUrl}
                  sizeClassName="w-8 h-8 rounded-full shrink-0 border border-white/20 shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-[#1A1A1A] text-[#E5C392] border-[#E5C392]/40 shadow-sm">
                  <Sparkles className="h-4 w-4 text-[#E5C392]" />
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`p-4 max-w-lg sm:max-w-xl text-xs leading-relaxed border rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-[#1E1E1E] text-white border-[#FFFFFF20] rounded-tr-none'
                    : 'bg-[#161616] text-[#D0D0D0] border-[#FFFFFF12] rounded-tl-none'
                }`}
              >
                {/* Streaming Placeholder (Thinking indicator) vs rendered text */}
                {msg.streaming && !msg.text ? (
                  <div className="flex items-center gap-2 py-0.5 text-[#BBB]">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E5C392] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E5C392] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E5C392] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[11px] font-medium tracking-wide">Thinking...</span>
                  </div>
                ) : (
                  <>
                    <div className="whitespace-pre-line font-light">{msg.text}</div>
                    {msg.streaming && (
                      <span className="inline-block w-1.5 h-3 bg-[#E5C392] animate-pulse ml-1 align-middle" />
                    )}
                  </>
                )}

                {/* Copy Button for completed AI messages */}
                {msg.role === 'ai' && !msg.streaming && msg.text && (
                  <div className="mt-3 pt-2 border-t border-[#FFFFFF10] flex justify-end">
                    <button
                      onClick={() => handleCopy(msg.text, idx)}
                      className="text-[9px] uppercase tracking-wider font-mono text-[#888] hover:text-[#E5C392] flex items-center gap-1 transition cursor-pointer"
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check className="h-3 w-3 text-[#86EFAC]" />
                          <span className="text-[#86EFAC]">Copied to Clipboard</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy Answer</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Contextual Follow-up Chips */}
                {!msg.streaming && msg.tips && msg.tips.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#FFFFFF10] space-y-1.5">
                    <span className="text-[9px] uppercase tracking-[0.2em] font-mono text-[#777] block">
                      Follow-up Suggestions:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.tips.map((tip, tIdx) => (
                        <button
                          key={tIdx}
                          onClick={() => handleAsk(tip)}
                          disabled={loading}
                          className="px-2.5 py-1 bg-[#121212] border border-[#FFFFFF15] hover:border-[#E5C392]/50 text-[#AAA] hover:text-white text-[10px] transition text-left cursor-pointer rounded"
                        >
                          {tip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Error Banner with Retry Button */}
          {error && !loading && (
            <div className="p-3.5 bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center justify-between gap-3 rounded-lg">
              <span className="font-light">{error}</span>
              {lastFailedQuery && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-3 py-1 bg-red-900/80 hover:bg-red-800 border border-red-500/50 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shrink-0"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3.5 bg-[#141414] border-t border-[#FFFFFF15]">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleAsk(inputQuery);
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={e => setInputQuery(e.target.value)}
              placeholder="Ask anything about your products, stock, sales, orders, or business advice..."
              className="flex-1 px-4 py-2.5 bg-[#181818] border border-[#FFFFFF15] text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-[#E5C392] rounded"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || loading}
              className="px-5 py-2.5 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-[0.2em] font-semibold disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed rounded"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span>Ask</span>
                  <Send className="h-3 w-3" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default SellerAIAssistant;

