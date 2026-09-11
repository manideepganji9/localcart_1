import React from 'react';
import { SellerProfile, Product } from '../../types';
import { MapPin, Navigation, Store, ArrowRight, Clock, ShieldCheck, ChevronRight } from 'lucide-react';
import { DEFAULT_STORE_PHOTO, DEFAULT_STORE_BANNER } from '../../services/imageStorageService';

interface CinematicLocalDiscoveryProps {
  sellerProfiles: SellerProfile[];
  products: Product[];
  currentCity: string;
  currentArea?: string;
  buyerCoords?: { lat?: number; lng?: number };
  onSelectSeller: (sellerId: string) => void;
  onExploreAll?: () => void;
}

// Distance calculation in km using real coordinates
function calculateDistanceKm(lat1?: number, lon1?: number, lat2?: number, lon2?: number): number | null {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export const CinematicLocalDiscovery: React.FC<CinematicLocalDiscoveryProps> = ({
  sellerProfiles,
  products,
  currentCity,
  currentArea,
  buyerCoords,
  onSelectSeller,
  onExploreAll,
}) => {
  const sellersToShow = sellerProfiles.slice(0, 6);

  return (
    <section className="py-24 sm:py-32 bg-white text-stone-900 border-b border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-200/90 pb-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.25em] text-amber-700 font-semibold">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              <span>Real-Time Neighborhood Proximity</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900">
              Find sellers near you.
            </h2>
            <p className="text-stone-600 text-sm sm:text-base font-light">
              Connecting you directly with independent storefronts and home-based makers in {currentCity} {currentArea ? `· ${currentArea}` : ''}.
            </p>
          </div>

          {onExploreAll && (
            <button
              onClick={onExploreAll}
              className="inline-flex items-center gap-2 text-xs font-semibold text-stone-900 hover:text-amber-700 transition cursor-pointer group"
            >
              <span>Explore All Stores</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>

        {/* Sellers Roster (Clean, High-End Card Presentation) */}
        {sellersToShow.length === 0 ? (
          <div className="p-16 text-center bg-stone-50 rounded-3xl border border-stone-200 space-y-4">
            <Store className="w-10 h-10 text-stone-400 mx-auto" />
            <h3 className="text-lg font-bold text-stone-800">No stores listed yet in this zone</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Be the first local creator to register your business in {currentCity}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {sellersToShow.map((seller) => {
              const sellerProducts = products.filter((p) => p.sellerId === seller.id);
              const distKm = calculateDistanceKm(
                buyerCoords?.lat,
                buyerCoords?.lng,
                seller.location?.coordinates?.lat,
                seller.location?.coordinates?.lng
              );
              const distanceDisplay = distKm !== null ? `${distKm} km away` : `Nearby in ${seller.location.area || currentArea || currentCity}`;
              const deliveryEstimate = distKm !== null ? `~${Math.max(15, Math.round(distKm * 8))} min delivery` : '~25 min delivery';

              return (
                <div
                  key={seller.id}
                  onClick={() => onSelectSeller(seller.id)}
                  className="group relative rounded-2xl overflow-hidden bg-white border border-stone-200/90 shadow-sm hover:shadow-xl hover:border-stone-300 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                >
                  {/* Top Cover Banner */}
                  <div>
                    <div className="relative h-48 w-full overflow-hidden bg-stone-100">
                      <img
                        src={seller.bannerUrl || DEFAULT_STORE_BANNER}
                        alt={seller.businessName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_STORE_BANNER;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/20 to-transparent" />

                      {/* Store Avatar Thumbnail */}
                      <div className="absolute top-4 left-4 w-12 h-12 rounded-xl overflow-hidden border-2 border-white bg-white shadow-md">
                        <img
                          src={seller.storePhotoUrl || seller.logoUrl || DEFAULT_STORE_PHOTO}
                          alt={seller.businessName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_STORE_PHOTO;
                          }}
                        />
                      </div>

                      {/* Distance Pill */}
                      <div className="absolute bottom-3 left-4 flex items-center gap-1.5 px-3 py-1 bg-stone-950/80 backdrop-blur-md rounded-full text-white text-[11px] font-medium font-mono">
                        <Navigation className="w-3 h-3 text-amber-400" />
                        <span>{distanceDisplay}</span>
                      </div>
                    </div>

                    {/* Store Information */}
                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-semibold">
                          {seller.businessCategory}
                        </span>
                        <span className="text-xs text-stone-500 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          {deliveryEstimate}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-stone-900 group-hover:text-amber-800 transition-colors tracking-tight">
                        {seller.businessName}
                      </h3>

                      <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed font-light">
                        {seller.tagline || 'Local independent store crafting quality products.'}
                      </p>

                      <div className="pt-2 flex items-center gap-1.5 text-xs text-stone-500">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">{seller.location.area}, {seller.location.city}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Footer Action */}
                  <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs font-semibold">
                    <span className="text-stone-500 font-normal">
                      {sellerProducts.length} {sellerProducts.length === 1 ? 'product' : 'products'} available
                    </span>
                    <span className="text-amber-800 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                      <span>Visit Store</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};
