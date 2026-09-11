import React from 'react';
import { APP_CONFIG, PRODUCT_CATEGORIES } from '../../constants/config';
import { ShieldCheck, Heart, Sparkles, MapPin, Store, ShoppingBag, ArrowUpRight } from 'lucide-react';

interface FooterProps {
  onNavigate?: (tab: string, extra?: any) => void;
  onOpenRegister?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenRegister }) => {
  return (
    <footer className="bg-white text-stone-700 border-t border-stone-200 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-sm">
                LC
              </div>
              <span className="text-xl font-bold tracking-tight text-stone-900">
                {APP_CONFIG.shortName}
              </span>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Discover unique homemade bakes, handcrafted gifts, and products from verified local sellers in your neighborhood.
            </p>
            <div className="flex items-center gap-2 text-xs text-stone-600 pt-1">
              <MapPin className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              <span>Available in Hyderabad, Bengaluru, Mumbai & Delhi NCR</span>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-xs font-semibold text-stone-900 mb-3 uppercase tracking-wider">
              Popular Categories
            </h4>
            <ul className="space-y-2 text-xs text-stone-600">
              {PRODUCT_CATEGORIES.slice(0, 5).map(cat => (
                <li key={cat.id}>
                  <button
                    onClick={() => onNavigate?.('buyer-search', { category: cat.name })}
                    className="hover:text-amber-700 transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>{cat.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* For Sellers */}
          <div>
            <h4 className="text-xs font-semibold text-stone-900 mb-3 uppercase tracking-wider">
              For Store Owners
            </h4>
            <ul className="space-y-2 text-xs text-stone-600">
              <li>
                <button
                  onClick={() => onOpenRegister?.()}
                  className="text-amber-700 hover:text-amber-800 font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Store className="h-3.5 w-3.5" />
                  <span>Open Your Online Store</span>
                </button>
              </li>
              <li><span>Direct payments via UPI or Cash</span></li>
              <li><span>Zero platform listing commission</span></li>
              <li><span>AI commerce assistant for local orders</span></li>
              <li><span>Real-time stock reservation</span></li>
            </ul>
          </div>

          {/* Trust & Guarantee */}
          <div>
            <h4 className="text-xs font-semibold text-stone-900 mb-3 uppercase tracking-wider">
              LocalCart Guarantee
            </h4>
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Verified Local Sellers</span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                Connect directly with sellers. Your final bill is locked upon confirmation with direct peer-to-peer settlement.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div>
            © {new Date().getFullYear()} {APP_CONFIG.name}. Connecting communities with local creators.
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span>Direct Commerce</span>
            <span>•</span>
            <span>Privacy & Terms</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
