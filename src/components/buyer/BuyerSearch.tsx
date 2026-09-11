import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { PRODUCT_CATEGORIES, POPULAR_CITIES } from '../../constants/config';
import { Product, SearchFilters } from '../../types';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Plus,
  Store,
  Sparkles,
  X,
  Filter,
  Check,
  Camera,
  AlertCircle,
  ShoppingBag,
  User,
} from 'lucide-react';
import { DEFAULT_PRODUCT_IMAGE } from '../../services/imageStorageService';

interface BuyerSearchProps {
  initialQuery?: string;
  initialCategory?: string;
  onOpenProductDetail: (product: Product) => void;
  onOpenBusinessRoom: (sellerId: string) => void;
  onOpenOrderDrawer: (sellerId: string) => void;
  onOpenLogin?: () => void;
}

export const BuyerSearch: React.FC<BuyerSearchProps> = ({
  initialQuery = '',
  initialCategory = 'all',
  onOpenProductDetail,
  onOpenBusinessRoom,
  onOpenOrderDrawer,
  onOpenLogin,
}) => {
  const { isAuthenticated, currentUser } = useAuth();
  const { products, sellerProfiles, currentCity, currentArea, searchProducts, addToCart } = useStore();

  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SearchFilters['sortBy']>('recommended');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
    if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialQuery, initialCategory]);

  // Validation: minPrice and maxPrice must be >= 0, and minPrice <= maxPrice
  const isPriceRangeInvalid =
    minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;

  // Sanitize numeric inputs so prices can NEVER be negative
  const handleMinPriceChange = (valStr: string) => {
    if (!valStr.trim()) {
      setMinPrice(undefined);
      return;
    }
    const cleanStr = valStr.replace(/[^0-9]/g, '');
    const num = parseInt(cleanStr, 10);
    if (isNaN(num) || num < 0) {
      setMinPrice(undefined);
    } else {
      setMinPrice(Math.max(0, num));
    }
  };

  const handleMaxPriceChange = (valStr: string) => {
    if (!valStr.trim()) {
      setMaxPrice(undefined);
      return;
    }
    const cleanStr = valStr.replace(/[^0-9]/g, '');
    const num = parseInt(cleanStr, 10);
    if (isNaN(num) || num < 0) {
      setMaxPrice(undefined);
    } else {
      setMaxPrice(Math.max(0, num));
    }
  };

  // Prevent minus or plus or exponent keys from being entered
  const blockNegativeKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
      e.preventDefault();
    }
  };

  const searchResults = useMemo(() => {
    // If user provided an invalid inverted range (min > max), do not perform invalid search
    if (isPriceRangeInvalid) {
      return [];
    }

    const safeMin = minPrice !== undefined ? Math.max(0, minPrice) : undefined;
    const safeMax = maxPrice !== undefined ? Math.max(0, maxPrice) : undefined;

    return searchProducts({
      query,
      category: selectedCategory,
      city: currentCity,
      minPrice: safeMin,
      maxPrice: safeMax,
      inStockOnly,
      sortBy,
    });
  }, [searchProducts, query, selectedCategory, currentCity, minPrice, maxPrice, inStockOnly, sortBy, isPriceRangeInvalid]);

  const clearAllFilters = () => {
    setQuery('');
    setSelectedCategory('all');
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setInStockOnly(false);
    setSortBy('recommended');
  };

  const hasActiveFilters =
    query ||
    selectedCategory !== 'all' ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    inStockOnly;

  return (
    <div className="space-y-6 text-stone-900 pb-12">
      {/* Search Header Container */}
      <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search local catalog, bakery, jewelry, fashion, gifts, spices..."
              className="w-full pl-11 pr-10 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition tracking-wide"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-3.5 text-stone-400 hover:text-stone-700 transition"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              className="sm:hidden flex items-center gap-2 px-4 py-3 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-2xl text-xs font-semibold text-stone-800 transition"
            >
              <Filter className="h-3.5 w-3.5 text-stone-600" />
              <span>Filters</span>
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-semibold text-stone-800 focus:outline-none focus:border-amber-500 transition cursor-pointer"
            >
              <option value="recommended">Sort: Recommended</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="discount">Highest Discount</option>
            </select>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide whitespace-nowrap transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-stone-950 text-white font-semibold shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900 border border-stone-200'
            }`}
          >
            All Products ({products.length})
          </button>
          {PRODUCT_CATEGORIES.map((c) => {
            const isSelected = selectedCategory.toLowerCase() === c.name.toLowerCase();
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.name)}
                className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'bg-stone-950 text-white font-semibold shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900 border border-stone-200'
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid with Left Filters and Right Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Filter Sidebar */}
        <div className={`${showFiltersMobile ? 'block' : 'hidden'} lg:block lg:col-span-3 space-y-4`}>
          <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 space-y-6 shadow-xs text-xs">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <span className="text-xs uppercase tracking-wider text-stone-900 font-bold flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />
                Filter Catalog
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-amber-700 hover:text-amber-900 underline cursor-pointer"
                >
                  Reset All
                </button>
              )}
            </div>

            {/* Location relevance */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 font-semibold mb-2">
                Location Area
              </label>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl text-stone-800 text-xs flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="font-medium">
                  {currentArea ? `${currentArea}, ` : ''}{currentCity}
                </span>
              </div>
            </div>

            {/* Price Range with Strict Validation */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 font-semibold mb-2">
                Budget (₹ INR)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    min="0"
                    placeholder="Min ₹"
                    value={minPrice !== undefined ? minPrice : ''}
                    onKeyDown={blockNegativeKey}
                    onChange={(e) => handleMinPriceChange(e.target.value)}
                    className={`w-full p-2.5 bg-stone-50 border rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 transition ${
                      isPriceRangeInvalid
                        ? 'border-amber-500 focus:ring-amber-400/20'
                        : 'border-stone-200 focus:border-amber-500 focus:ring-amber-500/20'
                    }`}
                  />
                  <span className="block text-[10px] text-stone-400 mt-1 pl-1">Min: ≥ ₹0</span>
                </div>
                <div>
                  <input
                    type="number"
                    min="0"
                    placeholder="Max ₹"
                    value={maxPrice !== undefined ? maxPrice : ''}
                    onKeyDown={blockNegativeKey}
                    onChange={(e) => handleMaxPriceChange(e.target.value)}
                    className={`w-full p-2.5 bg-stone-50 border rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 transition ${
                      isPriceRangeInvalid
                        ? 'border-amber-500 focus:ring-amber-400/20'
                        : 'border-stone-200 focus:border-amber-500 focus:ring-amber-500/20'
                    }`}
                  />
                  <span className="block text-[10px] text-stone-400 mt-1 pl-1">Max: ≥ ₹0</span>
                </div>
              </div>

              {/* Clear validation message if min > max */}
              {isPriceRangeInvalid && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-1.5 text-amber-800">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-medium leading-tight">
                    Minimum price cannot be greater than maximum price.
                  </span>
                </div>
              )}
            </div>

            {/* Quick Price Pills */}
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-stone-500 font-semibold mb-2">
                Quick Price Filters
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[300, 500, 1000, 2000, 5000].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setMinPrice(undefined);
                      setMaxPrice(p);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition cursor-pointer ${
                      maxPrice === p && (minPrice === undefined || minPrice === 0)
                        ? 'bg-amber-600 text-white font-semibold shadow-xs'
                        : 'bg-stone-100 border border-stone-200 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    Under ₹{p}
                  </button>
                ))}
              </div>
            </div>

            {/* In-Stock Toggle */}
            <div className="pt-4 border-t border-stone-100">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs text-stone-800 font-medium">In-Stock Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Search Results */}
        <div className="lg:col-span-9 space-y-4">
          <div className="flex items-center justify-between text-xs text-stone-500 font-medium px-1">
            <span>
              Showing <strong className="text-stone-900 font-semibold">{searchResults.length}</strong> products
            </span>
            <span>Edition: {currentCity}</span>
          </div>

          {isPriceRangeInvalid ? (
            <div className="p-12 text-center bg-white border border-stone-200 rounded-3xl shadow-xs">
              <AlertCircle className="h-10 w-10 text-amber-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-stone-900">Invalid Price Range</h3>
              <p className="text-xs text-stone-600 mt-1 max-w-sm mx-auto">
                Minimum price cannot be greater than maximum price. Please adjust your price parameters.
              </p>
              <button
                onClick={() => {
                  setMinPrice(undefined);
                  setMaxPrice(undefined);
                }}
                className="mt-4 px-5 py-2.5 bg-stone-950 text-white text-xs font-semibold rounded-full hover:bg-stone-800 transition cursor-pointer"
              >
                Reset Price Filter
              </button>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-16 text-center bg-white border border-stone-200 rounded-3xl shadow-xs space-y-3">
              <Search className="h-10 w-10 text-stone-300 mx-auto" />
              <h3 className="text-base font-semibold text-stone-900">No Matching Local Products</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto font-normal">
                Try searching for other keywords, expanding your budget, or clearing applied filters.
              </p>
              <button
                onClick={clearAllFilters}
                className="mt-2 px-5 py-2.5 bg-stone-950 hover:bg-stone-800 text-white text-xs font-semibold rounded-full transition cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {searchResults.map((p) => {
                return (
                  <div
                    key={p.id}
                    className="bg-white border border-stone-200 rounded-3xl hover:border-amber-400/80 hover:shadow-md transition duration-200 flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Clickable Product Content */}
                    <div onClick={() => onOpenProductDetail(p)} className="cursor-pointer">
                      <div className="relative h-48 w-full overflow-hidden bg-stone-100">
                        <img
                          src={p.imageUrl || DEFAULT_PRODUCT_IMAGE}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                          }}
                        />
                        {p.images && p.images.length > 1 && (
                          <span className="absolute bottom-2.5 right-2.5 bg-stone-950/75 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Camera className="h-3 w-3" />
                            <span>{p.images.length}</span>
                          </span>
                        )}
                        {p.discountPercent > 0 && (
                          <span className="absolute top-2.5 left-2.5 bg-amber-600 text-white font-mono font-bold text-[10px] px-2.5 py-1 rounded-full shadow-xs">
                            {p.discountPercent}% OFF
                          </span>
                        )}

                        <span className="absolute bottom-2.5 left-2.5 bg-stone-950/80 backdrop-blur-xs text-white text-[10px] font-medium px-2.5 py-0.5 rounded-full">
                          {p.businessName}
                        </span>
                      </div>

                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-500 font-semibold font-mono">
                          <span className="text-amber-800">{p.category}</span>
                          <span>{p.preparationTime || 'Ready in shop'}</span>
                        </div>

                        <h3 className="font-medium text-sm text-stone-900 group-hover:text-amber-800 transition line-clamp-1">
                          {p.name}
                        </h3>
                        <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>

                        <div className="mt-2 flex items-baseline gap-2 pt-1">
                          <span className="text-lg font-bold text-stone-900">
                            ₹{p.finalPrice}
                          </span>
                          {p.discountPercent > 0 && (
                            <span className="text-xs text-stone-400 line-through font-mono">
                              ₹{p.originalPrice}
                            </span>
                          )}
                          <span className="ml-auto text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {p.inStock && p.stockQuantity > 0 ? `${p.stockQuantity} in stock` : 'Out of stock'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Authenticated vs Unauthenticated */}
                    <div className="p-4 pt-0 flex items-center gap-2">
                      {isAuthenticated ? (
                        p.inStock && p.stockQuantity > 0 ? (
                          <button
                            onClick={() => {
                              addToCart(p.sellerId, p, 1);
                              onOpenOrderDrawer(p.sellerId);
                            }}
                            className="flex-1 py-2.5 px-4 bg-stone-950 hover:bg-stone-800 text-white text-xs font-semibold rounded-full transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add to Bill</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="flex-1 py-2.5 px-4 bg-stone-100 border border-stone-200 text-stone-400 text-xs font-medium rounded-full cursor-not-allowed"
                          >
                            Sold Out
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => (onOpenLogin ? onOpenLogin() : onOpenProductDetail(p))}
                          className="flex-1 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-900 text-xs font-semibold rounded-full transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <User className="h-3.5 w-3.5 text-stone-600" />
                          <span>Sign in to Order</span>
                        </button>
                      )}

                      <button
                        onClick={() => onOpenBusinessRoom(p.sellerId)}
                        className="p-2.5 text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 rounded-full text-xs transition cursor-pointer"
                        title="Visit Local Store"
                      >
                        <Store className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
