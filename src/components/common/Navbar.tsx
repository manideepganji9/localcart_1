import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useAIChat } from '../../context/AIChatContext';
import { POPULAR_CITIES } from '../../constants/config';
import {
  Store,
  MapPin,
  Search,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Package,
} from 'lucide-react';
import { DEFAULT_AVATAR } from '../../services/imageStorageService';

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string, extra?: any) => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onNavigate,
  onOpenLogin,
  onOpenRegister,
}) => {
  const { currentUser, firebaseUser, isAuthenticated, userRole, logout, authStage, isLoading } = useAuth();
  const { currentCity, setCurrentCity, currentArea, setCurrentArea, orders, getSellerByUserId, customerLocation } = useStore();
  const { hasUnreadBuyerAi, clearBuyerAiUnread, isBuyerThinking } = useAIChat();
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const displayCity = customerLocation?.city || currentUser?.location?.city || currentCity;
  const displayArea = customerLocation?.area || currentUser?.location?.area || currentArea;

  const sellerProfile = currentUser?.role === 'SELLER' ? getSellerByUserId(currentUser.id) : null;

  // Pending orders badge count for seller
  const pendingOrdersCount = sellerProfile
    ? orders.filter(
        (o) =>
          o.sellerId === sellerProfile.id &&
          ['CONFIRMED', 'PENDING_SELLER_APPROVAL', 'ACCEPTED'].includes(o.status)
      ).length
    : 0;

  // Active orders count for buyer
  const activeBuyerOrdersCount = currentUser?.role === 'BUYER'
    ? orders.filter(
        (o) =>
          o.buyerId === currentUser.id &&
          ['CONFIRMED', 'PENDING_SELLER_APPROVAL', 'ACCEPTED', 'PREPARING', 'READY', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(o.status)
      ).length
    : 0;

  const handleCitySelect = (city: string, area?: string) => {
    setCurrentCity(city);
    if (area) setCurrentArea(area);
    setShowLocationMenu(false);
  };

  const isSeller = userRole === 'SELLER';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 sm:h-20 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (isSeller) onNavigate('seller-dashboard');
                else if (isAuthenticated) onNavigate('buyer-home');
                else onNavigate('landing');
              }}
              className="flex items-center gap-3 text-left group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-stone-950 text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-sm group-hover:bg-amber-600 transition-colors">
                LC
              </div>
              <div className="leading-tight">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-stone-950 font-display">
                  LocalCart
                </span>
                <span className="text-[10px] text-stone-400 block font-mono uppercase tracking-[0.15em]">
                  Local Marketplace
                </span>
              </div>
            </button>

            {/* Location Selector (for buyers and guests) */}
            {!isSeller && (
              <div className="relative ml-1 sm:ml-2">
                <button
                  onClick={() => setShowLocationMenu(!showLocationMenu)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-200 hover:border-stone-300 bg-stone-50 text-stone-800 text-xs font-medium transition cursor-pointer"
                >
                  <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="font-semibold text-stone-900">{displayCity}</span>
                  <span className="text-stone-500 hidden md:inline font-normal">· {displayArea}</span>
                  <ChevronDown className="h-3 w-3 text-stone-400" />
                </button>

                {showLocationMenu && (
                  <div className="absolute left-0 mt-2 w-64 bg-white border border-stone-200 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="text-[11px] font-semibold text-stone-500 px-3 py-1.5 mb-1 border-b border-stone-100 font-mono uppercase tracking-wider">
                      Select City
                    </div>
                    <div className="space-y-0.5">
                      {POPULAR_CITIES.map((c) => (
                        <button
                          key={c.city}
                          onClick={() => handleCitySelect(c.city, c.areas[0])}
                          className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between transition cursor-pointer ${
                            displayCity === c.city
                              ? 'bg-amber-50 text-amber-900 font-semibold'
                              : 'hover:bg-stone-50 text-stone-700'
                          }`}
                        >
                          <span>{c.city}</span>
                          <span className="text-[10px] text-stone-400 font-mono">{c.state}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setShowLocationMenu(false);
                        if (isAuthenticated) {
                          onNavigate('buyer-account');
                        } else {
                          onOpenLogin();
                        }
                      }}
                      className="w-full mt-1 pt-2 border-t border-stone-100 px-3 py-1.5 text-xs text-amber-700 hover:text-amber-800 font-medium text-left flex items-center gap-1.5 cursor-pointer hover:bg-amber-50 rounded-lg transition"
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Set precise location →</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center Navigation Links for Authenticated Buyers Only */}
          {isAuthenticated && !isSeller && (
            <nav className="hidden lg:flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => onNavigate('buyer-home')}
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition cursor-pointer ${
                  currentTab === 'buyer-home' || currentTab === 'landing'
                    ? 'text-stone-950 bg-stone-100'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-50'
                }`}
              >
                Discover
              </button>

              <button
                onClick={() => onNavigate('buyer-search')}
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition cursor-pointer ${
                  currentTab === 'buyer-search'
                    ? 'text-stone-950 bg-stone-100'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-50'
                }`}
              >
                Search
              </button>

              <button
                onClick={() => {
                  clearBuyerAiUnread();
                  onNavigate('buyer-ai');
                }}
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5 ${
                  currentTab === 'buyer-ai'
                    ? 'text-amber-800 bg-amber-50'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>LocalCart Assistant</span>
                {hasUnreadBuyerAi && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="New AI Response" />
                )}
                {isBuyerThinking && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" title="Thinking..." />
                )}
              </button>

              {isAuthenticated && (
                <button
                  onClick={() => onNavigate('buyer-orders')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5 ${
                    currentTab === 'buyer-orders'
                      ? 'text-stone-950 bg-stone-100'
                      : 'text-stone-600 hover:text-stone-950 hover:bg-stone-50'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-stone-500" />
                  <span>My Orders</span>
                  {activeBuyerOrdersCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                  )}
                </button>
              )}
            </nav>
          )}

          {/* Right Navigation & User Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            
            {/* SELLER MODE HEADER CONTROLS */}
            {isSeller ? (
              <div className="flex items-center gap-2 sm:gap-3">
                {sellerProfile && (
                  <button
                    onClick={() => onNavigate('business-room-view', { sellerId: sellerProfile.id })}
                    className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 rounded-full text-xs font-semibold transition cursor-pointer"
                    title="View your public storefront"
                  >
                    <Store className="h-3.5 w-3.5 text-emerald-700" />
                    <span>View My Store</span>
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </button>
                )}

                <button
                  onClick={() => onNavigate('seller-orders')}
                  className="relative p-2.5 rounded-full border border-stone-200 hover:border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 transition cursor-pointer"
                  title="Manage Orders"
                >
                  <Package className="h-4 w-4" />
                  {pendingOrdersCount > 0 && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-amber-600 text-white font-bold text-[10px] rounded-full">
                      {pendingOrdersCount}
                    </span>
                  )}
                </button>
              </div>
            ) : isAuthenticated ? (
              /* BUYER HEADER CONTROLS: Search shortcut for mobile only */
              <button
                onClick={() => onNavigate('buyer-search')}
                aria-label="Search"
                className="lg:hidden p-2.5 rounded-full border border-stone-200 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
              >
                <Search className="h-4 w-4" />
              </button>
            ) : null}

            {/* Profile Dropdown or Sign-in CTAs */}
            {isLoading ? (
              <div className="h-9 w-24 bg-stone-100/90 rounded-full animate-pulse" />
            ) : (firebaseUser && (isAuthenticated || authStage === 'onboarding')) ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-1.5 p-1 rounded-full border border-stone-200 hover:border-stone-300 bg-stone-50 transition cursor-pointer"
                >
                  <img
                    src={currentUser?.avatarUrl || DEFAULT_AVATAR}
                    alt={currentUser?.fullName || 'User'}
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  <ChevronDown className="h-3 w-3 text-stone-400 mr-1" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-60 bg-white border border-stone-200 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2.5 border-b border-stone-100">
                      <p className="text-xs font-bold text-stone-900 truncate">{currentUser?.fullName || 'New User'}</p>
                      <p className="text-[11px] text-stone-500 truncate font-mono">{currentUser?.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-stone-100 text-stone-700 text-[9px] uppercase font-mono tracking-wider rounded-md">
                        {authStage === 'onboarding'
                          ? 'Setup In Progress'
                          : currentUser?.role === 'SELLER'
                          ? 'Seller Account'
                          : 'Buyer Account'}
                      </span>
                    </div>

                    <div className="py-1 space-y-0.5">
                      {authStage === 'onboarding' ? (
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onNavigate('role-selection');
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-amber-800 hover:bg-amber-50 rounded-lg flex items-center gap-2 cursor-pointer font-medium"
                        >
                          <Store className="h-3.5 w-3.5 text-amber-600" />
                          <span>Choose Account Type</span>
                        </button>
                      ) : isSeller ? (
                        <>
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              onNavigate('seller-dashboard');
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 rounded-lg flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <Store className="h-3.5 w-3.5 text-stone-500" />
                            <span>Seller Dashboard</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              onNavigate('seller-settings');
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 rounded-lg flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <UserIcon className="h-3.5 w-3.5 text-stone-500" />
                            <span>Store Settings</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              onNavigate('buyer-orders');
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 rounded-lg flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <Package className="h-3.5 w-3.5 text-stone-500" />
                            <span>My Orders</span>
                          </button>
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              onNavigate('buyer-account');
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 rounded-lg flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <UserIcon className="h-3.5 w-3.5 text-stone-500" />
                            <span>My Profile & Location</span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="pt-1 border-t border-stone-100">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                          onNavigate('landing');
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-red-700 hover:bg-red-50 rounded-lg flex items-center gap-2 cursor-pointer font-medium transition"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenLogin}
                  className="px-4 py-2 text-xs font-semibold text-stone-800 hover:text-stone-950 transition cursor-pointer"
                >
                  Sign In
                </button>

                <button
                  onClick={onOpenRegister}
                  className="px-5 py-2 bg-stone-950 hover:bg-stone-800 text-white rounded-full text-xs font-semibold transition shadow-sm cursor-pointer"
                >
                  Join Free
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
