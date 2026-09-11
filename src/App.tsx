import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider, useStore } from './context/StoreContext';
import { AIChatProvider } from './context/AIChatContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { LoginModal } from './components/auth/LoginModal';
import { RegisterModal } from './components/auth/RegisterModal';
import { RoleSelectionScreen } from './components/auth/RoleSelectionScreen';
import { SellerOnboarding } from './components/auth/SellerOnboarding';
import { BuyerOnboarding } from './components/auth/BuyerOnboarding';
import { LandingPage } from './components/landing/LandingPage';

// Buyer Components
import { BuyerLayout } from './components/buyer/BuyerLayout';
import { BuyerHome } from './components/buyer/BuyerHome';
import { BuyerSearch } from './components/buyer/BuyerSearch';
import { BusinessRoomView } from './components/buyer/BusinessRoomView';
import { ProductDetailModal } from './components/buyer/ProductDetailModal';
import { OrderBillDrawer } from './components/buyer/OrderBillDrawer';
import { BuyerOrders } from './components/buyer/BuyerOrders';
import { BuyerAIAssistant } from './components/buyer/BuyerAIAssistant';
import { BuyerAccount } from './components/buyer/BuyerAccount';

// Seller Components
import { SellerLayout } from './components/seller/SellerLayout';
import { SellerDashboard } from './components/seller/SellerDashboard';
import { SellerBusinessRoom } from './components/seller/SellerBusinessRoom';
import { SellerProducts } from './components/seller/SellerProducts';
import { SellerOrders } from './components/seller/SellerOrders';
import { SellerCustomers } from './components/seller/SellerCustomers';
import { SellerAnalytics } from './components/seller/SellerAnalytics';
import { SellerAIAssistant } from './components/seller/SellerAIAssistant';
import { SellerSettings } from './components/seller/SellerSettings';

import { Product } from './types';
import { CheckCircle2, ShoppingBag, Loader2, AlertCircle } from 'lucide-react';

