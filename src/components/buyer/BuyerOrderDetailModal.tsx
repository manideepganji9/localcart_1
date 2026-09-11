import React, { useState, useRef, useEffect } from 'react';
import { Order } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useOrderChat } from '../../hooks/useOrderChat';
import { Modal } from '../common/Modal';
import { OrderStatusBadge } from '../common/Badge';
import { ChatAvatar } from '../common/ChatAvatar';
import {
  Lock,
  ShoppingBag,
  Truck,
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Store,
  ShieldCheck,
  Ban,
  Receipt,
} from 'lucide-react';
import {
  DEFAULT_AVATAR,
  DEFAULT_STORE_PHOTO,
  DEFAULT_PRODUCT_IMAGE,
} from '../../services/imageStorageService';

interface BuyerOrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onCancelOrder: (orderId: string) => Promise<void>;
}

export const BuyerOrderDetailModal: React.FC<BuyerOrderDetailModalProps> = ({
  order,
  onClose,
  onCancelOrder,
}) => {
  const { currentUser } = useAuth();
  const { orders, getSellerById } = useStore();
  const [chatInput, setChatInput] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get freshest state of this order safely
  const currentOrder = order ? orders.find((o) => o.id === order.id) || order : null;
  const seller = currentOrder ? getSellerById(currentOrder.sellerId) : null;
  const sellerUserId = seller?.userId || currentOrder?.sellerId || '';

  // Real-time Firestore subcollection chat hook with optimistic UI & fallback
  const { messages, sendMessage, sending } = useOrderChat({
    orderId: currentOrder?.id || '',
    currentUserRole: 'BUYER',
    currentUserName: currentUser?.fullName || currentOrder?.buyerName || 'Buyer',
    currentUserId: currentUser?.id || currentOrder?.buyerId || '',
    recipientId: sellerUserId,
    fallbackMessages: currentOrder?.messages || [],
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!order || !currentOrder) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || sending) return;
    const textToSend = chatInput;
    setChatInput('');
    await sendMessage(textToSend);
  };

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    try {
      await onCancelOrder(currentOrder.id);
      setShowCancelConfirm(false);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Could not cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const steps = [
    { key: 'CONFIRMED', label: 'Confirmed' },
    { key: 'PREPARING', label: 'Preparing' },
    { key: 'READY', label: 'Ready' },
    { key: 'OUT_FOR_DELIVERY', label: 'Dispatched' },
    { key: 'DELIVERED', label: 'Delivered' },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'PENDING_SELLER_APPROVAL':
      case 'ACCEPTED':
        return 0;
      case 'PREPARING':
        return 1;
      case 'READY':
      case 'READY_FOR_DELIVERY':
        return 2;
      case 'OUT_FOR_DELIVERY':
        return 3;
      case 'DELIVERED':
        return 4;
      default:
        return -1;
    }
  };

  const currentStepIdx = getStepIndex(currentOrder.status);
  const canCancel =
    currentOrder.status === 'CONFIRMED' ||
    currentOrder.status === 'PENDING_SELLER_APPROVAL' ||
    currentOrder.status === 'ACCEPTED';

  return (
    <Modal isOpen={!!order} onClose={onClose} maxWidth="2xl">
      <div className="space-y-6 text-xs text-stone-900">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 shrink-0">
              <img
                src={seller?.storePhotoUrl || seller?.logoUrl || DEFAULT_STORE_PHOTO}
                alt={currentOrder.sellerBusinessName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_STORE_PHOTO;
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-stone-900">
                  Order #{currentOrder.orderNumber}
                </h2>
                <OrderStatusBadge status={currentOrder.status} />
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                From <strong className="text-amber-800 font-semibold">{currentOrder.sellerBusinessName}</strong> ·{' '}
                {new Date(currentOrder.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold block">
              Total Bill
            </span>
            <span className="text-2xl font-bold text-stone-900">₹{currentOrder.total}</span>
          </div>
        </div>

        {/* Progress Tracker (If not rejected/cancelled) */}
        {currentOrder.status !== 'REJECTED' && currentOrder.status !== 'CANCELLED' && (
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-stone-600 font-semibold font-mono">
              Fulfillment Status
            </h3>

            <div className="grid grid-cols-5 gap-2 text-center">
              {steps.map((s, idx) => {
                const isPassed = currentStepIdx >= idx;
                const isCurrent = currentStepIdx === idx;
                return (
                  <div key={s.key} className="space-y-1.5">
                    <div
                      className={`h-2 rounded-full transition-colors ${
                        isPassed ? 'bg-amber-600' : 'bg-stone-200'
                      }`}
                    />
                    <span
                      className={`text-[10px] block font-medium ${
                        isCurrent
                          ? 'text-amber-800 font-bold'
                          : isPassed
                          ? 'text-stone-800'
                          : 'text-stone-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rejection / Cancellation Notice */}
        {(currentOrder.status === 'REJECTED' || currentOrder.status === 'CANCELLED') && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-start gap-2.5">
            <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-xs font-semibold">
                {currentOrder.status === 'REJECTED' ? 'Order Declined by Seller' : 'Order Cancelled'}
              </strong>
              <p className="text-xs text-rose-700 mt-0.5">
                {currentOrder.rejectionReason || 'This order was not approved or was cancelled.'}
              </p>
            </div>
          </div>
        )}

        {/* Two Column Grid: Items & Bill Left, Chat & Details Right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Column: Items & Locked Bill */}
          <div className="space-y-4">
            <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-xs font-bold text-stone-900">
                  Ordered Items ({currentOrder.items.length})
                </span>
                <span className="text-[10px] font-mono text-stone-400">
                  {currentOrder.isBillLocked ? '🔒 Locked Snapshot' : 'Direct Invoice'}
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {currentOrder.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2 bg-stone-50 border border-stone-100 rounded-xl"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={item.productImage || DEFAULT_PRODUCT_IMAGE}
                        alt={item.productName}
                        className="w-9 h-9 rounded-lg object-cover bg-stone-200 shrink-0"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                        }}
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-medium text-stone-900 truncate">{item.productName}</h4>
                        <span className="text-[10px] text-stone-500 font-mono">
                          {item.quantity} × ₹{item.unitPrice}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-stone-900">₹{item.itemTotal}</span>
                  </div>
                ))}
              </div>

              {/* Bill totals */}
              <div className="pt-2 border-t border-stone-100 space-y-1 text-stone-600 font-mono text-xs">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="text-stone-900 font-semibold">₹{currentOrder.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery fee:</span>
                  <span>
                    {currentOrder.deliveryFee === 0 ? (
                      <strong className="text-emerald-700">FREE</strong>
                    ) : (
                      `₹${currentOrder.deliveryFee}`
                    )}
                  </span>
                </div>
                <div className="pt-2 border-t border-stone-200 flex justify-between text-sm text-stone-900">
                  <span className="font-bold">Total Bill:</span>
                  <span className="font-bold text-amber-800">₹{currentOrder.total}</span>
                </div>
              </div>
            </div>

            {/* Address & Delivery Notes */}
            <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs space-y-2">
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-amber-600" /> Delivery Address
              </span>
              <p className="text-xs text-stone-600 leading-relaxed">
                {currentOrder.buyerLocation.address ||
                  `${currentOrder.buyerLocation.area}, ${currentOrder.buyerLocation.city}`}
              </p>
              <p className="text-[11px] font-mono text-stone-500">
                Contact: {currentOrder.buyerName} ({currentOrder.buyerPhone})
              </p>
              {currentOrder.customerNotes && (
                <div className="mt-2 p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600 italic">
                  Note: "{currentOrder.customerNotes}"
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Direct Messaging Channel */}
          <div className="p-4 bg-white border border-stone-200 rounded-2xl shadow-xs flex flex-col justify-between h-[380px]">
            <div>
              <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
                <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-amber-600" /> Direct Chat with Seller
                </span>
                <span className="text-[10px] text-emerald-700 font-medium">● Real-time</span>
              </div>

              {/* Message log */}
              <div className="space-y-2.5 overflow-y-auto max-h-56 pr-1">
                {messages.length === 0 ? (
                  <p className="text-center text-stone-400 text-xs py-10 font-normal">
                    No messages yet. Send a message to the shop owner below.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isBuyer = msg.senderRole === 'BUYER';
                    const isSystem = msg.senderRole === 'SYSTEM';
                    const msgSenderId =
                      msg.senderId || (isBuyer ? currentUser?.id || currentOrder.buyerId : sellerUserId);
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isSystem ? 'items-center my-1' : isBuyer ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`flex items-end gap-2 max-w-[85%] ${
                            isBuyer ? 'flex-row-reverse' : 'flex-row'
                          }`}
                        >
                          {!isSystem && (
                            <ChatAvatar
                              userId={msgSenderId}
                              name={msg.senderName}
                              isCurrentUser={isBuyer}
                              currentUserAvatar={currentUser?.avatarUrl}
                              fallbackPhotoUrl={seller?.storePhotoUrl || seller?.logoUrl}
                              sizeClassName="w-6 h-6"
                            />
                          )}
                          <div
                            className={`p-2.5 text-xs rounded-2xl ${
                              isSystem
                                ? 'bg-stone-100 text-stone-600 text-center text-[10px] w-full'
                                : isBuyer
                                ? 'bg-stone-950 text-white rounded-br-none'
                                : 'bg-stone-100 text-stone-900 border border-stone-200 rounded-bl-none'
                            }`}
                          >
                            {!isSystem && (
                              <span className="text-[10px] font-medium block opacity-70 mb-0.5">
                                {msg.senderName} ({msg.senderRole === 'BUYER' ? 'You' : 'Seller'})
                              </span>
                            )}
                            <p className="whitespace-pre-wrap">{msg.text || (msg as any).message}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] text-stone-400">
                            {new Date(msg.timestamp || msg.createdAt || Date.now()).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {msg.status === 'sending' && (
                            <span className="text-[9px] text-amber-600 animate-pulse">● sending</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Chat Input form */}
            <form onSubmit={handleSendMessage} className="mt-3 flex gap-2 pt-2 border-t border-stone-100">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message shop owner directly..."
                className="flex-1 px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-full text-xs text-stone-900 focus:outline-none focus:border-amber-500 transition"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="px-4 py-2 bg-stone-950 hover:bg-stone-800 text-white rounded-full disabled:opacity-30 transition flex items-center justify-center font-bold cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Footer Actions & Cancellation Flow */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-stone-200">
          <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Direct local neighborhood transaction · Protected order</span>
          </div>

          {canCancel && !showCancelConfirm && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="px-4 py-2 text-xs font-semibold text-rose-700 hover:text-white border border-rose-200 hover:bg-rose-600 rounded-full transition cursor-pointer"
            >
              Cancel Order
            </button>
          )}

          {!canCancel &&
            currentOrder.status !== 'REJECTED' &&
            currentOrder.status !== 'CANCELLED' &&
            currentOrder.status !== 'DELIVERED' && (
              <span className="text-xs text-stone-400">
                Order in preparation: contact the shop owner above for inquiries.
              </span>
            )}

          {showCancelConfirm && (
            <div className="flex items-center gap-2 p-2 bg-rose-50 border border-rose-200 rounded-2xl">
              <span className="text-xs text-rose-800 font-medium pl-1">Cancel this order?</span>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-full hover:bg-rose-700 cursor-pointer"
              >
                {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 text-xs font-medium rounded-full hover:bg-stone-50 cursor-pointer"
              >
                Keep Order
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
