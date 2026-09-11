import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { Product } from '../../types';
import {
  Store,
  MapPin,
  Clock,
  Truck,
  Plus,
  Minus,
  Phone,
  ShieldCheck,
  ChevronLeft,
  Camera,
  FileText,
  Receipt,
} from 'lucide-react';
import {
  DEFAULT_STORE_PHOTO,
  DEFAULT_STORE_BANNER,
  DEFAULT_PRODUCT_IMAGE,
} from '../../services/imageStorageService';

interface BusinessRoomViewProps {
  sellerId: string;
  onBack: () => void;
  onOpenProductDetail: (product: Product) => void;
  onOpenOrderDrawer: (sellerId: string) => void;
  onOpenLogin?: () => void;
}

export const BusinessRoomView: React.FC<BusinessRoomViewProps> = ({
  sellerId,
  onBack,
  onOpenProductDetail,
  onOpenOrderDrawer,
  onOpenLogin,
}) => {
  const { currentUser } = useAuth();
  const { getSellerById, products, activeCart, addToCart, updateCartQuantity } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const seller = getSellerById(sellerId);
  if (!seller) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 sm:p-10 text-center bg-white border border-stone-200 rounded-3xl shadow-xl space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
          <Store className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 tracking-tight">Store No Longer Available</h2>
        <p className="text-xs sm:text-sm text-stone-500 font-light max-w-sm mx-auto leading-relaxed">
          This store has been closed or removed by the seller.
        </p>
        <div className="pt-3">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-stone-950 hover:bg-stone-800 text-white text-xs font-semibold transition rounded-full cursor-pointer"
          >
            Return to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const isSellerViewer = currentUser?.role === 'SELLER';
  const isOwnStore = isSellerViewer && (seller.userId === currentUser?.id || seller.id === currentUser?.id);

  const sellerProducts = products.filter((p) => p.sellerId === seller.id);
  const categories = Array.from(new Set(sellerProducts.map((p) => p.category)));

  const filteredProducts =
    selectedCategory === 'all'
      ? sellerProducts
      : sellerProducts.filter((p) => p.category === selectedCategory);

  const currentCartItems: Record<string, number> = activeCart[seller.id] || {};

  return (
    <div className="space-y-10 pb-24 text-stone-900">
      {/* Back Button and Store Owner Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-stone-50 border border-stone-200 rounded-full text-stone-700 text-xs font-semibold transition cursor-pointer shadow-xs"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Marketplace</span>
        </button>

        {isOwnStore && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono rounded-full">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            <span>Store Owner Preview Mode (Your Store)</span>
          </div>
        )}
      </div>

      {/* Storefront Hero Header */}
      <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-md">
        {/* Store Banner */}
        <div className="relative h-64 sm:h-80 w-full bg-stone-100">
          <img
            src={seller.bannerUrl || DEFAULT_STORE_BANNER}
            alt={seller.businessName}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_STORE_BANNER;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/30 to-transparent" />

          <div className="absolute bottom-6 left-6 right-6 sm:left-10 sm:right-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
            <div className="flex items-center gap-4 sm:gap-6">
              <img
                src={seller.storePhotoUrl || seller.logoUrl || DEFAULT_STORE_PHOTO}
                alt={seller.businessName}
                className="w-18 h-18 sm:w-24 sm:h-24 object-cover rounded-2xl border-2 border-white bg-white shadow-xl"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_STORE_PHOTO;
                }}
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider bg-white/95 text-stone-900 px-2.5 py-0.5 font-mono font-bold rounded-md">
                    {seller.businessCategory}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-amber-300 bg-stone-950/60 border border-white/20 px-2.5 py-0.5 font-mono rounded-md flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-amber-400" />
                    Verified Store
                  </span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {seller.businessName}
                </h1>
                <p className="text-xs sm:text-sm text-stone-200 font-light max-w-xl line-clamp-1">
                  {seller.tagline}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-white text-xs font-mono bg-stone-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{seller.location.area}, {seller.location.city}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Store Quick Specs Bar */}
        <div className="p-4 sm:p-6 bg-stone-50/80 border-t border-stone-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-stone-600">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-stone-400 font-mono">Store Hours</span>
              <span className="text-stone-900 text-xs font-medium">{seller.openingHours}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Truck className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-stone-400 font-mono">Delivery Radius</span>
              <span className="text-stone-900 text-xs font-medium">{seller.serviceRadiusKm} km around {seller.location.area}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Receipt className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-stone-400 font-mono">Delivery Fee</span>
              <span className="text-stone-900 text-xs font-medium">₹{seller.deliveryOptions.baseDeliveryFee} (Free &gt; ₹{seller.deliveryOptions.freeDeliveryAbove})</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-stone-400 font-mono">Contact Phone</span>
              <span className="text-stone-900 text-xs font-mono font-medium">{seller.contactPhone}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Categories & Product Catalog */}
      <div className="space-y-6">
        {/* Category Filters */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-stone-950 text-white shadow-sm'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
              }`}
            >
              All Items ({sellerProducts.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-stone-950 text-white shadow-sm'
                    : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards List */}
        {filteredProducts.length === 0 ? (
          <div className="p-16 text-center bg-white border border-stone-200 rounded-2xl">
            <p className="text-xs text-stone-500 font-light">No items currently catalogued in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((p) => {
              const currentQty = currentCartItems[p.id] || 0;
              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                    currentQty > 0 ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-stone-200'
                  }`}
                >
                  <div onClick={() => onOpenProductDetail(p)} className="cursor-pointer">
                    <div className="relative h-52 w-full overflow-hidden bg-stone-100">
                      <img
                        src={p.imageUrl || DEFAULT_PRODUCT_IMAGE}
                        alt={p.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                        }}
                      />

                      {p.images && p.images.length > 1 && (
                        <span className="absolute bottom-2.5 right-2.5 bg-stone-950/75 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          <span>{p.images.length}</span>
                        </span>
                      )}
                      {p.discountPercent > 0 && (
                        <span className="absolute top-2.5 left-2.5 bg-amber-600 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded-md">
                          {p.discountPercent}% OFF
                        </span>
                      )}

                      <span
                        className={`absolute top-2.5 right-2.5 text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider rounded-md font-semibold ${
                          p.inStock
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {p.inStock ? 'In Stock' : 'Sold Out'}
                      </span>
                    </div>

                    <div className="p-5 space-y-2">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-amber-700 font-mono font-semibold">
                        <span>{p.category}</span>
                        <span className="text-stone-400 font-normal">⏱ {p.preparationTime || 'Ready'}</span>
                      </div>

                      <h3 className="text-base font-bold text-stone-900 line-clamp-1 hover:text-amber-800 transition-colors">
                        {p.name}
                      </h3>
                      <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed font-light">
                        {p.description}
                      </p>

                      <div className="mt-2 flex items-baseline gap-2 pt-1">
                        <span className="text-2xl font-bold text-stone-900">
                          ₹{p.finalPrice}
                        </span>
                        {p.discountPercent > 0 && (
                          <span className="text-xs text-stone-400 line-through font-mono">
                            ₹{p.originalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Add to Cart Bar */}
                  <div className="p-5 pt-0 border-t border-stone-100 mt-2">
                    {p.inStock ? (
                      currentQty > 0 ? (
                        <div className="space-y-2 mt-2">
                          <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-full p-1.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateCartQuantity(seller.id, p.id, -1)}
                                className="w-8 h-8 rounded-full bg-white border border-stone-200 text-stone-800 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="text-xs font-mono font-bold text-stone-900 px-2">
                                {currentQty} in bill
                              </span>
                              <button
                                onClick={() => updateCartQuantity(seller.id, p.id, 1)}
                                className="w-8 h-8 rounded-full bg-stone-950 text-white flex items-center justify-center font-bold hover:bg-stone-800 cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="text-right pr-2">
                              <span className="text-xs font-bold text-stone-900">
                                ₹{p.finalPrice * currentQty}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => onOpenOrderDrawer(seller.id)}
                            className="w-full py-2 px-3 bg-stone-900 hover:bg-stone-800 text-white text-[11px] font-semibold rounded-full transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                          >
                            <FileText className="h-3.5 w-3.5 text-amber-400" />
                            <span>View Bill · ₹{p.finalPrice * currentQty}</span>
                          </button>
                        </div>
                      ) : currentUser ? (
                        <button
                          onClick={() => {
                            addToCart(seller.id, p, 1);
                            onOpenOrderDrawer(seller.id);
                          }}
                          className="w-full py-2.5 px-4 bg-stone-950 hover:bg-stone-800 text-white text-xs font-semibold rounded-full transition flex items-center justify-center gap-1.5 mt-2 shadow-xs cursor-pointer active:scale-[0.98]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add to Bill</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => (onOpenLogin ? onOpenLogin() : onOpenProductDetail(p))}
                          className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-900 text-xs font-semibold rounded-full transition flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
                        >
                          <span>Sign in to Order</span>
                        </button>
                      )
                    ) : (
                      <button
                        disabled
                        className="w-full py-2.5 px-4 bg-stone-100 border border-stone-200 text-stone-400 text-xs font-medium rounded-full cursor-not-allowed mt-2"
                      >
                        Item Sold Out
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
