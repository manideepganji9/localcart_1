import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Order, OrderStatus, DeliveryMethod } from '../../types';
import { OrderStatusBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { useOrderChat } from '../../hooks/useOrderChat';
import { ChatAvatar } from '../common/ChatAvatar';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  MapPin,
  Phone,
  Calendar,
  Lock,
  MessageSquare,
  Send,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Package,
  ArrowRight,
  Loader2,
  User as UserIcon,
} from 'lucide-react';
import {
  DEFAULT_AVATAR,
  DEFAULT_STORE_PHOTO,
  DEFAULT_PRODUCT_IMAGE,
} from '../../services/imageStorageService';

interface SellerOrderChatFeedProps {
  order: Order;
  sellerBusinessName: string;
  currentUserId: string;
}

const SellerOrderChatFeed: React.FC<SellerOrderChatFeedProps> = ({
  order,
  sellerBusinessName,
  currentUserId,
}) => {
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    sendMessage,
    sending,
  } = useOrderChat({
    orderId: order.id,
    currentUserRole: 'SELLER',
    currentUserName: sellerBusinessName || 'Store Owner',
    currentUserId,
    recipientId: order.buyerId,
    fallbackMessages: order.messages || [],
  });

  const { currentUser } = useAuth();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || sending) return;
    const text = replyText;
    setReplyText('');
    await sendMessage(text);
  };

  return (
    <div className="space-y-3 pt-2 border-t border-[#FFFFFF10]">
      <h4 className="text-[9px] uppercase tracking-[0.25em] text-[#E5C392] font-mono flex items-center gap-1.5">
        <MessageSquare className="h-3 w-3" />
        <span>Direct Chat with Customer</span>
      </h4>

      <div className="max-h-52 overflow-y-auto space-y-2 p-3 bg-[#141414] border border-[#FFFFFF12] text-xs">
        {messages.length === 0 ? (
          <p className="text-center text-[#666] text-[11px] py-6 font-light">
            No messages recorded yet. Send a message to the customer below.
          </p>
        ) : (
          messages.map((msg) => {
            const isSys = msg.senderRole === 'SYSTEM';
            const isMe = msg.senderRole === 'SELLER';
            const msgSenderId = msg.senderId || (isMe ? currentUserId : order.buyerId);
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  isSys ? 'items-center my-1' : isMe ? 'items-end' : 'items-start'
                }`}
              >
                <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isSys && (
                    <ChatAvatar
                      userId={msgSenderId}
                      name={msg.senderName}
                      isCurrentUser={isMe}
                      currentUserAvatar={currentUser?.avatarUrl}
                      sizeClassName="w-6 h-6"
                    />
                  )}
                  <div
                    className={`p-2.5 border ${
                      isSys
                        ? 'bg-[#181818] text-[#E5C392] border-[#E5C392]/30 text-[10px] font-mono w-full'
                        : isMe
                        ? 'bg-[#1F1F1F] text-white border-[#FFFFFF20]'
                        : 'bg-[#161616] text-[#D0D0D0] border-[#FFFFFF15]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[9px] opacity-75 mb-0.5 font-mono gap-3">
                      <span>{msg.senderName}</span>
                      <div className="flex items-center gap-1">
                        <span>
                          {new Date(msg.timestamp || msg.createdAt || Date.now()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {msg.status === 'sending' && (
                          <span className="text-[#E5C392] animate-pulse">●</span>
                        )}
                      </div>
                    </div>
                    <p className="font-light whitespace-pre-wrap">{msg.text || (msg as any).message}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Transmit message to client..."
          className="flex-1 px-3 py-2 bg-[#181818] border border-[#FFFFFF15] focus:border-[#E5C392] text-xs text-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={!replyText.trim() || sending}
          className="px-4 py-2 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-xs font-bold disabled:opacity-40 transition"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
};

export const SellerOrders: React.FC = () => {
  const { currentUser } = useAuth();
  const { getSellerByUserId, orders, updateOrderStatus, addOrderMessage } = useStore();

  const seller = currentUser ? getSellerByUserId(currentUser.id) : undefined;
  const sellerOrders = seller ? orders.filter(o => o.sellerId === seller.id) : [];

  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'completed' | 'rejected'>('pending');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // In-app chat input
  const [replyText, setReplyText] = useState('');

  // Filter orders by tabs
  const pendingOrders = sellerOrders.filter(o => o.status === 'CONFIRMED' || o.status === 'PENDING_SELLER_APPROVAL' || o.status === 'ACCEPTED');
  const activeOrders = sellerOrders.filter(o => ['PREPARING', 'READY', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'].includes(o.status));
  const completedOrders = sellerOrders.filter(o => o.status === 'DELIVERED');
  const rejectedOrders = sellerOrders.filter(o => o.status === 'REJECTED' || o.status === 'CANCELLED');

  const currentTabOrders =
    activeTab === 'pending'
      ? pendingOrders
      : activeTab === 'active'
      ? activeOrders
      : activeTab === 'completed'
      ? completedOrders
      : rejectedOrders;

  const currentSelectedOrder = selectedOrder ? (orders.find(o => o.id === selectedOrder.id) || selectedOrder) : null;
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      if (selectedOrder?.id === orderId) {
        const updated = orders.find(o => o.id === orderId);
        if (updated) {
          setSelectedOrder(updated);
        } else {
          setSelectedOrder(prev => (prev ? { ...prev, status: newStatus } : null));
        }
      }
    } catch (err) {
      console.error('Failed to change status:', err);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !replyText.trim()) return;
    addOrderMessage(
      selectedOrder.id,
      'SELLER',
      seller?.businessName || 'Store Owner',
      replyText
    );
    setReplyText('');
    const updated = orders.find(o => o.id === selectedOrder.id);
    if (updated) setSelectedOrder(updated);
  };

  return (
    <div className="space-y-8 text-[#F5F5F5]">
      {/* Header */}
      <div>
        <span className="text-[10px] uppercase tracking-[0.3em] text-[#E5C392] font-mono">Commission Ledger</span>
        <h1 className="font-serif text-3xl sm:text-4xl text-white tracking-tight">
          Orders & Fulfillment
        </h1>
        <p className="text-xs text-[#8E8E8E] mt-1 font-light">
          Authorize incoming requests, freeze immutable bills, and monitor client delivery lifecycle.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#FFFFFF15] pb-3">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium transition border ${
            activeTab === 'pending'
              ? 'bg-[#E5C392] text-black border-[#E5C392] font-semibold'
              : 'bg-[#141414] text-[#A0A0A0] border-[#FFFFFF15] hover:border-[#FFFFFF30]'
          }`}
        >
          <Clock className="h-3 w-3" />
          <span>New Orders</span>
          <span className={`ml-1 px-1.5 py-0.2 font-mono text-[9px] ${
            activeTab === 'pending' ? 'bg-black text-white' : 'bg-[#1C1C1C] text-[#E5C392]'
          }`}>
            {pendingOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium transition border ${
            activeTab === 'active'
              ? 'bg-[#E5C392] text-black border-[#E5C392] font-semibold'
              : 'bg-[#141414] text-[#A0A0A0] border-[#FFFFFF15] hover:border-[#FFFFFF30]'
          }`}
        >
          <Package className="h-3 w-3" />
          <span>In Preparation & Transit</span>
          <span className="ml-1 px-1.5 py-0.2 font-mono text-[9px] bg-[#1C1C1C] text-[#A0A0A0]">
            {activeOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium transition border ${
            activeTab === 'completed'
              ? 'bg-[#E5C392] text-black border-[#E5C392] font-semibold'
              : 'bg-[#141414] text-[#A0A0A0] border-[#FFFFFF15] hover:border-[#FFFFFF30]'
          }`}
        >
          <CheckCircle2 className="h-3 w-3" />
          <span>Fulfilled</span>
          <span className="ml-1 px-1.5 py-0.2 font-mono text-[9px] bg-[#1C1C1C] text-[#A0A0A0]">
            {completedOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('rejected')}
          className={`flex items-center gap-2 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] font-medium transition border ${
            activeTab === 'rejected'
              ? 'bg-[#E5C392] text-black border-[#E5C392] font-semibold'
              : 'bg-[#141414] text-[#A0A0A0] border-[#FFFFFF15] hover:border-[#FFFFFF30]'
          }`}
        >
          <XCircle className="h-3 w-3" />
          <span>Voided ({rejectedOrders.length})</span>
        </button>
      </div>

      {/* Orders List & Detail Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Orders List */}
        <div className={`${selectedOrder ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-3`}>
          {currentTabOrders.length === 0 ? (
            <div className="p-16 text-center bg-[#121212] border border-[#FFFFFF18]">
              <ShoppingBag className="h-10 w-10 text-[#444] mx-auto mb-3" />
              <h3 className="font-serif text-lg text-white">No {activeTab} commissions</h3>
              <p className="text-xs text-[#808080] mt-1 font-light">
                {activeTab === 'pending'
                  ? 'All requests have been evaluated. Incoming requests will log here in real-time.'
                  : `No entries archived under ${activeTab}.`}
              </p>
            </div>
          ) : (
            currentTabOrders.map(order => {
              const isSelected = selectedOrder?.id === order.id;
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`p-4 bg-[#141414] border cursor-pointer transition ${
                    isSelected
                      ? 'border-[#E5C392] bg-[#181818]'
                      : 'border-[#FFFFFF15] hover:border-[#FFFFFF30]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white">
                        #{order.orderNumber}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <span className="font-serif text-base text-white font-medium">
                      ₹{order.total}
                    </span>
                  </div>

                  <div className="text-xs text-[#E0E0E0]">
                    {order.buyerName} · <span className="text-[#888] font-mono text-[11px]">{order.buyerLocation.area}</span>
                  </div>

                  <div className="text-[11px] text-[#999] mt-1 line-clamp-1 font-light">
                    {order.items.map(i => `${i.productName} (${i.quantity})`).join(', ')}
                  </div>

                  {(order.status === 'CONFIRMED' || order.status === 'PENDING_SELLER_APPROVAL' || order.status === 'ACCEPTED') && (
                    <div className="mt-3 pt-2.5 border-t border-[#FFFFFF10] flex items-center justify-between gap-2">
                      <span className="text-[9px] uppercase tracking-wider text-[#E5C392] font-mono flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Confirmed Order
                      </span>
                      <button
                        disabled={updatingOrderId === order.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(order.id, 'PREPARING');
                        }}
                        className="px-3 py-1 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-wider font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {updatingOrderId === order.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <span>Prepare</span>
                            <ArrowRight className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {order.isBillLocked && (
                    <div className="mt-2 text-[9px] uppercase tracking-widest text-[#888] font-mono flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5 text-[#E5C392]" />
                      <span>Immutable Bill Snapshot</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Selected Order Detail Card */}
        {currentSelectedOrder && (
          <div className="lg:col-span-7 bg-[#121212] border border-[#FFFFFF18] p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#FFFFFF10] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-2xl text-white">
                    Order #{currentSelectedOrder.orderNumber}
                  </h2>
                  <OrderStatusBadge status={currentSelectedOrder.status} />
                </div>
                <p className="text-[10px] uppercase tracking-wider text-[#808080] font-mono mt-1">
                  Commissioned: {new Date(currentSelectedOrder.createdAt).toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="text-[10px] uppercase tracking-wider text-[#777] hover:text-white cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            {/* Buyer Contact & Address */}
            <div className="p-4 bg-[#161616] border border-[#FFFFFF12] text-xs space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#E5C392] flex items-center justify-between">
                <span>Client Identification</span>
                <span className="text-[#666]">Ref: {currentSelectedOrder.buyerId}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-[#FFFFFF20] bg-[#222] shrink-0">
                  <img
                    src={DEFAULT_AVATAR}
                    alt={currentSelectedOrder.buyerName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                </div>
                <div>
                  <h4 className="font-serif text-sm text-white">{currentSelectedOrder.buyerName}</h4>
                  <div className="flex items-center gap-3 text-[#A0A0A0] text-xs font-light mt-0.5">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Phone className="h-3 w-3 text-[#E5C392]" />
                      {currentSelectedOrder.buyerPhone}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-[#E5C392]" />
                      <span className="truncate max-w-xs">
                        {currentSelectedOrder.buyerLocation.address || `${currentSelectedOrder.buyerLocation.area}, ${currentSelectedOrder.buyerLocation.city}`}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              {currentSelectedOrder.customerNotes && (
                <div className="pt-2 border-t border-[#FFFFFF10] text-[#B0B0B0] font-light italic">
                  <strong>Client Commission Note:</strong> "{currentSelectedOrder.customerNotes}"
                </div>
              )}
            </div>

            {/* Locked Immutable Final Bill */}
            <div className="border border-[#FFFFFF15] overflow-hidden">
              <div className="bg-[#181818] border-b border-[#FFFFFF15] px-4 py-2.5 flex items-center justify-between text-[10px] uppercase tracking-widest font-mono text-[#E5C392]">
                <div className="flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  <span>{currentSelectedOrder.isBillLocked ? 'FINAL BILL — FROZEN' : 'PROVISIONAL ITEMS SUMMARY'}</span>
                </div>
                <span>{currentSelectedOrder.isBillLocked ? '🔒 Immutable' : 'Draft'}</span>
              </div>

              <div className="p-4 bg-[#141414] space-y-3">
                {currentSelectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-[#FFFFFF0A] last:border-0">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.productImage || DEFAULT_PRODUCT_IMAGE}
                        alt={item.productName}
                        className="w-10 h-10 object-cover grayscale contrast-110 border border-[#FFFFFF10]"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                        }}
                      />
                      <div>
                        <div className="font-serif text-sm text-white">{item.productName}</div>
                        <div className="text-[10px] font-mono text-[#808080]">
                          {item.quantity} × ₹{item.unitPrice}
                          {item.discountPercent > 0 && (
                            <span className="text-[#E5C392] ml-1">({item.discountPercent}% concession)</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="font-serif text-sm text-white">₹{item.itemTotal}</div>
                  </div>
                ))}

                <div className="pt-3 border-t border-[#FFFFFF12] space-y-1 text-xs text-[#B0B0B0] font-mono">
                  <div className="flex justify-between">
                    <span>Items Subtotal:</span>
                    <span className="text-white">₹{currentSelectedOrder.subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Handling:</span>
                    <span className="text-white">₹{currentSelectedOrder.deliveryFee}</span>
                  </div>
                  <div className="flex justify-between text-base font-serif text-white pt-2 border-t border-[#FFFFFF15]">
                    <span>Grand Total:</span>
                    <span className="text-[#E5C392] font-medium">₹{currentSelectedOrder.total}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow Action Controls for Seller */}
            <div className="p-4 bg-[#161616] border border-[#FFFFFF15] space-y-3">
              <h4 className="text-[9px] uppercase tracking-[0.25em] text-[#E5C392] font-mono">
                Fulfillment & Dispatch Stage
              </h4>

              {(currentSelectedOrder.status === 'CONFIRMED' || currentSelectedOrder.status === 'PENDING_SELLER_APPROVAL' || currentSelectedOrder.status === 'ACCEPTED') && (
                <button
                  disabled={updatingOrderId === currentSelectedOrder.id}
                  onClick={() => handleStatusChange(currentSelectedOrder.id, 'PREPARING')}
                  className="w-full py-2.5 px-4 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-[0.2em] font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {updatingOrderId === currentSelectedOrder.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Package className="h-3.5 w-3.5" />
                      <span>Begin Preparation</span>
                    </>
                  )}
                </button>
              )}

              {currentSelectedOrder.status === 'PREPARING' && (
                <button
                  disabled={updatingOrderId === currentSelectedOrder.id}
                  onClick={() => handleStatusChange(currentSelectedOrder.id, 'READY')}
                  className="w-full py-2.5 px-4 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-[0.2em] font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {updatingOrderId === currentSelectedOrder.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Mark Ready for Delivery / Pickup</span>
                    </>
                  )}
                </button>
              )}

              {(currentSelectedOrder.status === 'READY' || currentSelectedOrder.status === 'READY_FOR_DELIVERY') && (
                <button
                  disabled={updatingOrderId === currentSelectedOrder.id}
                  onClick={() => handleStatusChange(currentSelectedOrder.id, 'OUT_FOR_DELIVERY')}
                  className="w-full py-2.5 px-4 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-[0.2em] font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {updatingOrderId === currentSelectedOrder.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Truck className="h-3.5 w-3.5" />
                      <span>Dispatch (Out for Delivery)</span>
                    </>
                  )}
                </button>
              )}

              {currentSelectedOrder.status === 'OUT_FOR_DELIVERY' && (
                <button
                  disabled={updatingOrderId === currentSelectedOrder.id}
                  onClick={() => handleStatusChange(currentSelectedOrder.id, 'DELIVERED')}
                  className="w-full py-2.5 px-4 bg-[#86EFAC] text-black text-[10px] uppercase tracking-[0.2em] font-semibold transition flex items-center justify-center gap-2 hover:bg-[#A7F3D0] cursor-pointer disabled:opacity-50"
                >
                  {updatingOrderId === currentSelectedOrder.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Confirm Handover & Delivery Completed</span>
                    </>
                  )}
                </button>
              )}

              {currentSelectedOrder.status === 'DELIVERED' && (
                <div className="p-3 text-center text-[10px] uppercase tracking-wider font-mono text-[#86EFAC] bg-[#102816] border border-[#1E4D2B]">
                  ✓ Order successfully delivered and fulfilled.
                </div>
              )}
            </div>

            {/* In-App Messaging Feed */}
            <SellerOrderChatFeed
              order={currentSelectedOrder}
              sellerBusinessName={seller?.businessName || 'Store'}
              currentUserId={currentUser?.id || seller?.userId || 'seller'}
            />
          </div>
        )}
      </div>
    </div>
  );
};
