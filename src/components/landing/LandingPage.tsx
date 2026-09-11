import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { CinematicHero } from './CinematicHero';
import { CinematicBridgeStory } from './CinematicBridgeStory';
import { CinematicProductShowcase } from './CinematicProductShowcase';
import { CinematicCategorySection } from './CinematicCategorySection';
import { CinematicLocalDiscovery } from './CinematicLocalDiscovery';
import { Store, ArrowRight, ShieldCheck, CheckCircle2, ShoppingBag } from 'lucide-react';
import { Product } from '../../types';

interface LandingPageProps {
  onStartSelling: () => void;
  onStartShopping: () => void;
  onSelectSeller: (sellerId: string) => void;
  onCategorySelect: (category: string) => void;
  onOpenProductDetail?: (product: Product) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartSelling,
  onStartShopping,
  onSelectSeller,
  onCategorySelect,
  onOpenProductDetail,
}) => {
  const { sellerProfiles, products, currentCity, currentArea, addToCart } = useStore();
  const { currentUser, isAuthenticated } = useAuth();

  const buyerCoords = currentUser?.location?.coordinates;

  return (
    <div className="w-full bg-[#FAF9F6] text-stone-900 overflow-x-hidden">
      
      {/* 1. Full-Screen Cinematic Hero Section */}
      <CinematicHero
        onStartShopping={onStartShopping}
        onStartSelling={onStartSelling}
        currentCity={currentCity}
        currentArea={currentArea}
      />

      {/* 2. Signature LocalCart Bridge Story Animation: SELLER → LOCALCART → BUYER */}
      <CinematicBridgeStory
        onStartShopping={onStartShopping}
        onStartSelling={onStartSelling}
        currentCity={currentCity}
      />

      {/* 3. Large Visual Product Showcase from REAL Firestore Products */}
      <CinematicProductShowcase
        products={products}
        onOpenProductDetail={(p) => {
          if (onOpenProductDetail) {
            onOpenProductDetail(p);
          } else {
            onStartShopping();
          }
        }}
        onAddToCart={(sellerId, p) => {
          if (isAuthenticated) {
            addToCart(sellerId, p, 1);
          } else if (onOpenProductDetail) {
            onOpenProductDetail(p);
          } else {
            onStartShopping();
          }
        }}
        onExploreAll={onStartShopping}
        currentCity={currentCity}
      />

      {/* 4. Visually Attractive Category Experience */}
      <CinematicCategorySection
        products={products}
        onSelectCategory={onCategorySelect}
        onExploreAll={onStartShopping}
      />

      {/* 5. Local Discovery ("Find sellers near you") */}
      <CinematicLocalDiscovery
        sellerProfiles={sellerProfiles}
        products={products}
        currentCity={currentCity}
        currentArea={currentArea}
        buyerCoords={buyerCoords}
        onSelectSeller={onSelectSeller}
        onExploreAll={onStartShopping}
      />

      {/* 6. Commercial Callout for Local Sellers */}
      <section className="py-24 sm:py-32 bg-stone-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-mono uppercase tracking-[0.2em] text-amber-300">
            <Store className="w-3.5 h-3.5" />
            <span>For Local Store Owners</span>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
              Turn your neighborhood into your customer base.
            </h2>
            <p className="text-base sm:text-xl text-stone-300 font-light max-w-2xl mx-auto leading-relaxed">
              Create your online store in under 2 minutes. Receive orders directly with instant notifications, direct UPI payments, and zero commission markup.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onStartSelling}
              className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-stone-100 text-stone-950 font-semibold text-sm rounded-full transition shadow-xl flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <Store className="w-4 h-4 text-stone-950" />
              <span>Start Selling Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onStartShopping}
              className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/15 text-white border border-white/20 font-medium text-sm rounded-full transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-amber-300" />
              <span>Browse Local Stores</span>
            </button>
          </div>

          <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto text-left text-xs text-stone-400 font-mono border-t border-white/10">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Direct Customer Line</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero Listing Fees</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Instant UPI Settlements</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
