import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useAIChat } from '../../context/AIChatContext';
import {
  Home,
  Search,
  User,
  Sparkles,
  Package,
} from 'lucide-react';

interface BuyerLayoutProps {
  currentTab: string;
  onNavigate: (tab: string, extra?: any) => void;
  children: React.ReactNode;
}

export const BuyerLayout: React.FC<BuyerLayoutProps> = ({
  currentTab,
  onNavigate,
  children,
}) => {
  const { currentUser, isAuthenticated } = useAuth();
  const { orders } = useStore();
  const { hasUnreadBuyerAi, clearBuyerAiUnread, isBuyerThinking } = useAIChat();

  const activeOrdersCount = currentUser
    ? orders.filter(
        (o) =>
          o.buyerId === currentUser.id &&
          ['PENDING_SELLER_APPROVAL', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(
            o.status
          )
      ).length
    : 0;

  const buyerNavItems = [
    { id: 'buyer-home', label: 'Discover', icon: Home },
    { id: 'buyer-search', label: 'Search', icon: Search },
    {
      id: 'buyer-ai',
      label: 'LocalCart Assistant',
      icon: Sparkles,
      highlight: true,
      hasDot: hasUnreadBuyerAi,
      isThinking: isBuyerThinking,
    },
    ...(isAuthenticated
      ? [
          {
            id: 'buyer-orders',
            label: 'My Orders',
            icon: Package,
            badge: activeOrdersCount > 0 ? activeOrdersCount : null,
          },
        ]
      : []),
    { id: 'buyer-account', label: 'My Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6] pb-24 sm:pb-12 text-stone-900">
      {/* Sub-header Navigation Bar for Buyers on Desktop */}
      <div className="bg-white border-b border-stone-200 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-1 sm:gap-2">
              {buyerNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'buyer-ai') clearBuyerAiUnread();
                      onNavigate(item.id);
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold tracking-wider uppercase transition cursor-pointer rounded-lg relative ${
                      isActive
                        ? 'bg-stone-100 text-stone-950 font-bold border-b-2 border-stone-950'
                        : item.highlight
                        ? 'text-amber-800 hover:bg-amber-50'
                        : 'text-stone-600 hover:text-stone-950 hover:bg-stone-50'
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 ${
                        isActive
                          ? 'text-stone-950'
                          : item.highlight
                          ? 'text-amber-600'
                          : 'text-stone-400'
                      }`}
                    />
                    <span>{item.label}</span>
                    {item.hasDot && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="New AI reply" />
                    )}
                    {item.isThinking && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" title="Thinking..." />
                    )}
                    {item.badge !== null && item.badge !== undefined && (
                      <span className="px-1.5 py-0.2 bg-amber-600 text-white rounded-full font-mono text-[9px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500 flex items-center gap-2 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
              <span>Direct Neighborhood Connection · Locked Final Bills</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Buyer View Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar for Shoppers */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200 py-2 px-3 flex items-center justify-around shadow-lg">
        {buyerNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'buyer-ai') clearBuyerAiUnread();
                onNavigate(item.id);
              }}
              className={`flex flex-col items-center gap-1 py-1 px-2.5 transition relative ${
                isActive ? 'text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              <div className="relative">
                <Icon className="h-4 w-4" />
                {item.hasDot && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
                {item.isThinking && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>
              <span className="text-[10px] tracking-wide">{item.label}</span>
              {item.badge !== null && item.badge !== undefined && (
                <span className="absolute top-0 right-1 px-1.5 py-0.2 bg-amber-600 text-white rounded-full font-mono text-[8px] font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
