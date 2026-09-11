import React, { useState } from 'react';
import { Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { DEFAULT_PRODUCT_IMAGE } from '../../services/imageStorageService';
import {
  Plus,
  Minus,
  Clock,
  Store,
  Sparkles,
  User,
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onOpenOrderDrawer: (sellerId: string) => void;
  onNavigateToAi?: (query: string) => void;
  onOpenLogin?: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onOpenOrderDrawer,
  onNavigateToAi,
  onOpenLogin,
}) => {
  const { isAuthenticated } = useAuth();
  const { getSellerById, activeCart, addToCart } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (!product) return null;

  const productPhotos = product.images && product.images.length > 0 
    ? product.images 
    : [product.imageUrl || DEFAULT_PRODUCT_IMAGE];
  const currentPhoto = productPhotos[activeImageIndex] || product.imageUrl || DEFAULT_PRODUCT_IMAGE;

  const seller = getSellerById(product.sellerId);

  const handleAdd = () => {
    if (!isAuthenticated) {
      onClose();
      if (onOpenLogin) onOpenLogin();
      return;
    }
    addToCart(product.sellerId, product, quantity);
    onClose();
    onOpenOrderDrawer(product.sellerId);
  };

  const handleAiQuestion = (question: string) => {
    onClose();
    if (onNavigateToAi) {
      onNavigateToAi(`Tell me about "${product.name}" from ${product.businessName}: ${question}`);
    }
  };

  return (
    <Modal isOpen={!!product} onClose={onClose} maxWidth="xl">
      <div className="space-y-6 text-stone-900">
        {/* Product Image & Badges */}
        <div className="space-y-2">
          <div className="relative h-64 sm:h-80 w-full overflow-hidden rounded-2xl bg-stone-100 border border-stone-200">
            <img
              src={currentPhoto}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
              }}
            />
            {product.discountPercent > 0 && (
              <span className="absolute top-3 left-3 bg-amber-600 text-white font-mono font-bold text-[10px] px-2.5 py-1 rounded-full shadow-sm">
                {product.discountPercent}% OFF
              </span>
            )}

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <span className="bg-stone-950/80 backdrop-blur-md text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                <Store className="h-3.5 w-3.5 text-amber-400" />
                {product.businessName}
              </span>
            </div>
          </div>

          {/* Multiple Photos Thumbnails */}
          {productPhotos.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {productPhotos.map((photoUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition shrink-0 cursor-pointer ${
                    activeImageIndex === idx ? 'border-amber-600 scale-105 shadow-sm' : 'border-stone-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={photoUrl}
                    alt={`${product.name} photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
            <span className="text-amber-700 font-semibold uppercase tracking-wider">
              {product.category}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-stone-400" />
              Ready: {product.preparationTime || 'Immediate dispatch'}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">{product.name}</h2>
          
          <div className="mt-2 flex items-baseline gap-3 pt-1">
            <span className="text-3xl font-bold text-stone-900">
              ₹{product.finalPrice}
            </span>
            {product.discountPercent > 0 && (
              <span className="text-sm text-stone-400 line-through">
                ₹{product.originalPrice}
              </span>
            )}
            <span className="text-xs font-semibold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
              Direct local price
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="text-xs sm:text-sm text-stone-600 leading-relaxed bg-stone-50 p-4 rounded-xl border border-stone-200 font-light">
          <p className="whitespace-pre-line">{product.description}</p>

          {product.tags && product.tags.length > 0 && (
            <div className="mt-4 pt-3 border-t border-stone-200 flex flex-wrap gap-2">
              {product.tags.map((t, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-0.5 bg-white border border-stone-200 rounded-md text-[10px] uppercase tracking-wider font-mono text-stone-600"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AI Quick Inquiry Questions */}
        <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-amber-900 font-semibold font-mono">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Ask LocalCart Assistant:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Can I request customization?',
              'What pairs well with this item?',
              'How fast can it be delivered?'
            ].map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAiQuestion(q)}
                className="px-3 py-1.5 bg-white hover:bg-amber-100/60 text-stone-800 rounded-full border border-amber-200 text-xs font-medium transition cursor-pointer shadow-xs"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity and Add to Cart Action */}
        <div className="pt-3 border-t border-stone-200">
          {!product.inStock || product.stockQuantity <= 0 ? (
            <div className="w-full py-3.5 px-6 bg-stone-100 text-stone-400 text-xs font-semibold rounded-full flex items-center justify-center cursor-not-allowed border border-stone-200 font-mono tracking-wider">
              OUT OF STOCK
            </div>
          ) : isAuthenticated ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 bg-stone-100 rounded-full border border-stone-200 p-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center font-bold text-stone-800 hover:bg-stone-50 cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono text-xs font-bold text-stone-900 px-2">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stockQuantity, quantity + 1))}
                  disabled={quantity >= product.stockQuantity}
                  className="w-8 h-8 rounded-full bg-stone-950 text-white flex items-center justify-center font-bold hover:bg-stone-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                onClick={handleAdd}
                className="flex-1 py-3.5 px-6 bg-stone-950 hover:bg-stone-800 text-white text-xs font-semibold rounded-full transition flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                <span>Add to Bill · ₹{product.finalPrice * quantity}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                onClose();
                if (onOpenLogin) onOpenLogin();
              }}
              className="w-full py-3.5 px-6 bg-stone-950 hover:bg-stone-800 text-white text-xs font-semibold rounded-full transition flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-[0.98]"
            >
              <User className="h-4 w-4 text-amber-400" />
              <span>Sign in to Purchase · ₹{product.finalPrice}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
