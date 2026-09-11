import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { PRODUCT_CATEGORIES } from '../../constants/config';
import { generateProductDescriptionAI } from '../../services/geminiService';
import { Modal } from '../common/Modal';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Sparkles,
  Check,
  X,
  AlertCircle,
  Clock,
  Tag,
  Loader2,
  Wand2,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import { ImageUploadBox } from '../common/ImageUploadBox';
import {
  uploadProductImage,
  deleteStorageImage,
  DEFAULT_PRODUCT_IMAGE,
} from '../../services/imageStorageService';

interface SellerProductsProps {
  isAddModalOpenInitially?: boolean;
  onCloseAddModal?: () => void;
}

export const SellerProducts: React.FC<SellerProductsProps> = ({
  isAddModalOpenInitially = false,
  onCloseAddModal,
}) => {
  const { currentUser } = useAuth();
  const { getSellerByUserId, products, addProduct, updateProduct, deleteProduct, toggleProductStock } = useStore();

  const seller = currentUser ? getSellerByUserId(currentUser.id) : undefined;
  const sellerProducts = seller ? products.filter(p => p.sellerId === seller.id) : [];

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(isAddModalOpenInitially);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeProductId, setActiveProductId] = useState<string>('');

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0].name);
  const [originalPrice, setOriginalPrice] = useState<number>(500);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [stockQuantity, setStockQuantity] = useState<number>(10);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);
  const [formError, setFormError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isUploadingAngle, setIsUploadingAngle] = useState(false);
  const [angleUploadError, setAngleUploadError] = useState<string | null>(null);
  const [preparationTime, setPreparationTime] = useState('2 - 4 hours');
  const [tagsInput, setTagsInput] = useState('Handmade, Fresh');
  const [inStock, setInStock] = useState(true);

  // AI Helper state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPromptFeatures, setAiPromptFeatures] = useState('');

  // Delete Confirm Modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const finalPrice = Math.round(originalPrice * (1 - (discountPercent || 0) / 100));

  const openAddModal = () => {
    const newId = `prod-${Date.now()}`;
    setActiveProductId(newId);
    setEditingProduct(null);
    setName('');
    setDescription('');
    setCategory(seller?.businessCategory || PRODUCT_CATEGORIES[0].name);
    setOriginalPrice(450);
    setDiscountPercent(0);
    setStockQuantity(10);
    setLowStockThreshold(5);
    setFormError(null);
    setImageUrl('');
    setImages([]);
    setPreparationTime('2 hours');
    setTagsInput('Handcrafted, Fresh');
    setInStock(true);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setActiveProductId(p.id);
    setEditingProduct(p);
    setName(p.name);
    setDescription(p.description);
    setCategory(p.category);
    setOriginalPrice(p.originalPrice);
    setDiscountPercent(p.discountPercent);
    setStockQuantity(p.stockQuantity ?? 0);
    setLowStockThreshold(typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 5);
    setFormError(null);
    setImageUrl(p.imageUrl || '');
    setImages(p.images && p.images.length > 0 ? p.images : (p.imageUrl ? [p.imageUrl] : []));
    setPreparationTime(p.preparationTime || 'Ready');
    setTagsInput(p.tags.join(', '));
    setInStock(p.inStock);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormError(null);
    if (onCloseAddModal) onCloseAddModal();
  };

  const handleGenerateAI = async () => {
    if (!name.trim()) return;
    setIsGeneratingAI(true);
    try {
      const res = await generateProductDescriptionAI(name, category, aiPromptFeatures || description);
      setDescription(res.description);
      if (res.suggestedTags && res.suggestedTags.length > 0) {
        setTagsInput(res.suggestedTags.join(', '));
      }
      if (res.prepTime) {
        setPreparationTime(res.prepTime);
      }
    } catch (e) {
      console.warn('AI generation failed:', e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seller) return;

    setFormError(null);

    const qty = Number(stockQuantity);
    const threshold = Number(lowStockThreshold);

    if (isNaN(qty) || !Number.isInteger(qty) || qty < 0) {
      setFormError('Available stock must be a whole number of 0 or higher.');
      return;
    }

    if (isNaN(threshold) || !Number.isInteger(threshold) || threshold < 0) {
      setFormError('Low Stock Alert At must be a whole number of 0 or higher.');
      return;
    }

    if (threshold > qty) {
      setFormError(`Low Stock Alert At cannot be greater than the available stock (${qty}).`);
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const primaryImg = imageUrl || DEFAULT_PRODUCT_IMAGE;
    const allImages = images.length > 0 ? (images.includes(primaryImg) ? images : [primaryImg, ...images]) : [primaryImg];

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name,
        description,
        category,
        originalPrice: Number(originalPrice),
        discountPercent: Number(discountPercent),
        stockQuantity: qty,
        lowStockThreshold: threshold,
        imageUrl: primaryImg,
        images: allImages,
        preparationTime,
        tags,
        inStock: qty > 0 ? inStock : false
      });
    } else {
      addProduct({
        sellerId: seller.id,
        businessName: seller.businessName,
        name,
        description,
        category,
        originalPrice: Number(originalPrice),
        discountPercent: Number(discountPercent),
        finalPrice,
        stockQuantity: qty,
        lowStockThreshold: threshold,
        inStock: qty > 0 ? inStock : false,
        imageUrl: primaryImg,
        images: allImages,
        preparationTime,
        tags
      });
    }

    handleCloseModal();
  };

  const filteredProducts = sellerProducts.filter(p => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-8 text-[#F5F5F5]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FFFFFF12] pb-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#E5C392] font-mono">Inventory</span>
          <h1 className="font-serif text-3xl sm:text-4xl text-white tracking-tight">
            Seller Catalog & Inventory
          </h1>
          <p className="text-xs text-[#8E8E8E] mt-1 font-light">
            Manage your products, stock quantities, and low stock alert thresholds.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-[0.2em] font-semibold transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#121212] p-3 border border-[#FFFFFF15] flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-3.5 w-3.5 text-[#666]" />
          <input
            type="text"
            placeholder="Filter catalog by keyword or aesthetic tag..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#181818] border border-[#FFFFFF12] text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-[#E5C392]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3.5 py-2 bg-[#181818] border border-[#FFFFFF12] text-xs text-[#CCC] focus:outline-none focus:border-[#E5C392]"
          >
            <option value="all">All Categories ({sellerProducts.length})</option>
            {PRODUCT_CATEGORIES.map(c => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product List Cards */}
      {filteredProducts.length === 0 ? (
        <div className="p-16 text-center bg-[#121212] border border-[#FFFFFF18]">
          <Package className="h-10 w-10 text-[#444] mx-auto mb-3" />
          <h3 className="font-serif text-lg text-white">No Products Found</h3>
          <p className="text-xs text-[#808080] mt-1 max-w-sm mx-auto font-light">
            {searchQuery ? 'No catalog items match your search.' : 'Add your first product to showcase in your store.'}
          </p>
          <button
            onClick={openAddModal}
            className="mt-5 px-5 py-2.5 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-[0.2em] font-semibold transition cursor-pointer"
          >
            + Add Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map(p => (
            <div
              key={p.id}
              className={`bg-[#141414] border ${
                p.inStock ? 'border-[#FFFFFF15]' : 'border-[#402020] opacity-80'
              } overflow-hidden hover:border-[#E5C392]/50 transition flex flex-col justify-between`}
            >
              <div>
                <div className="relative h-48 w-full overflow-hidden bg-[#1A1A1A]">
                  <img
                    src={p.imageUrl || DEFAULT_PRODUCT_IMAGE}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_PRODUCT_IMAGE;
                    }}
                  />
                  {p.images && p.images.length > 1 && (
                    <span className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-xs text-white text-[9px] font-mono px-2 py-0.5 rounded flex items-center gap-1 border border-white/20">
                      <Camera className="h-3 w-3" />
                      <span>{p.images.length}</span>
                    </span>
                  )}
                  {p.discountPercent > 0 && (
                    <span className="absolute top-2.5 left-2.5 bg-[#E5C392] text-black font-mono font-bold text-[9px] uppercase tracking-wider px-2 py-0.5">
                      {p.discountPercent}% Concession
                    </span>
                  )}
                  <button
                    onClick={() => toggleProductStock(p.id)}
                    className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-wider transition ${
                      p.inStock
                        ? 'bg-[#102816] text-[#86EFAC] border border-[#1E4D2B]'
                        : 'bg-[#281010] text-[#FCA5A5] border border-[#502020]'
                    }`}
                  >
                    {p.inStock ? 'Available' : 'Archived'}
                  </button>
                </div>

                <div className="p-5">
                  <span className="text-[9px] uppercase tracking-[0.25em] font-mono text-[#E5C392]">
                    {p.category}
                  </span>
                  <h3 className="font-serif text-base text-white mt-1 line-clamp-1">
                    {p.name}
                  </h3>
                  <p className="text-xs text-[#8E8E8E] mt-1.5 line-clamp-2 leading-relaxed font-light">
                    {p.description}
                  </p>

                  <div className="mt-4 flex items-baseline gap-2.5">
                    <span className="font-serif text-xl text-white">
                      ₹{p.finalPrice}
                    </span>
                    {p.discountPercent > 0 && (
                      <span className="font-mono text-xs text-[#777] line-through">
                        ₹{p.originalPrice}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-[#808080] pt-3 border-t border-[#FFFFFF0A]">
                    <span>
                      Stock:{' '}
                      <strong className={!p.inStock || p.stockQuantity === 0 ? 'text-[#FF6B6B]' : p.stockQuantity <= (p.lowStockThreshold ?? 5) ? 'text-[#F59E0B]' : 'text-[#CCC]'}>
                        {!p.inStock || p.stockQuantity === 0 ? 'Out of Stock' : `${p.stockQuantity} units`}
                      </strong>
                      {p.inStock && p.stockQuantity > 0 && p.stockQuantity <= (p.lowStockThreshold ?? 5) && (
                        <span className="ml-1 text-[9px] text-[#F59E0B]">(Alert at {p.lowStockThreshold ?? 5})</span>
                      )}
                    </span>
                    <span>⏱ {p.preparationTime || 'Ready'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-5 py-3 bg-[#111111] border-t border-[#FFFFFF0A] flex items-center justify-between gap-2">
                <button
                  onClick={() => openEditModal(p)}
                  className="flex-1 py-1.5 px-3 bg-[#1A1A1A] hover:bg-[#252525] text-[#D0D0D0] border border-[#FFFFFF15] text-[10px] uppercase tracking-wider transition flex items-center justify-center gap-1.5"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>Modify</span>
                </button>
                <button
                  onClick={() => setDeleteConfirmId(p.id)}
                  className="p-1.5 text-[#AAA] hover:text-[#FF6B6B] transition"
                  title="Remove from Catalog"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        subtitle="Specify price, stock, and details for your store catalog"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-xs text-[#F5F5F5]">
          <div>
            <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1">
              Product Title *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Belgian Dark Chocolate Ganache Gateau"
              className="w-full px-3.5 py-2 bg-[#181818] border border-[#FFFFFF15] text-sm text-white focus:outline-none focus:border-[#E5C392]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#181818] border border-[#FFFFFF15] text-xs text-white focus:outline-none focus:border-[#E5C392]"
              >
                {PRODUCT_CATEGORIES.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1">
                Available Stock *
              </label>
              <input
                type="number"
                value={stockQuantity}
                onChange={e => {
                  setStockQuantity(Number(e.target.value));
                  setFormError(null);
                }}
                className="w-full px-3.5 py-2 bg-[#181818] border border-[#FFFFFF15] text-xs text-white focus:outline-none focus:border-[#E5C392]"
                required
                min={0}
                step={1}
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1">
                Low Stock Alert At *
              </label>
              <input
                type="number"
                value={lowStockThreshold}
                onChange={e => {
                  setLowStockThreshold(Number(e.target.value));
                  setFormError(null);
                }}
                className="w-full px-3.5 py-2 bg-[#181818] border border-[#FFFFFF15] text-xs text-white focus:outline-none focus:border-[#E5C392]"
                required
                min={0}
                step={1}
              />
              <p className="text-[9px] text-[#808080] mt-1 font-mono">
                Get a dashboard alert when stock reaches this number.
              </p>
            </div>
          </div>

          {/* Pricing Row */}
          <div className="p-3.5 bg-[#161616] border border-[#FFFFFF12] grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1">
                Regular Price (₹) *
              </label>
              <input
                type="number"
                value={originalPrice}
                onChange={e => setOriginalPrice(Number(e.target.value))}
                className="w-full p-2 bg-[#1C1C1C] border border-[#FFFFFF15] text-xs text-white font-mono"
                required
                min={1}
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1">
                Discount (%)
              </label>
              <input
                type="number"
                value={discountPercent}
                onChange={e => setDiscountPercent(Number(e.target.value))}
                className="w-full p-2 bg-[#1C1C1C] border border-[#FFFFFF15] text-xs text-white font-mono"
                min={0}
                max={90}
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#E5C392] font-mono mb-1">
                Final Bill Rate
              </label>
              <div className="p-2 bg-[#1F1F1F] border border-[#E5C392]/40 text-xs font-serif text-[#E5C392]">
                ₹{finalPrice}
              </div>
            </div>
          </div>

          {/* AI Description Generator Prompt Bar */}
          <div className="p-3 bg-[#161616] border border-[#FFFFFF12] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-[#E5C392] font-mono flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                AI Description Generator
              </span>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={isGeneratingAI || !name.trim()}
                className="px-3 py-1 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[9px] uppercase tracking-wider font-semibold transition flex items-center gap-1 disabled:opacity-40"
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Drafting...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3 w-3" />
                    <span>Generate Description</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1">
              Product Description *
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe ingredients, specifications, materials, notes, or customizations..."
              className="w-full p-3 bg-[#181818] border border-[#FFFFFF15] text-xs text-white focus:outline-none focus:border-[#E5C392]"
              required
            />
          </div>

          {/* Product Photographs Upload Section */}
          <div className="space-y-3 bg-[#141414] border border-[#FFFFFF15] p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[#E5C392] font-mono font-semibold">
                  Primary Product Photograph *
                </label>
                <p className="text-[11px] text-[#888] mt-0.5">
                  Real photo of the product (e.g. freshly baked cake, handcrafted pottery)
                </p>
              </div>
              <span className="text-[10px] text-[#AAA] font-mono">JPG, PNG, WebP</span>
            </div>

            <ImageUploadBox
              id="seller-product-primary-upload"
              label="Upload Product Photograph"
              helperText="High-resolution image under 5 MB"
              currentImageUrl={imageUrl}
              onUpload={async (file, onProgress, cancelRef) => {
                if (!seller) throw new Error('Seller context missing. Please ensure your store profile is active.');
                const targetId = activeProductId || `prod-${Date.now()}`;
                const res = await uploadProductImage(file, seller.id, targetId, false, undefined, onProgress, cancelRef);
                setImageUrl(res.downloadUrl);
                setImages(prev => prev.includes(res.downloadUrl) ? prev : [res.downloadUrl, ...prev]);
                return res.downloadUrl;
              }}
              onRemove={async () => {
                if (imageUrl) {
                  await deleteStorageImage(imageUrl);
                }
                setImageUrl('');
                setImages(prev => prev.filter(img => img !== imageUrl));
              }}
              aspectRatio="square"
              placeholderText="Click or drop real product photo here"
            />

            {/* Additional Angles / Multi-photo Gallery (Requirement 6) */}
            <div className="pt-2 border-t border-[#FFFFFF10] space-y-2">
              {angleUploadError && (
                <div className="p-2 bg-red-950/60 border border-red-800 text-red-300 text-[11px] rounded-lg">
                  {angleUploadError}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider text-[#999] font-mono">
                  Additional Perspectives ({images.filter(img => img !== imageUrl).length})
                </span>
                <label className="text-[9px] uppercase tracking-wider text-[#E5C392] font-mono hover:underline cursor-pointer flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  <span>{isUploadingAngle ? 'Processing...' : 'Add Angle / Detail Photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={isUploadingAngle}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !seller) return;
                      setIsUploadingAngle(true);
                      setAngleUploadError(null);
                      try {
                        const targetId = activeProductId || `prod-${Date.now()}`;
                        const res = await uploadProductImage(file, seller.id, targetId, true);
                        setImages(prev => [...prev, res.downloadUrl]);
                        if (!imageUrl) {
                          setImageUrl(res.downloadUrl);
                        }
                      } catch (err: any) {
                        setAngleUploadError(err.message || 'Error uploading angle photo');
                        setTimeout(() => setAngleUploadError(null), 5000);
                      } finally {
                        setIsUploadingAngle(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>

              {images.filter(img => img !== imageUrl).length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {images
                    .filter(img => img !== imageUrl)
                    .map((angleImg, idx) => (
                      <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-[#FFFFFF20] shrink-0 group">
                        <img
                          src={angleImg}
                          alt={`Angle ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            deleteStorageImage(angleImg).catch(() => {});
                            setImages(prev => prev.filter(img => img !== angleImg));
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-400 hover:text-rose-300 transition"
                          title="Remove this angle"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1">
                Visual Image Direct URL (Alternative)
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-[#181818] border border-[#FFFFFF15] text-xs text-white focus:outline-none focus:border-[#E5C392]"
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1">
                Preparation Time
              </label>
              <input
                type="text"
                value={preparationTime}
                onChange={e => setPreparationTime(e.target.value)}
                placeholder="e.g. 2 hours / 1 day / Ready"
                className="w-full px-3 py-2 bg-[#181818] border border-[#FFFFFF15] text-xs text-white focus:outline-none focus:border-[#E5C392]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1">
              Descriptive Tags (Comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="Eggless, Handcrafted, Celebration"
              className="w-full px-3 py-2 bg-[#181818] border border-[#FFFFFF15] text-xs text-white focus:outline-none focus:border-[#E5C392]"
            />
          </div>

          {formError && (
            <div className="p-3 bg-[#331111] border border-[#EF4444]/50 text-[#FCA5A5] text-xs font-mono rounded">
              ⚠️ {formError}
            </div>
          )}

          <div className="pt-3 border-t border-[#FFFFFF15] flex items-center justify-between">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-[10px] uppercase tracking-wider text-[#888] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2.5 px-5 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-[0.2em] font-semibold transition cursor-pointer"
            >
              {editingProduct ? 'Save Modifications' : 'Publish Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Remove Item from Catalog?"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs text-[#F5F5F5]">
          <p className="text-[#A0A0A0] font-light">
            Are you certain you wish to de-list this piece from public room view?
            <br />
            <strong className="text-white block mt-1 font-mono text-[10px] uppercase tracking-wider">
              Historical ledger snapshots will remain intact.
            </strong>
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#FFFFFF15]">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-3.5 py-1.5 text-[10px] uppercase tracking-wider text-[#888] hover:text-white"
            >
              Retain Piece
            </button>
            <button
              onClick={() => {
                if (deleteConfirmId) {
                  deleteProduct(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              className="px-4 py-1.5 bg-[#FF6B6B] hover:bg-[#FF4D4D] text-black text-[10px] uppercase tracking-wider font-semibold"
            >
              Confirm Removal
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
