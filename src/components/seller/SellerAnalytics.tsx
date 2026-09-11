import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import {
  BarChart3,
  TrendingUp,
  Package,
  ShoppingBag,
  DollarSign,
  Users,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export const SellerAnalytics: React.FC = () => {
  const { currentUser } = useAuth();
  const { getSellerByUserId, orders, products } = useStore();

  const seller = currentUser ? getSellerByUserId(currentUser.id) : undefined;
  const sellerOrders = seller ? orders.filter(o => o.sellerId === seller.id) : [];
  const validOrders = sellerOrders.filter(o => o.status !== 'REJECTED' && o.status !== 'CANCELLED');

  const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
  const totalItemsSold = validOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  const avgOrderValue = validOrders.length > 0 ? Math.round(totalRevenue / validOrders.length) : 0;

  // Product sales volume calculation
  const productPerformance: {
    [name: string]: {
      name: string;
      units: number;
      revenue: number;
      category: string;
    };
  } = {};

  validOrders.forEach(o => {
    o.items.forEach(item => {
      if (!productPerformance[item.productName]) {
        productPerformance[item.productName] = {
          name: item.productName,
          units: 0,
          revenue: 0,
          category: item.category
        };
      }
      productPerformance[item.productName].units += item.quantity;
      productPerformance[item.productName].revenue += item.itemTotal;
    });
  });

  const sortedPerformance = Object.values(productPerformance).sort((a, b) => b.revenue - a.revenue);

  // Status distribution
  const statusCounts = {
    pending: sellerOrders.filter(o => o.status === 'PENDING_SELLER_APPROVAL').length,
    preparing: sellerOrders.filter(o => o.status === 'PREPARING' || o.status === 'ACCEPTED').length,
    delivering: sellerOrders.filter(o => o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY').length,
    delivered: sellerOrders.filter(o => o.status === 'DELIVERED').length,
    rejected: sellerOrders.filter(o => o.status === 'REJECTED' || o.status === 'CANCELLED').length,
  };

  return (
    <div className="space-y-8 text-[#F5F5F5]">
      {/* Header */}
      <div>
        <span className="text-[10px] uppercase tracking-[0.3em] text-[#E5C392] font-mono">Financial Intelligence</span>
        <h1 className="font-serif text-3xl sm:text-4xl text-white tracking-tight">
          Sales & Product Yield Analytics
        </h1>
        <p className="text-xs text-[#8E8E8E] mt-1 font-light">
          Real-time metrics computed directly from immutable Business Room ledger logs.
        </p>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-[#141414] border border-[#FFFFFF15]">
          <span className="text-[9px] font-mono uppercase tracking-widest text-[#808080] block mb-1">
            Gross Direct Volume
          </span>
          <div className="font-serif text-3xl text-white">
            ₹{totalRevenue.toLocaleString()}
          </div>
          <span className="text-[9px] font-mono text-[#86EFAC] mt-1 inline-block">
            Across {validOrders.length} fulfilled orders
          </span>
        </div>

        <div className="p-5 bg-[#141414] border border-[#FFFFFF15]">
          <span className="text-[9px] font-mono uppercase tracking-widest text-[#808080] block mb-1">
            Average Ticket Size
          </span>
          <div className="font-serif text-3xl text-white">
            ₹{avgOrderValue}
          </div>
          <span className="text-[9px] font-mono text-[#808080] mt-1 inline-block">
            Per customer order
          </span>
        </div>

        <div className="p-5 bg-[#141414] border border-[#FFFFFF15]">
          <span className="text-[9px] font-mono uppercase tracking-widest text-[#808080] block mb-1">
            Total Units Sold
          </span>
          <div className="font-serif text-3xl text-white">
            {totalItemsSold}
          </div>
          <span className="text-[9px] font-mono text-[#808080] mt-1 inline-block">
            Individual products sold
          </span>
        </div>

        <div className="p-5 bg-[#141414] border border-[#FFFFFF15]">
          <span className="text-[9px] font-mono uppercase tracking-widest text-[#808080] block mb-1">
            Total Ledger Entries
          </span>
          <div className="font-serif text-3xl text-white">
            {sellerOrders.length}
          </div>
          <span className="text-[9px] font-mono text-[#808080] mt-1 inline-block">
            {validOrders.length} confirmed & fulfilled
          </span>
        </div>
      </div>

      {/* Grid: Top Products vs Order Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Selling Products */}
        <div className="lg:col-span-7 bg-[#121212] border border-[#FFFFFF18] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#FFFFFF10] pb-3">
            <h3 className="font-serif text-lg text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#E5C392]" />
              <span>Highest Yield Catalog Pieces</span>
            </h3>
            <span className="text-[10px] font-mono text-[#808080]">{sortedPerformance.length} items</span>
          </div>

          {sortedPerformance.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#666] font-light">
              No sales yield logged yet.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPerformance.map((prod, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-serif text-sm text-[#F5F5F5] flex items-center gap-2">
                      <span className="text-[#888] font-mono text-[10px]">0{idx + 1}.</span>
                      <span>{prod.name}</span>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <span className="font-serif text-sm text-white">₹{prod.revenue}</span>
                      <span className="text-[#888] text-[10px] ml-2 font-mono">({prod.units} units)</span>
                    </div>
                  </div>
                  {/* Visual Bar */}
                  <div className="w-full bg-[#1C1C1C] h-1.5">
                    <div
                      className="bg-[#E5C392] h-full"
                      style={{
                        width: `${Math.min(100, (prod.revenue / (sortedPerformance[0].revenue || 1)) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order Status Distribution */}
        <div className="lg:col-span-5 bg-[#121212] border border-[#FFFFFF18] p-6 space-y-4">
          <h3 className="font-serif text-lg text-white border-b border-[#FFFFFF10] pb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#E5C392]" />
            <span>Fulfillment Pipeline Status</span>
          </h3>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between p-3 bg-[#181818] border border-[#FFFFFF12]">
              <span className="text-[#E5C392]">Pending Authorization</span>
              <span className="text-white font-bold">{statusCounts.pending}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#181818] border border-[#FFFFFF12]">
              <span className="text-[#C084FC]">In Production / Preparing</span>
              <span className="text-white font-bold">{statusCounts.preparing}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#181818] border border-[#FFFFFF12]">
              <span className="text-[#93C5FD]">Dispatched / Out for Transit</span>
              <span className="text-white font-bold">{statusCounts.delivering}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#181818] border border-[#FFFFFF12]">
              <span className="text-[#86EFAC]">Delivered & Fulfilled</span>
              <span className="text-white font-bold">{statusCounts.delivered}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#181818] border border-[#FFFFFF12]">
              <span className="text-[#777]">Declined / Voided</span>
              <span className="text-[#777] font-bold">{statusCounts.rejected}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
