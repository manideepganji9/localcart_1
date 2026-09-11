import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { CartItem } from '../../types';
import {
  X,
  Plus,
  Minus,
  ShoppingBag,
  Trash2,
  Lock,
  MapPin,
  Clock,
  Truck,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface OrderBillDrawerProps {
  sellerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderPlaced: (orderId: string) => void;
  onOpenLogin: () => void;
}

export const OrderBillDrawer: React.FC<OrderBillDrawerProps> = ({
  sellerId,
  isOpen,
  onClose,
  onOrderPlaced,
  onOpenLogin,
}) => {
  const { currentUser } = useAuth();
  const { getSellerById, products, activeCart, updateCartQuantity, clearCart, createOrderRequest, customerLocation } = useStore();

  const [deliveryAddress, setDeliveryAddress] = useState(
    customerLocation?.address || currentUser?.location?.address || currentUser?.savedAddress || ''
  );
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  const [customerNotes, setCustomerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const defaultAddr = customerLocation?.address || currentUser?.location?.address || currentUser?.savedAddress || '';
    if (defaultAddr && !deliveryAddress) {
      setDeliveryAddress(defaultAddr);
    }
    if (currentUser?.phone && !customerPhone) {
      setCustomerPhone(currentUser.phone);
    }
  }, [customerLocation?.address, currentUser?.location?.address, currentUser?.savedAddress, currentUser?.phone]);

  const seller = sellerId ? getSellerById(sellerId) : null;
  const cartItems: Record<string, number> = sellerId ? (activeCart[sellerId] || {}) : {};

  if (!isOpen || !sellerId || !seller) return null;

  // Build items array
  const formattedCartItems: CartItem[] = [];
  let subtotal = 0;

  Object.entries(cartItems).forEach(([productId, qty]) => {
    const quantity = qty as number;
    if (quantity > 0) {
      const p = products.find(prod => prod.id === productId);
      if (p) {
        const itemTotal = p.finalPrice * quantity;
        subtotal += itemTotal;
        formattedCartItems.push({
          product: p,
          quantity,
        });
      }
    }
  });

  const deliveryFee =
    subtotal >= (seller.deliveryOptions?.freeDeliveryAbove || 1500)
      ? 0
      : (seller.deliveryOptions?.baseDeliveryFee || 50);

  const grandTotal = subtotal + deliveryFee;

  const isOwnShop = currentUser && seller && (seller.userId === currentUser.id || (currentUser.role === 'SELLER' && seller.userId === currentUser.id));

  const handlePlaceOrder = async () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }

    if (isOwnShop) {
      setSubmitError('Sellers cannot purchase products from their own storefront. Please use a buyer account.');
      return;
    }

    if (formattedCartItems.length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const order = await createOrderRequest({
        buyerId: currentUser.id,
        buyerName: currentUser.fullName || 'Patron',
        buyerPhone: customerPhone,
        buyerLocation: {
          city: customerLocation?.city || currentUser.location?.city || seller.location.city,
          state: customerLocation?.state || currentUser.location?.state || seller.location.state || '',
          pincode: customerLocation?.pincode || currentUser.location?.pincode || '',
          area: customerLocation?.area || currentUser.location?.area || seller.location.area,
          address: deliveryAddress,
          coordinates: customerLocation?.coordinates || currentUser.location?.coordinates,
        },
        sellerId: seller.id,
        items: formattedCartItems,
        customerNotes,
      });

      setIsSubmitting(false);
      onClose();
      onOrderPlaced(order.id);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || 'Failed to confirm order. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#121212] text-[#F5F5F5] border-l border-[#FFFFFF22] shadow-2xl flex flex-col justify-between">
          {/* Top Bar */}
          <div className="p-5 border-b border-[#FFFFFF15] flex items-center justify-between bg-[#161616]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border border-[#E5C392]/50 bg-[#121212] flex items-center justify-center font-bold text-[#E5C392]">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-serif text-base text-[#FAFAFA] truncate max-w-[200px]">
                  {seller.businessName}
                </h3>
                <div className="text-[9px] uppercase tracking-widest text-[#808080] font-mono flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5 text-[#E5C392]" />
                  <span>{seller.location.area}, {seller.location.city}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-[#888888] hover:text-white border border-transparent hover:border-[#FFFFFF20]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
            {submitError && (
              <div className="p-3 bg-[#281010] border border-[#502020] text-[#FF8080] text-[11px] font-mono flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {formattedCartItems.length === 0 ? (
              <div className="py-16 text-center text-[#707070]">
                <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-[#444]" />
                <p className="font-serif text-lg text-[#F5F5F5]">Order Bill is Empty</p>
                <p className="text-[#777] text-[11px] mt-1 font-light">
                  Select items from {seller.businessName}'s store
                </p>
              </div>
            ) : (
              <>
                {/* Items List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[#808080] font-mono uppercase tracking-[0.2em] text-[9px] border-b border-[#FFFFFF10] pb-2">
                    <span>Selected Items ({formattedCartItems.length})</span>
                    <button
                      onClick={() => clearCart(seller.id)}
                      className="text-[#FF6B6B] hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {formattedCartItems.map(({ product, quantity }) => (
                      <div
                        key={product.id}
                        className="p-3 bg-[#181818] border border-[#FFFFFF12] flex items-center justify-between gap-3"
                      >
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-12 h-12 object-cover border border-[#FFFFFF15] grayscale contrast-110 shrink-0"
                        />

                        <div className="flex-1 min-w-0">
                          <h4 className="font-serif text-sm text-[#F5F5F5] truncate">
                            {product.name}
                          </h4>
                          <div className="text-[10px] text-[#808080] font-mono mt-0.5">
                            ₹{product.finalPrice}
                            {product.discountPercent > 0 && (
                              <span className="text-[#E5C392] ml-1">({product.discountPercent}% off)</span>
                            )}
                          </div>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-1 bg-[#121212] border border-[#FFFFFF20] p-1">
                          <button
                            onClick={() => updateCartQuantity(seller.id, product.id, -1)}
                            className="w-5 h-5 text-[#999] hover:text-white flex items-center justify-center cursor-pointer"
                          >
                            <Minus className="h-2.5 w-2.5" />
                          </button>
                          <span className="font-mono text-xs px-1.5 text-white">
                            {quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(seller.id, product.id, 1)}
                            className="w-5 h-5 bg-[#E5C392] text-black hover:bg-[#F5DEB3] flex items-center justify-center font-bold cursor-pointer"
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </button>
                        </div>

                        <div className="font-serif text-sm text-white w-14 text-right shrink-0">
                          ₹{product.finalPrice * quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Information */}
                <div className="p-4 bg-[#161616] border border-[#FFFFFF14] space-y-3">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[#E5C392] font-mono flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5" />
                    <span>Patron Dispatch Details</span>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#808080] font-mono mb-1">
                      Delivery Address *
                    </label>
                    <textarea
                      rows={2}
                      value={deliveryAddress}
                      onChange={e => setDeliveryAddress(e.target.value)}
                      className="w-full p-2.5 bg-[#121212] border border-[#FFFFFF18] focus:border-[#E5C392] text-xs text-white focus:outline-none tracking-wide"
                      placeholder="Enter flat / house number, street, locality"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#808080] font-mono mb-1">
                      Contact Line *
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="w-full p-2 bg-[#121212] border border-[#FFFFFF18] focus:border-[#E5C392] text-xs text-white focus:outline-none font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#808080] font-mono mb-1">
                      Special Commission Note
                    </label>
                    <input
                      type="text"
                      value={customerNotes}
                      onChange={e => setCustomerNotes(e.target.value)}
                      placeholder="e.g. Message inscription, eggless, bespoke wrapping..."
                      className="w-full p-2 bg-[#121212] border border-[#FFFFFF18] focus:border-[#E5C392] text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Order Bill Breakdown */}
                <div className="p-4 bg-[#0A0A0A] border border-[#FFFFFF22] space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#FFFFFF15]">
                    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#E5C392] flex items-center gap-1.5">
                      <Lock className="h-3 w-3" />
                      Order Bill Snapshot
                    </span>
                    <span className="text-[9px] uppercase tracking-widest text-[#707070] font-mono">Immutable Upon Lock</span>
                  </div>

                  <div className="flex justify-between text-[#B0B0B0] text-xs">
                    <span>Items Subtotal:</span>
                    <span className="font-mono text-white">₹{subtotal}</span>
                  </div>

                  <div className="flex justify-between text-[#B0B0B0] text-xs">
                    <span>Seller Delivery:</span>
                    <span>{deliveryFee === 0 ? <strong className="text-[#86EFAC] font-mono">FREE</strong> : <span className="font-mono text-white">₹{deliveryFee}</span>}</span>
                  </div>

                  {deliveryFee > 0 && subtotal < (seller.deliveryOptions?.freeDeliveryAbove || 1500) && (
                    <div className="text-[10px] text-[#E5C392] bg-[#E5C392]/10 border border-[#E5C392]/20 p-2 font-mono">
                      Add ₹{(seller.deliveryOptions?.freeDeliveryAbove || 1500) - subtotal} more for complimentary delivery.
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#FFFFFF18] flex justify-between text-base font-serif text-white">
                    <span>Total Amount:</span>
                    <span className="text-[#E5C392] font-semibold">₹{grandTotal}</span>
                  </div>
                </div>

                {/* Locked Bill Guarantee */}
                <div className="p-3 bg-[#181818] border border-[#FFFFFF12] text-[#999999] text-[10px] flex items-start gap-2.5 font-light leading-relaxed">
                  <ShieldCheck className="h-4 w-4 text-[#E5C392] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#F5F5F5] font-normal">Direct Purchase & Locked Bill:</strong> Upon confirmation, your order is immediately confirmed, item stock is atomically reserved, and final bill prices freeze permanently in Firestore.
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Action Button */}
          {formattedCartItems.length > 0 && (
            <div className="p-5 border-t border-[#FFFFFF15] bg-[#141414]">
              {currentUser ? (
                <button
                  onClick={handlePlaceOrder}
                  disabled={isSubmitting || !deliveryAddress.trim() || Boolean(isOwnShop)}
                  className="w-full py-3.5 px-4 bg-[#F5F5F5] hover:bg-[#E5C392] text-black font-semibold text-xs uppercase tracking-[0.2em] transition duration-200 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                      <span>Confirming Order & Securing Inventory...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      <span>Confirm Purchase (₹{grandTotal})</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={onOpenLogin}
                  className="w-full py-3.5 px-4 bg-[#E5C392] text-black font-semibold text-xs uppercase tracking-[0.2em] transition cursor-pointer"
                >
                  Sign In with Google to Order
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
