import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { generateSellerInsightsFromData } from '../../services/geminiService';
import { OrderStatusBadge } from '../common/Badge';
import {
  Package,
  ShoppingBag,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Plus,
  Store,
  ExternalLink,
  Loader2
} from 'lucide-react';

interface SellerDashboardProps {
  onNavigate: (tab: string, extra?: any) => void;
  onOpenAddProduct: () => void;
}

export const SellerDashboard: React.FC<SellerDashboardProps> = ({
  onNavigate,
  onOpenAddProduct,
}) => {
  const { currentUser } = useAuth();
  const { getSellerByUserId, products, orders, updateOrderStatus } = useStore();
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);

  const handleDashboardPrepare = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, 'PREPARING');
    } catch (e) {
      console.error('Error preparing order:', e);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const seller = currentUser ? getSellerByUserId(currentUser.id) : undefined;
  if (!seller) {
    return (
      <div className="p-12 text-center bg-[#141414] border border-[#FFFFFF18] text-[#F5F5F5]">
        <h2 className="font-serif text-xl text-white">No Store Profile Located</h2>
        <p className="text-xs text-[#888] mt-1 font-light">Please complete seller registration to set up your store profile.</p>
        <button
          onClick={() => onNavigate('seller-onboarding')}
          className="mt-5 px-5 py-2.5 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-[0.2em] font-semibold transition cursor-pointer"
        >
          Set Up Store Profile
        </button>
      </div>
    );
  }

  const sellerProducts = products.filter(p => p.sellerId === seller.id);
  const sellerOrders = orders.filter(o => o.sellerId === seller.id);

  const pendingOrders = sellerOrders.filter(o => o.status === 'CONFIRMED' || o.status === 'PENDING_SELLER_APPROVAL' || o.status === 'ACCEPTED');
  const activeOrders = sellerOrders.filter(o => ['PREPARING', 'READY', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(o.status));
  const deliveredOrders = sellerOrders.filter(o => o.status === 'DELIVERED');

  const totalRevenue = sellerOrders
    .filter(o => o.status !== 'REJECTED' && o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.total, 0);

  const lowStockItems = sellerProducts.filter(p => {
    const threshold = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 5;
    return p.inStock && p.stockQuantity <= threshold;
  });

  // Generate real AI insights from application data
  const aiInsights = generateSellerInsightsFromData(seller, products, orders);

  return (
    <div className="space-y-8 text-[#F5F5F5]">
      {/* Header with quick action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FFFFFF12] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl sm:text-4xl text-white tracking-tight">
              Seller Dashboard
            </h1>
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-mono bg-[#102816] text-[#86EFAC] border border-[#1E4D2B]">
              Active & Receiving Commissions
            </span>
          </div>
          <p className="text-xs text-[#8E8E8E] mt-1 font-light">
            Overview for <strong className="text-white font-normal">{seller.businessName}</strong> · {seller.location.area}, {seller.location.city}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenAddProduct}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-[0.2em] font-semibold transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Item</span>
          </button>
          <button
            onClick={() => onNavigate('business-room-view', { sellerId: seller.id })}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#161616] hover:bg-[#202020] text-[#E5C392] border border-[#FFFFFF18] text-[10px] uppercase tracking-[0.2em] transition"
          >
            <Store className="h-3.5 w-3.5" />
            <span>Public Storefront</span>
          </button>
        </div>
      </div>

      {/* AI Business Insights Banner */}
      <div className="bg-[#121212] border border-[#FFFFFF18] p-5 sm:p-7 space-y-4">
        <div className="flex items-center justify-between border-b border-[#FFFFFF10] pb-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[#1C1C1C] border border-[#E5C392]/40 text-[#E5C392]">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-[9px] uppercase tracking-[0.25em] text-[#E5C392] font-mono">
                Seller Insights
              </h3>
              <p className="text-xs text-white font-serif">{aiInsights.topHeadline}</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('seller-ai')}
            className="text-[10px] uppercase tracking-[0.2em] text-[#E5C392] hover:text-white flex items-center gap-1"
          >
            <span>Seller AI</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {aiInsights.insights.map((item, idx) => (
            <div
              key={idx}
              className="p-4 bg-[#181818] border border-[#FFFFFF12] text-xs flex flex-col justify-between"
            >
              <div>
                <div className="font-serif text-sm text-white mb-1.5 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 ${
                    item.type === 'warning' ? 'bg-[#E5C392]' : item.type === 'positive' ? 'bg-[#86EFAC]' : 'bg-[#93C5FD]'
                  }`} />
                  {item.title}
                </div>
                <p className="text-[11px] text-[#A0A0A0] leading-relaxed font-light">{item.description}</p>
              </div>
              {item.actionableTip && (
                <p className="mt-3 text-[10px] text-[#E5C392] font-mono border-t border-[#FFFFFF0A] pt-2">
                  Strategic Advice: {item.actionableTip}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Metric 1: Pending Orders */}
        <div
          onClick={() => onNavigate('seller-orders')}
          className="cursor-pointer p-4 bg-[#141414] border border-[#FFFFFF15] hover:border-[#E5C392]/60 transition"
        >
          <div className="flex items-center justify-between text-[#808080] mb-2 font-mono text-[9px] uppercase tracking-wider">
            <span>New Orders</span>
            <Clock className="h-3.5 w-3.5 text-[#E5C392]" />
          </div>
          <div className="font-serif text-3xl text-white">{pendingOrders.length}</div>
          <div className="text-[9px] text-[#E5C392] font-mono mt-1">Ready for prep</div>
        </div>

        {/* Metric 2: Active Orders */}
        <div
          onClick={() => onNavigate('seller-orders')}
          className="cursor-pointer p-4 bg-[#141414] border border-[#FFFFFF15] hover:border-[#E5C392]/60 transition"
        >
          <div className="flex items-center justify-between text-[#808080] mb-2 font-mono text-[9px] uppercase tracking-wider">
            <span>In Studio</span>
            <ShoppingBag className="h-3.5 w-3.5 text-[#93C5FD]" />
          </div>
          <div className="font-serif text-3xl text-white">{activeOrders.length}</div>
          <div className="text-[9px] text-[#888] font-mono mt-1">Active transit</div>
        </div>

        {/* Metric 3: Delivered */}
        <div
          onClick={() => onNavigate('seller-orders')}
          className="cursor-pointer p-4 bg-[#141414] border border-[#FFFFFF15] hover:border-[#E5C392]/60 transition"
        >
          <div className="flex items-center justify-between text-[#808080] mb-2 font-mono text-[9px] uppercase tracking-wider">
            <span>Fulfilled</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#86EFAC]" />
          </div>
          <div className="font-serif text-3xl text-white">{deliveredOrders.length}</div>
          <div className="text-[9px] text-[#888] font-mono mt-1">Dispatched</div>
        </div>

        {/* Metric 4: Total Revenue */}
        <div
          onClick={() => onNavigate('seller-analytics')}
          className="cursor-pointer p-4 bg-[#141414] border border-[#FFFFFF15] hover:border-[#E5C392]/60 transition"
        >
          <div className="flex items-center justify-between text-[#808080] mb-2 font-mono text-[9px] uppercase tracking-wider">
            <span>Gross Volume</span>
            <TrendingUp className="h-3.5 w-3.5 text-[#86EFAC]" />
          </div>
          <div className="font-serif text-2xl text-white">₹{totalRevenue.toLocaleString()}</div>
          <div className="text-[9px] text-[#86EFAC] font-mono mt-1">100% Direct</div>
        </div>

        {/* Metric 5: Products */}
        <div
          onClick={() => onNavigate('seller-products')}
          className="cursor-pointer p-4 bg-[#141414] border border-[#FFFFFF15] hover:border-[#E5C392]/60 transition"
        >
          <div className="flex items-center justify-between text-[#808080] mb-2 font-mono text-[9px] uppercase tracking-wider">
            <span>Catalog Items</span>
            <Package className="h-3.5 w-3.5 text-[#C084FC]" />
          </div>
          <div className="font-serif text-3xl text-white">{sellerProducts.length}</div>
          <div className="text-[9px] text-[#888] font-mono mt-1">Published items</div>
        </div>

        {/* Metric 6: Low Stock */}
        <div
          onClick={() => onNavigate('seller-products')}
          className="cursor-pointer p-4 bg-[#141414] border border-[#FFFFFF15] hover:border-[#E5C392]/60 transition"
        >
          <div className="flex items-center justify-between text-[#808080] mb-2 font-mono text-[9px] uppercase tracking-wider">
            <span>Low Stock</span>
            <AlertTriangle className="h-3.5 w-3.5 text-[#F87171]" />
          </div>
          <div className="font-serif text-3xl text-[#F87171]">{lowStockItems.length}</div>
          <div className="text-[9px] text-[#888] font-mono mt-1">
            {lowStockItems.length === 1 ? '1 item at or below alert' : `${lowStockItems.length} items at or below alert`}
          </div>
        </div>
      </div>

      {/* Low Stock Alerts Section */}
      {lowStockItems.length > 0 && (
        <div className="p-6 bg-[#161412] border border-[#F87171]/40 space-y-4">
          <div className="flex items-center justify-between border-b border-[#FFFFFF10] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#F87171] rounded-full animate-pulse" />
              <h3 className="text-xs uppercase tracking-[0.2em] font-mono text-[#F87171]">
                Low Stock ({lowStockItems.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('seller-products')}
              className="text-[10px] uppercase tracking-wider text-[#A0A0A0] hover:text-white cursor-pointer"
            >
              Manage Catalog & Inventory →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {lowStockItems.map(item => {
              const threshold = typeof item.lowStockThreshold === 'number' ? item.lowStockThreshold : 5;
              const isOut = item.stockQuantity === 0;
              return (
                <div
                  key={item.id}
                  onClick={() => onNavigate('seller-products')}
                  className="bg-[#121212] p-4 border border-[#FFFFFF12] hover:border-[#E5C392]/40 transition cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-serif text-white truncate">{item.name}</h4>
                    <p className="text-[10px] text-[#888] font-mono mt-0.5">
                      Alert threshold: ≤ {threshold}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-mono text-xs font-bold ${isOut ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`}>
                      {isOut ? '0 units (Out of Stock)' : `${item.stockQuantity} left`}
                    </div>
                    <span className="text-[9px] text-[#E5C392] font-mono">Restock →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Orders Action Card */}
      {pendingOrders.length > 0 && (
        <div className="p-6 bg-[#161616] border border-[#E5C392]/40 space-y-4">
          <div className="flex items-center justify-between border-b border-[#FFFFFF10] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#E5C392]" />
              <h3 className="text-xs uppercase tracking-[0.2em] font-mono text-[#E5C392]">
                New Confirmed Orders ({pendingOrders.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('seller-orders')}
              className="text-[10px] uppercase tracking-wider text-[#A0A0A0] hover:text-white"
            >
              Inspect all orders →
            </button>
          </div>

          <div className="space-y-3">
            {pendingOrders.slice(0, 2).map(order => (
              <div
                key={order.id}
                className="bg-[#121212] p-4 border border-[#FFFFFF12] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-white">#{order.orderNumber}</span>
                    <span className="text-xs text-[#888]">· {order.buyerName} ({order.buyerLocation.area})</span>
                    <span className="font-serif text-sm text-[#E5C392]">₹{order.total}</span>
                  </div>
                  <div className="text-xs text-[#CCCCCC] mt-1 font-light">
                    {order.items.map(i => `${i.productName} × ${i.quantity}`).join(', ')}
                  </div>
                  {order.customerNotes && (
                    <div className="text-[10px] text-[#8E8E8E] italic mt-0.5 font-mono">
                      Special request: "{order.customerNotes}"
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={updatingOrderId === order.id}
                    onClick={() => handleDashboardPrepare(order.id)}
                    className="px-4 py-1.5 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-[0.2em] font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {updatingOrderId === order.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Package className="h-3 w-3" />
                    )}
                    <span>Begin Preparation</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders Overview */}
      <div className="bg-[#121212] border border-[#FFFFFF18] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#FFFFFF10] pb-3">
          <h3 className="font-serif text-lg text-white">Recent Ledger Transactions</h3>
          <button
            onClick={() => onNavigate('seller-orders')}
            className="text-[10px] uppercase tracking-[0.2em] text-[#A0A0A0] hover:text-white"
          >
            All Entries ({sellerOrders.length})
          </button>
        </div>

        {sellerOrders.length === 0 ? (
          <div className="py-8 text-center text-[#666] text-xs font-light">
            No orders received yet. Share your store link to start receiving customer orders.
          </div>
        ) : (
          <div className="divide-y divide-[#FFFFFF0A]">
            {sellerOrders.slice(0, 5).map(order => (
              <div key={order.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">#{order.orderNumber}</span>
                    <span className="text-[#A0A0A0]">{order.buyerName}</span>
                    <span className="text-[#666] text-[10px] font-mono">· {new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-[#888] text-[11px] truncate max-w-sm mt-0.5 font-light">
                    {order.items.map(i => `${i.productName} (${i.quantity})`).join(', ')}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-serif text-sm text-white">₹{order.total}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
