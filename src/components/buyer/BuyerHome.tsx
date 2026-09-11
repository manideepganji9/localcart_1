import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { Product, SellerProfile } from '../../types';
import {
  Search,
  MapPin,
  Store,
  ShoppingBag,
  ArrowRight,
  Plus,
  ChevronRight,
  Clock,
  Navigation,
  Check,
  Eye,
} from 'lucide-react';
import {
  DEFAULT_PRODUCT_IMAGE,
  DEFAULT_STORE_PHOTO,
  DEFAULT_STORE_BANNER,
} from '../../services/imageStorageService';
import { CinematicProductShowcase } from '../landing/CinematicProductShowcase';
import { CinematicCategorySection } from '../landing/CinematicCategorySection';
import { CinematicLocalDiscovery } from '../landing/CinematicLocalDiscovery';

interface BuyerHomeProps {
  onNavigate: (tab: string, extra?: any) => void;
  onOpenProductDetail: (product: Product) => void;
  onOpenBusinessRoom: (sellerId: string) => void;
  onOpenOrderDrawer: (sellerId: string) => void;
}

export const BuyerHome: React.FC<BuyerHomeProps> = ({
  onNavigate,
  onOpenProductDetail,
  onOpenBusinessRoom,
  onOpenOrderDrawer,
}) => {
  const { sellerProfiles, products, currentCity, currentArea, addToCart } = useStore();
  const { currentUser } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const buyerCoords = currentUser?.location?.coordinates;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onNavigate('buyer-search', { query: searchInput.trim() });
    }
  };

  const handleQuickAdd = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(p.sellerId, p, 1);
    setAddedProductId(p.id);
    setTimeout(() => setAddedProductId(null), 1500);
  };

  const inStockProducts = useMemo(() => products.filter((p) => p.inStock), [products]);

  return (
    <div className="space-y-16 sm:space-y-24 text-stone-900 pb-16">
      
      {/* 1. Cinematic Visual Discovery Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-stone-900 text-white min-h-[460px] sm:min-h-[520px] flex flex-col justify-between p-8 sm:p-14 shadow-2xl border border-stone-800">
        {/* Photographic Background */}
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=2000&q=85"
            alt="Neighborhood local marketplace atmosphere"
            className="w-full h-full object-cover object-center scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-950/75 to-stone-950/40" />
        </div>

        {/* Top Location indicator */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-900/80 backdrop-blur-md border border-white/20 text-xs font-mono text-stone-200">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>Marketplace Active in {currentCity} {currentArea ? `· ${currentArea}` : ''}</span>
          </div>
        </div>

        {/* Center Content & Search */}
        <div className="relative z-10 max-w-3xl space-y-6 my-auto">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Discover what’s around you.
            </h1>
            <p className="text-stone-300 text-base sm:text-lg font-light leading-relaxed max-w-xl">
              Buy directly from independent neighborhood sellers. Zero commission markups, direct peer-to-peer settlement.
            </p>
          </div>

          {/* Minimalist High-End Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative max-w-xl">
            <div className="relative flex items-center">
              <Search className="absolute left-5 h-4 w-4 text-stone-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search cakes, jewellery, gifts, outfits, home decor..."
                className="w-full pl-12 pr-32 py-4 bg-white/95 text-stone-900 rounded-full text-xs sm:text-sm font-medium placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xl"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 bottom-2 px-5 sm:px-6 bg-stone-950 hover:bg-stone-800 text-white text-xs font-semibold rounded-full transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <span>Search</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>

        {/* Bottom Quick Chips */}
        <div className="relative z-10 pt-4 flex flex-wrap items-center gap-2 text-xs text-stone-300">
          <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider mr-1">Popular:</span>
          {['Bakery & Desserts', 'Handmade Jewellery', 'Boutique & Fashion', 'Home Decor & Art'].map((cat) => (
            <button
              key={cat}
              onClick={() => onNavigate('buyer-search', { category: cat })}
              className="px-3 py-1 rounded-full bg-stone-950/60 hover:bg-stone-950/90 border border-white/20 text-[11px] font-medium transition cursor-pointer backdrop-blur-xs"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Large Visual Product Showcase from REAL Firestore Products */}
      <CinematicProductShowcase
        products={inStockProducts}
        onOpenProductDetail={onOpenProductDetail}
        onAddToCart={(sellerId, p) => addToCart(sellerId, p, 1)}
        onExploreAll={() => onNavigate('buyer-search')}
        currentCity={currentCity}
      />

      {/* 3. Visual Category Experience */}
      <CinematicCategorySection
        products={products}
        onSelectCategory={(catName) => onNavigate('buyer-search', { category: catName })}
        onExploreAll={() => onNavigate('buyer-search')}
      />

      {/* 4. Local Discovery: Find sellers near you */}
      <CinematicLocalDiscovery
        sellerProfiles={sellerProfiles}
        products={products}
        currentCity={currentCity}
        currentArea={currentArea}
        buyerCoords={buyerCoords}
        onSelectSeller={onOpenBusinessRoom}
        onExploreAll={() => onNavigate('buyer-search')}
      />

    </div>
  );
};
