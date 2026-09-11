import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Order } from '../../types';
import { OrderStatusBadge } from '../common/Badge';
import { BuyerOrderDetailModal } from './BuyerOrderDetailModal';
import {
  Package,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Lock,
  ChevronRight,
  Store,
  MapPin,
  XCircle,
  Truck,
  Receipt,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';

interface BuyerOrdersProps {
  onNavigateToBusinessRoom: (sellerId: string) => void;
  onStartShopping: () => void;
}

export const BuyerOrders: React.FC<BuyerOrdersProps> = ({
  onNavigateToBusinessRoom,
  onStartShopping,
}) => {
  const { currentUser } = useAuth();
  const { orders, cancelOrder } = useStore();

  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Orders are automatically synced in real-time from Firestore via StoreContext onSnapshot
  const buyerOrders = currentUser
    ? orders
        .filter((o) => o.buyerId === currentUser.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  const activeOrders = buyerOrders.filter((o) =>
    ['CONFIRMED', 'PENDING_SELLER_APPROVAL', 'ACCEPTED', 'PREPARING', 'READY', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(
      o.status
    )
  );
  const completedOrders = buyerOrders.filter((o) => o.status === 'DELIVERED');
  const cancelledOrders = buyerOrders.filter((o) => o.status === 'REJECTED' || o.status === 'CANCELLED');

  const filteredOrders =
    filter === 'active'
      ? activeOrders
      : filter === 'completed'
      ? completedOrders
      : filter === 'cancelled'
      ? cancelledOrders
      : buyerOrders;

  // Visual Timeline Helper: Ordered → Preparing → Out for Delivery → Delivered
  const getTimelineStep = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'PENDING_SELLER_APPROVAL':
      case 'ACCEPTED':
        return 1;
      case 'PREPARING':
      case 'READY':
      case 'READY_FOR_DELIVERY':
        return 2;
      case 'OUT_FOR_DELIVERY':
        return 3;
      case 'DELIVERED':
        return 4;
      default:
        return 0; // cancelled / rejected
    }
  };

  return (
    <div className="space-y-6 text-stone-900 pb-16">
      {/* Page Header */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-800 font-semibold font-mono">
              <Package className="h-4 w-4 text-amber-600" />
              <span>Purchase History</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
              My Orders & Receipts
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Real-time updates directly from neighborhood shops in your city.
            </p>
          </div>

          <button
            onClick={onStartShopping}
            className="self-start sm:self-auto px-5 py-2.5 bg-stone-950 hover:bg-stone-800 text-white rounded-full text-xs font-semibold transition cursor-pointer shadow-xs active:scale-[0.98]"
          >
            Explore Local Stores
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 pt-6 border-t border-stone-100 mt-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full text-xs font-medium transition cursor-pointer ${
              filter === 'all'
                ? 'bg-stone-950 text-white font-semibold shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            All Orders ({buyerOrders.length})
          </button>

          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-full text-xs font-medium transition cursor-pointer ${
              filter === 'active'
                ? 'bg-stone-950 text-white font-semibold shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            Active ({activeOrders.length})
          </button>

          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-full text-xs font-medium transition cursor-pointer ${
              filter === 'completed'
                ? 'bg-stone-950 text-white font-semibold shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            Delivered ({completedOrders.length})
          </button>

          <button
            onClick={() => setFilter('cancelled')}
            className={`px-4 py-2 rounded-full text-xs font-medium transition cursor-pointer ${
              filter === 'cancelled'
                ? 'bg-stone-950 text-white font-semibold shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
            }`}
          >
            Cancelled ({cancelledOrders.length})
          </button>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="p-16 text-center bg-white border border-stone-200 rounded-3xl shadow-xs space-y-4">
          <ShoppingBag className="h-12 w-12 text-stone-300 mx-auto" />
          <h3 className="text-lg font-semibold text-stone-900">No Orders Found</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {filter === 'all'
              ? "You haven't placed any orders yet. Browse products from nearby neighborhood shops."
              : `No orders found under "${filter}".`}
          </p>
          <button
            onClick={onStartShopping}
            className="mt-2 px-6 py-2.5 bg-stone-950 hover:bg-stone-800 text-white text-xs font-semibold rounded-full transition cursor-pointer"
          >
            Start Shopping
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const step = getTimelineStep(order.status);
            const isCancelled = order.status === 'REJECTED' || order.status === 'CANCELLED';

            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="bg-white border border-stone-200 hover:border-amber-400 hover:shadow-md rounded-3xl p-5 sm:p-6 transition cursor-pointer space-y-4"
              >
                {/* Top Row: Order Number, Date, Status */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-800">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-stone-900">
                          #{order.orderNumber}
                        </span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <span className="text-[11px] text-stone-400 font-mono">
                        Placed on{' '}
                        {new Date(order.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold block">
                      Total Bill
                    </span>
                    <span className="text-xl font-bold text-stone-900">₹{order.total}</span>
                  </div>
                </div>

                {/* Middle Row: Seller & Items Preview */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-stone-900">
                      <Store className="h-4 w-4 text-amber-600" />
                      <span className="font-semibold text-sm">{order.sellerBusinessName}</span>
                    </div>

                    {/* Products summary */}
                    <div className="flex flex-wrap items-center gap-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs text-stone-800"
                        >
                          <img
                            src={item.productImage}
                            alt={item.productName}
                            className="w-7 h-7 rounded-lg object-cover bg-stone-200 shrink-0"
                          />
                          <span className="font-medium max-w-[140px] truncate">
                            {item.productName}
                          </span>
                          <span className="font-mono text-stone-500 font-semibold">
                            ×{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                      }}
                      className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-semibold rounded-full transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Receipt className="h-3.5 w-3.5 text-stone-600" />
                      <span>Details & Chat</span>
                      <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
                    </button>
                  </div>
                </div>

                {/* Bottom Timeline Indicator (Ordered → Preparing → Out for delivery → Delivered) */}
                {!isCancelled ? (
                  <div className="pt-3 border-t border-stone-100">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${
                            step >= 1
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          1
                        </div>
                        <span
                          className={`text-[11px] ${
                            step >= 1 ? 'font-semibold text-stone-900' : 'text-stone-400'
                          }`}
                        >
                          Ordered
                        </span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${
                            step >= 2
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          2
                        </div>
                        <span
                          className={`text-[11px] ${
                            step >= 2 ? 'font-semibold text-stone-900' : 'text-stone-400'
                          }`}
                        >
                          Preparing
                        </span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${
                            step >= 3
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          3
                        </div>
                        <span
                          className={`text-[11px] ${
                            step >= 3 ? 'font-semibold text-stone-900' : 'text-stone-400'
                          }`}
                        >
                          Out for Delivery
                        </span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${
                            step >= 4
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          ✓
                        </div>
                        <span
                          className={`text-[11px] ${
                            step >= 4 ? 'font-semibold text-emerald-800' : 'text-stone-400'
                          }`}
                        >
                          Delivered
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-stone-100 flex items-center gap-2 text-rose-700 text-xs font-medium">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span>This order was {order.status === 'REJECTED' ? 'declined by seller' : 'cancelled'}.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Order Detail & Live Chat Modal */}
      <BuyerOrderDetailModal
        order={selectedOrder ? orders.find((o) => o.id === selectedOrder.id) || selectedOrder : null}
        onClose={() => setSelectedOrder(null)}
        onCancelOrder={async (orderId) => {
          await cancelOrder(orderId);
        }}
      />
    </div>
  );
};