const MainApp: React.FC = () => {
  const { currentUser, role, isAuthenticated, isLoading, authStage, authError, retryProfileLoad, logout } = useAuth();
  const { getSellerByUserId, sellerProfiles } = useStore();

  // Navigation State
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (!currentUser) return 'landing';
    return currentUser.role === 'SELLER' ? 'seller-dashboard' : 'buyer-home';
  });

  const [activeSellerIdForView, setActiveSellerIdForView] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>('');
  const [aiInitialQuery, setAiInitialQuery] = useState<string>('');

  // Modals & Drawers
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [activeProductDetail, setActiveProductDetail] = useState<Product | null>(null);
  const [activeDrawerSellerId, setActiveDrawerSellerId] = useState<string | null>(null);
  const [isAddProductOpenFromDashboard, setIsAddProductOpenFromDashboard] = useState(false);

  // Success notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Enforce strict unauthenticated & role-based routing upon auth state change or tab navigation
  useEffect(() => {
    if (authStage === 'loading' || authStage === 'profile-loading') return;

    if (authStage === 'unauthenticated') {
      // Unauthenticated visitors may ONLY access the public Discover page ('landing')
      if (currentTab !== 'landing') {
        setCurrentTab('landing');
      }
    } else if (authStage === 'onboarding') {
      if (currentTab !== 'role-selection') {
        setCurrentTab('role-selection');
      }
    } else if (authStage === 'seller') {
      // If seller is on landing or any buyer marketplace tab, automatically redirect directly to seller dashboard
      const buyerOnlyTabs = ['landing', 'role-selection', 'buyer-home', 'buyer-search', 'buyer-orders', 'buyer-ai', 'buyer-account'];
      if (buyerOnlyTabs.includes(currentTab)) {
        setCurrentTab('seller-dashboard');
      }
    } else if (authStage === 'buyer') {
      const sellerOnlyTabs = ['landing', 'role-selection', 'seller-dashboard', 'seller-business-room', 'seller-products', 'seller-orders', 'seller-customers', 'seller-analytics', 'seller-ai', 'seller-settings'];
      if (sellerOnlyTabs.includes(currentTab)) {
        setCurrentTab('buyer-home');
      }
    }
  }, [authStage, currentTab]);

  const handleNavigate = (tab: string, extra?: any) => {
    // Unauthenticated visitors: only landing / public Discover page is accessible
    if (authStage === 'unauthenticated') {
      if (tab !== 'landing') {
        setCurrentTab('landing');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // Users in onboarding state must complete role selection
    if (authStage === 'onboarding') {
      if (tab !== 'role-selection') {
        setCurrentTab('role-selection');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // Seller route guard: Sellers must not access public marketplace / buyer discovery
    if (currentUser?.role === 'SELLER') {
      const buyerOnlyTabs = ['landing', 'role-selection', 'buyer-home', 'buyer-search', 'buyer-orders', 'buyer-ai', 'buyer-account'];
      if (buyerOnlyTabs.includes(tab)) {
        setCurrentTab('seller-dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    if (tab === 'business-room-view') {
      if (extra?.sellerId) {
        setActiveSellerIdForView(extra.sellerId);
      } else if (currentUser?.role === 'SELLER') {
        const s = getSellerByUserId(currentUser.id);
        if (s) setActiveSellerIdForView(s.id);
      }
    } else if (tab === 'buyer-search') {
      if (extra?.category) setActiveCategoryFilter(extra.category);
      if (extra?.query !== undefined) setActiveSearchQuery(extra.query);
    } else if (tab === 'buyer-ai') {
      if (extra?.initialQuery) setAiInitialQuery(extra.initialQuery);
    }

    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle successful registration -> role selection
  const handleRegisterSuccess = () => {
    setIsRegisterOpen(false);
    setCurrentTab('role-selection');
  };

  // Handle post-onboarding complete
  const handleOnboardingComplete = () => {
    if (currentUser?.role === 'SELLER') {
      setCurrentTab('seller-dashboard');
      showToast('🎉 Store created successfully! Welcome to your seller dashboard.');
    } else {
      setCurrentTab('buyer-home');
      showToast('🎉 Welcome to LocalCart! Start discovering local neighborhood stores.');
    }
  };

  // Handle order placed (Immediate Confirmation Flow)
  const handleOrderPlaced = (orderId: string) => {
    showToast('✨ Order confirmed & stock reserved! Final bill locked.');
    setCurrentTab('buyer-orders');
  };

  // Render view router based on current role & tab
  const renderContent = () => {
    // 0. Error state if Firestore profile retrieval failed
    if (authError && authStage !== 'unauthenticated') {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="max-w-md space-y-1">
            <h2 className="text-lg font-bold text-stone-900">Account Setup Notice</h2>
            <p className="text-xs text-stone-600">{authError}</p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => retryProfileLoad()}
              className="px-5 py-2.5 bg-stone-950 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition shadow-xs"
            >
              Retry Setup
            </button>
            <button
              onClick={() => logout()}
              className="px-4 py-2.5 border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-semibold cursor-pointer transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    // 1. Loading state while checking authentication / role from Firestore
    if (authStage === 'loading' || authStage === 'profile-loading') {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 px-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-950 text-white flex items-center justify-center font-bold text-sm shadow-md animate-pulse">
            LC
          </div>
          <div className="flex items-center gap-2.5 text-xs text-stone-500 font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <span>Loading your account...</span>
          </div>
        </div>
      );
    }

    // 2. Unauthenticated visitors: ONLY the public Discover page ('landing') is accessible
    if (authStage === 'unauthenticated') {
      return (
        <>
          <LandingPage
            onStartSelling={() => {
              setIsRegisterOpen(true);
            }}
            onStartShopping={() => {
              setIsLoginOpen(true);
            }}
            onSelectSeller={(_sId) => {
              setIsLoginOpen(true);
            }}
            onCategorySelect={(_catName) => {
              setIsLoginOpen(true);
            }}
            onOpenProductDetail={(p) => setActiveProductDetail(p)}
          />
          <Footer
            onNavigate={handleNavigate}
            onOpenRegister={() => setIsRegisterOpen(true)}
          />
        </>
      );
    }

    // 3. New User / Onboarding: Role Selection Screen is strictly presented
    if (authStage === 'onboarding' || currentTab === 'role-selection') {
      return (
        <RoleSelectionScreen
          onSelectRole={(selectedRole) => {
            if (selectedRole === 'SELLER') {
              setCurrentTab('seller-dashboard');
              showToast('🎉 Seller account activated! Welcome to your dashboard.');
            } else {
              setCurrentTab('buyer-home');
              showToast('🎉 Welcome to LocalCart! Start discovering local neighborhood stores.');
            }
          }}
          onRoleSelected={(selectedRole) => {
            if (selectedRole === 'SELLER') {
              setCurrentTab('seller-dashboard');
            } else {
              setCurrentTab('buyer-home');
            }
          }}
        />
      );
    }

    // 4. Onboarding Detail Routes (optional if entered from dashboard or custom flow)
    if (currentTab === 'seller-onboarding') {
      return (
        <SellerOnboarding
          onComplete={handleOnboardingComplete}
          onCancel={() => setCurrentTab('seller-dashboard')}
        />
      );
    }

    if (currentTab === 'buyer-onboarding') {
      return (
        <BuyerOnboarding
          onComplete={handleOnboardingComplete}
          onCancel={() => setCurrentTab('buyer-home')}
        />
      );
    }

    // 2. Landing Page (Default for guests or when explicitly clicked)
    if (currentTab === 'landing' && currentUser?.role !== 'SELLER') {
      return (
        <>
          <LandingPage
            onStartSelling={() => {
              if (currentUser && currentUser.role === 'SELLER') {
                setCurrentTab('seller-dashboard');
              } else if (currentUser) {
                setCurrentTab('seller-onboarding');
              } else {
                setIsRegisterOpen(true);
              }
            }}
            onStartShopping={() => {
              setCurrentTab('buyer-home');
            }}
            onSelectSeller={(sId) => {
              setActiveSellerIdForView(sId);
              setCurrentTab('business-room-view');
            }}
            onCategorySelect={(catName) => {
              setActiveCategoryFilter(catName);
              setCurrentTab('buyer-search');
            }}
          />
          <Footer
            onNavigate={handleNavigate}
            onOpenRegister={() => setIsRegisterOpen(true)}
          />
        </>
      );
    }

    // 3. Public Digital Business Room Storefront View (Accessible by both buyers and sellers)
    if (currentTab === 'business-room-view') {
      const targetSellerId = activeSellerIdForView || sellerProfiles[0]?.id;
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <BusinessRoomView
            sellerId={targetSellerId}
            onBack={() => setCurrentTab(currentUser?.role === 'SELLER' ? 'seller-dashboard' : 'buyer-home')}
            onOpenProductDetail={(p) => setActiveProductDetail(p)}
            onOpenOrderDrawer={(sId) => setActiveDrawerSellerId(sId)}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
          <Footer
            onNavigate={handleNavigate}
            onOpenRegister={() => setIsRegisterOpen(true)}
          />
        </div>
      );
    }

    // 4. Seller Interface Routes (Guaranteed isolation for Sellers)
    if (currentUser?.role === 'SELLER') {
      const effectiveSellerTab = currentTab.startsWith('seller-') ? currentTab : 'seller-dashboard';
      return (
        <SellerLayout currentTab={effectiveSellerTab} onNavigate={handleNavigate}>
          {effectiveSellerTab === 'seller-dashboard' && (
            <SellerDashboard
              onNavigate={handleNavigate}
              onOpenAddProduct={() => {
                setCurrentTab('seller-products');
                setIsAddProductOpenFromDashboard(true);
              }}
            />
          )}
          {effectiveSellerTab === 'seller-business-room' && (
            <SellerBusinessRoom onNavigate={handleNavigate} />
          )}
          {effectiveSellerTab === 'seller-products' && (
            <SellerProducts
              isAddModalOpenInitially={isAddProductOpenFromDashboard}
              onCloseAddModal={() => setIsAddProductOpenFromDashboard(false)}
            />
          )}
          {effectiveSellerTab === 'seller-orders' && <SellerOrders />}
          {effectiveSellerTab === 'seller-customers' && <SellerCustomers />}
          {effectiveSellerTab === 'seller-analytics' && <SellerAnalytics />}
          {effectiveSellerTab === 'seller-ai' && <SellerAIAssistant />}
          {effectiveSellerTab === 'seller-settings' && <SellerSettings onNavigate={handleNavigate} />}
        </SellerLayout>
      );
    }

    // 5. Buyer Interface Routes
    return (
      <BuyerLayout currentTab={currentTab} onNavigate={handleNavigate}>
        {currentTab === 'buyer-home' && (
          <BuyerHome
            onNavigate={handleNavigate}
            onOpenProductDetail={(p) => setActiveProductDetail(p)}
            onOpenBusinessRoom={(sId) => {
              setActiveSellerIdForView(sId);
              setCurrentTab('business-room-view');
            }}
            onOpenOrderDrawer={(sId) => setActiveDrawerSellerId(sId)}
          />
        )}
        {currentTab === 'buyer-search' && (
          <BuyerSearch
            initialQuery={activeSearchQuery}
            initialCategory={activeCategoryFilter}
            onOpenProductDetail={(p) => setActiveProductDetail(p)}
            onOpenBusinessRoom={(sId) => {
              setActiveSellerIdForView(sId);
              setCurrentTab('business-room-view');
            }}
            onOpenOrderDrawer={(sId) => setActiveDrawerSellerId(sId)}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
        )}
        {currentTab === 'buyer-orders' && (
          <BuyerOrders
            onNavigateToBusinessRoom={(sId) => {
              setActiveSellerIdForView(sId);
              setCurrentTab('business-room-view');
            }}
            onStartShopping={() => setCurrentTab('buyer-search')}
          />
        )}
        {currentTab === 'buyer-ai' && (
          <BuyerAIAssistant
            initialQuery={aiInitialQuery}
            onOpenProductDetail={(p) => setActiveProductDetail(p)}
            onOpenBusinessRoom={(sId) => {
              setActiveSellerIdForView(sId);
              setCurrentTab('business-room-view');
            }}
            onOpenOrderDrawer={(sId) => setActiveDrawerSellerId(sId)}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
        )}
        {currentTab === 'buyer-account' && (
          <BuyerAccount onNavigate={handleNavigate} />
        )}

        <Footer
          onNavigate={handleNavigate}
          onOpenRegister={() => setIsRegisterOpen(true)}
        />
      </BuyerLayout>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-stone-950 text-white px-5 py-3 rounded-full border border-stone-800 shadow-2xl text-xs flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse"></span>
            <span className="font-sans font-medium tracking-wide">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        currentTab={currentTab}
        onNavigate={handleNavigate}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenRegister={() => setIsRegisterOpen(true)}
      />

      {/* Main View Router */}
      <div className="flex-1">
        {renderContent()}
      </div>

      {/* Global Modals & Drawers */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onOpenRegister={() => {
          setIsLoginOpen(false);
          setIsRegisterOpen(true);
        }}
        onSuccessRoleSelect={handleRegisterSuccess}
        onSuccess={(loggedRole) => {
          setIsLoginOpen(false);
          if (loggedRole === 'SELLER') {
            setCurrentTab('seller-dashboard');
          } else if (loggedRole === 'BUYER') {
            setCurrentTab('buyer-home');
          }
        }}
      />

      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onOpenLogin={() => {
          setIsRegisterOpen(false);
          setIsLoginOpen(true);
        }}
        onSuccess={(loggedRole) => {
          setIsRegisterOpen(false);
          if (loggedRole === 'SELLER') {
            setCurrentTab('seller-dashboard');
          } else if (loggedRole === 'BUYER') {
            setCurrentTab('buyer-home');
          } else {
            handleRegisterSuccess();
          }
        }}
        onSuccessRoleSelect={handleRegisterSuccess}
      />

      <ProductDetailModal
        product={activeProductDetail}
        onClose={() => setActiveProductDetail(null)}
        onOpenOrderDrawer={(sellerId) => {
          if (isAuthenticated) {
            setActiveDrawerSellerId(sellerId);
          } else {
            setIsLoginOpen(true);
          }
        }}
        onNavigateToAi={(query) => {
          setActiveProductDetail(null);
          if (isAuthenticated) {
            setAiInitialQuery(query);
            setCurrentTab('buyer-ai');
          } else {
            setIsLoginOpen(true);
          }
        }}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      <OrderBillDrawer
        sellerId={activeDrawerSellerId}
        isOpen={!!activeDrawerSellerId && isAuthenticated}
        onClose={() => setActiveDrawerSellerId(null)}
        onOrderPlaced={handleOrderPlaced}
        onOpenLogin={() => {
          setActiveDrawerSellerId(null);
          setIsLoginOpen(true);
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <AIChatProvider>
          <MainApp />
        </AIChatProvider>
      </StoreProvider>
    </AuthProvider>
  );
}
