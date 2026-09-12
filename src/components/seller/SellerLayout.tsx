import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import {
  LayoutDashboard,
  Store,
  Package,
  ShoppingBag,
  Users,
  BarChart3,
  Sparkles,
  Settings,
  ExternalLink,
  ChevronRight,
  Menu,
  X,
  MapPin,
} from 'lucide-react';
import { DEFAULT_STORE_PHOTO } from '../../services/imageStorageService';

interface SellerLayoutProps {
  currentTab: string;
  onNavigate: (tab: string, extra?: any) => void;
  children: React.ReactNode;
}

export const SellerLayout: React.FC<SellerLayoutProps> = ({
  currentTab,
  onNavigate,
  children,
}) => {
  const { currentUser } = useAuth();
  const { getSellerByUserId, orders } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const sellerProfile = currentUser ? getSellerByUserId(currentUser.id) : undefined;

  const pendingCount = sellerProfile
    ? orders.filter(o => o.sellerId === sellerProfile.id && o.status === 'PENDING_SELLER_APPROVAL').length
    : 0;

  const navItems = [
    { id: 'seller-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'seller-business-room', label: 'Store Profile', icon: Store },
    { id: 'seller-products', label: 'Inventory & Catalog', icon: Package },
    { id: 'seller-orders', label: 'Orders', icon: ShoppingBag, badge: pendingCount > 0 ? pendingCount : null },
    { id: 'seller-customers', label: 'Customers', icon: Users },
    { id: 'seller-analytics', label: 'Sales & Analytics', icon: BarChart3 },
    { id: 'seller-ai', label: 'Seller AI Assistant', icon: Sparkles, highlight: true },
    { id: 'seller-settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-[#F5F5F5] flex flex-col md:flex-row">
      {/* Mobile Top Header for Seller */}
      <div className="md:hidden bg-[#121212] px-4 py-3 flex items-center justify-between border-b border-[#FFFFFF15]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1E1E1E] border border-[#E5C392]/40 flex items-center justify-center font-bold text-xs text-[#E5C392]">
            🏪
          </div>
          <div>
            <div className="text-xs font-serif truncate max-w-[180px]">
              {sellerProfile?.businessName || 'Seller Console'}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-[#808080] font-mono">Seller Dashboard</div>
          </div>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-[#181818] border border-[#FFFFFF15] text-[#CCCCCC]"
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          isMobileMenuOpen ? 'block' : 'hidden'
        } md:block w-full md:w-64 bg-[#101010] text-[#D0D0D0] flex-shrink-0 border-r border-[#FFFFFF12] flex flex-col justify-between`}
      >
        <div>
          {/* Business Info Tile in Sidebar */}
          <div className="p-5 border-b border-[#FFFFFF12]">
            <div className="flex items-center gap-3">
              <img
                src={sellerProfile?.storePhotoUrl || sellerProfile?.logoUrl || DEFAULT_STORE_PHOTO}
                alt={sellerProfile?.businessName}
                className="w-11 h-11 object-cover border border-[#FFFFFF20] bg-[#161616]"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-sm text-white truncate">
                  {sellerProfile?.businessName || 'My Store'}
                </h3>
                <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[#808080] font-mono mt-1">
                  <MapPin className="h-2.5 w-2.5 text-[#E5C392]" />
                  <span className="truncate">{sellerProfile?.location?.area || 'Hyderabad'}</span>
                </div>
              </div>
            </div>

            {sellerProfile && (
              <button
                onClick={() => onNavigate('business-room-view', { sellerId: sellerProfile.id })}
                className="mt-3.5 w-full py-1.5 px-2.5 bg-[#181818] hover:bg-[#202020] text-[9px] uppercase tracking-[0.2em] text-[#E5C392] flex items-center justify-center gap-1.5 transition border border-[#FFFFFF15] cursor-pointer"
              >
                <span>View Public Store</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="text-[9px] uppercase tracking-[0.25em] text-[#707070] font-mono px-3 py-2">
              Store Management
            </div>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-[11px] uppercase tracking-[0.15em] transition ${
                    isActive
                      ? 'bg-[#1C1C1C] text-[#E5C392] border-l-2 border-[#E5C392] font-semibold'
                      : item.highlight
                      ? 'text-[#E5C392] hover:bg-[#181818]'
                      : 'text-[#A0A0A0] hover:bg-[#161616] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#E5C392]' : item.highlight ? 'text-[#E5C392]' : 'text-[#777]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-[#E5C392] text-black">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#FFFFFF10] text-[9px] uppercase tracking-wider text-[#666] font-mono flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#86EFAC]"></span>
            <span>Room Published</span>
          </span>
          <span>Commercial v1.0</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-5 sm:p-8 lg:p-10 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};
