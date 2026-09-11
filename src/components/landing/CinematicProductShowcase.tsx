import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import { ArrowRight, ChevronLeft, ChevronRight, ShoppingBag, Eye, Check, Clock, Store, MapPin } from 'lucide-react';
import { DEFAULT_PRODUCT_IMAGE } from '../../services/imageStorageService';

interface CinematicProductShowcaseProps {
  products: Product[];
  onOpenProductDetail: (product: Product) => void;
  onAddToCart?: (sellerId: string, product: Product) => void;
  onExploreAll?: () => void;
  currentCity?: string;
}

export const CinematicProductShowcase: React.FC<CinematicProductShowcaseProps> = ({
  products,
  onOpenProductDetail,
  onAddToCart,
  onExploreAll,
  currentCity = 'Your Neighborhood',
}) => {
  // Only display in-stock items from real Firestore products
  const displayProducts = useMemo(() => {
    return products.filter((p) => p.inStock);
  }, [products]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [addedId, setAddedId] = useState<string | null>(null);

  if (displayProducts.length === 0) {
    return (
      <section className="py-20 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] font-mono text-stone-400">Neighborhood Catalog</p>
          <h2 className="text-3xl font-extrabold text-stone-900 tracking-tight">Products in {currentCity}</h2>
          <p className="text-stone-500 text-sm max-w-md mx-auto">
            Local sellers are currently preparing fresh items. Check back soon or register your own store.
          </p>
        </div>
      </section>
    );
  }

  const activeProduct = displayProducts[activeIndex] || displayProducts[0];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % displayProducts.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + displayProducts.length) % displayProducts.length);
  };

  const handleQuickAdd = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(p.sellerId, p);
      setAddedId(p.id);
      setTimeout(() => setAddedId(null), 1600);
    }
  };

  return (
    <section className="py-24 sm:py-32 bg-white text-stone-900 border-b border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-200 pb-8">
          <div className="space-y-3 max-w-2xl">
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-amber-700 font-semibold block">
              Curated Direct Collection
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900">
              Handmade & Crafted Nearby
            </h2>
            <p className="text-stone-600 text-sm sm:text-base font-light">
              Explore authentic creations from local bakers, jewelers, and makers in your neighborhood.
            </p>
          </div>

          {onExploreAll && (
            <button
              onClick={onExploreAll}
              className="inline-flex items-center gap-2 text-xs font-semibold text-stone-900 hover:text-amber-700 transition cursor-pointer group"
            >
              <span>Explore Entire Catalog</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>

        {/* 1. Large Spotlight Product Section (Full-Width Editorial Presentation) */}
        <div className="relative rounded-3xl bg-[#FAF9F6] border border-stone-200/90 overflow-hidden shadow-lg p-6 sm:p-10 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
            
            {/* Left: Huge High-Resolution Product Photography */}
            <div
              onClick={() => onOpenProductDetail(activeProduct)}
              className="lg:col-span-7 relative h-72 sm:h-96 lg:h-[480px] rounded-2xl overflow-hidden bg-stone-100 group cursor-pointer shadow-md"
            >
              <img
                key={activeProduct.id}
                src={activeProduct.imageUrl || DEFAULT_PRODUCT_IMAGE}
                alt={activeProduct.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent to-transparent" />

              {/* Status & Store Tag */}
              <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/95 backdrop-blur-xs text-stone-900 text-xs font-semibold rounded-full shadow-sm">
                  {activeProduct.category}
                </span>
                <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-sm">
                  Available nearby
                </span>
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs">
                <span className="flex items-center gap-1.5 font-medium bg-stone-950/70 px-3 py-1.5 rounded-full backdrop-blur-xs">
                  <Store className="w-3.5 h-3.5 text-amber-400" />
                  {activeProduct.businessName}
                </span>

                {activeProduct.preparationTime && (
                  <span className="flex items-center gap-1 font-medium bg-stone-950/70 px-3 py-1.5 rounded-full backdrop-blur-xs">
                    <Clock className="w-3.5 h-3.5 text-stone-300" />
                    {activeProduct.preparationTime}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Product Narrative & Actions */}
            <div className="lg:col-span-5 space-y-6 flex flex-col justify-center">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono text-stone-500">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  <span>Verified Local Seller in {currentCity}</span>
                </div>

                <h3
                  onClick={() => onOpenProductDetail(activeProduct)}
                  className="text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight cursor-pointer hover:text-amber-800 transition-colors"
                >
                  {activeProduct.name}
                </h3>
              </div>

              <p className="text-stone-600 text-sm sm:text-base leading-relaxed line-clamp-3 font-light">
                {activeProduct.description}
              </p>

              {/* Pricing & Direct Guarantee */}
              <div className="pt-2 border-t border-stone-200">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-bold text-stone-900">
                    ₹{activeProduct.finalPrice}
                  </span>
                  {activeProduct.discountPercent > 0 && (
                    <span className="text-base text-stone-400 line-through">
                      ₹{activeProduct.originalPrice}
                    </span>
                  )}
                  <span className="text-xs text-amber-800 font-semibold bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                    Direct local rate
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={() => onOpenProductDetail(activeProduct)}
                  className="w-full sm:w-auto px-7 py-3.5 bg-stone-950 hover:bg-stone-800 text-white font-semibold text-xs rounded-full transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Product</span>
                </button>

                {onAddToCart && (
                  <button
                    onClick={(e) => handleQuickAdd(activeProduct, e)}
                    className={`w-full sm:w-auto px-6 py-3.5 border rounded-full font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] ${
                      addedId === activeProduct.id
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white hover:bg-stone-50 border-stone-300 text-stone-900'
                    }`}
                  >
                    {addedId === activeProduct.id ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Added to Cart</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4 text-stone-700" />
                        <span>Add to Cart</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Carousel Controls */}
              <div className="pt-4 flex items-center justify-between border-t border-stone-200/80 text-xs text-stone-500 font-mono">
                <span>
                  {activeIndex + 1} of {displayProducts.length} featured products
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrev}
                    aria-label="Previous product"
                    className="w-9 h-9 rounded-full border border-stone-300 hover:border-stone-500 bg-white flex items-center justify-center transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNext}
                    aria-label="Next product"
                    className="w-9 h-9 rounded-full border border-stone-300 hover:border-stone-500 bg-white flex items-center justify-center transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* 2. Visual Product Catalog Strip (Up to 4 more real products) */}
        {displayProducts.length > 1 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold tracking-tight text-stone-900">
              More from Neighborhood Sellers
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {displayProducts.slice(0, 4).map((p) => {
                const isCurrent = p.id === activeProduct.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => onOpenProductDetail(p)}
                    className={`group rounded-2xl overflow-hidden bg-white border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                      isCurrent
                        ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                        : 'border-stone-200 hover:border-stone-400 hover:shadow-lg'
                    }`}
                  >
                    <div>
                      <div className="relative h-48 w-full overflow-hidden bg-stone-100">
                        <img
                          src={p.imageUrl || DEFAULT_PRODUCT_IMAGE}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                          }}
                        />
                        <span className="absolute bottom-2.5 left-2.5 bg-stone-950/80 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-full">
                          {p.businessName}
                        </span>
                      </div>

                      <div className="p-4 space-y-1.5">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-amber-700 font-semibold block">
                          {p.category}
                        </span>
                        <h4 className="text-sm font-bold text-stone-900 group-hover:text-amber-800 transition-colors line-clamp-1">
                          {p.name}
                        </h4>
                        <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 pt-0 flex items-center justify-between border-t border-stone-100 mt-2">
                      <span className="text-base font-bold text-stone-900">₹{p.finalPrice}</span>
                      <span className="text-xs font-semibold text-amber-700 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        View →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
