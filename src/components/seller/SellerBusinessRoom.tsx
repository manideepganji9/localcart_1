import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { PRODUCT_CATEGORIES, POPULAR_CITIES } from '../../constants/config';
import {
  Store,
  MapPin,
  Clock,
  Truck,
  ExternalLink,
  Save,
  CheckCircle2,
  Image,
  Phone,
  Mail,
  Sparkles,
  Info,
  Camera,
} from 'lucide-react';
import { ImageUploadBox } from '../common/ImageUploadBox';
import {
  uploadStorePhoto,
  uploadStoreBanner,
  deleteStorageImage,
  DEFAULT_STORE_PHOTO,
} from '../../services/imageStorageService';

interface SellerBusinessRoomProps {
  onNavigate: (tab: string, extra?: any) => void;
}

export const SellerBusinessRoom: React.FC<SellerBusinessRoomProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { getSellerByUserId, updateSellerProfile } = useStore();

  const seller = currentUser ? getSellerByUserId(currentUser.id) : undefined;

  const [businessName, setBusinessName] = useState(seller?.businessName || '');
  const [tagline, setTagline] = useState(seller?.tagline || '');
  const [businessCategory, setBusinessCategory] = useState(seller?.businessCategory || 'Bakery & Desserts');
  const [businessDescription, setBusinessDescription] = useState(seller?.businessDescription || '');
  const [bannerUrl, setBannerUrl] = useState(seller?.bannerUrl || '');
  const [storePhotoUrl, setStorePhotoUrl] = useState(seller?.storePhotoUrl || seller?.logoUrl || '');
  const [logoUrl, setLogoUrl] = useState(seller?.logoUrl || seller?.storePhotoUrl || '');
  const [openingHours, setOpeningHours] = useState(seller?.openingHours || '10:00 AM - 9:00 PM (Daily)');
  const [contactPhone, setContactPhone] = useState(seller?.contactPhone || '');
  const [contactEmail, setContactEmail] = useState(seller?.contactEmail || '');
  const [city, setCity] = useState(seller?.location?.city || 'Hyderabad');
  const [area, setArea] = useState(seller?.location?.area || 'Banjara Hills');
  const [address, setAddress] = useState(seller?.location?.address || '');
  const [serviceRadiusKm, setServiceRadiusKm] = useState(seller?.serviceRadiusKm || 15);

  const [sellerDelivery, setSellerDelivery] = useState(seller?.deliveryOptions?.sellerDelivery ?? true);
  const [thirdParty, setThirdParty] = useState(seller?.deliveryOptions?.thirdParty ?? true);
  const [buyerPickup, setBuyerPickup] = useState(seller?.deliveryOptions?.buyerPickup ?? true);
  const [baseDeliveryFee, setBaseDeliveryFee] = useState(seller?.deliveryOptions?.baseDeliveryFee || 50);
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState(seller?.deliveryOptions?.freeDeliveryAbove || 1500);

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (seller) {
      setBusinessName(seller.businessName || '');
      setTagline(seller.tagline || '');
      setBusinessCategory(seller.businessCategory || 'Bakery & Desserts');
      setBusinessDescription(seller.businessDescription || '');
      setBannerUrl(seller.bannerUrl || '');
      setStorePhotoUrl(seller.storePhotoUrl || seller.logoUrl || '');
      setLogoUrl(seller.logoUrl || seller.storePhotoUrl || '');
      setOpeningHours(seller.openingHours || '10:00 AM - 9:00 PM (Daily)');
      setContactPhone(seller.contactPhone || '');
      setContactEmail(seller.contactEmail || '');
      if (seller.location?.city) setCity(seller.location.city);
      if (seller.location?.area) setArea(seller.location.area);
      if (seller.location?.address) setAddress(seller.location.address);
      if (seller.serviceRadiusKm) setServiceRadiusKm(seller.serviceRadiusKm);
    }
  }, [seller?.id, seller?.storePhotoUrl, seller?.logoUrl, seller?.bannerUrl, seller?.businessName]);

  if (!seller) {
    return (
      <div className="p-12 text-center bg-[#141414] border border-[#FFFFFF18] text-[#F5F5F5]">
        <p className="text-xs text-[#888]">No store profile active.</p>
      </div>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSellerProfile({
      id: seller.id,
      businessName,
      tagline,
      businessCategory,
      businessDescription,
      bannerUrl: bannerUrl || seller.bannerUrl,
      storePhotoUrl: storePhotoUrl || logoUrl || seller.storePhotoUrl || seller.logoUrl,
      logoUrl: logoUrl || storePhotoUrl || seller.logoUrl || seller.storePhotoUrl,
      openingHours,
      contactPhone,
      contactEmail,
      serviceRadiusKm,
      location: {
        ...seller.location,
        city,
        area,
        address
      },
      deliveryOptions: {
        sellerDelivery,
        thirdParty,
        buyerPickup,
        baseDeliveryFee: Number(baseDeliveryFee),
        freeDeliveryAbove: Number(freeDeliveryAbove)
      }
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 text-[#F5F5F5]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FFFFFF12] pb-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#E5C392] font-mono">Storefront Configurator</span>
          <h1 className="font-serif text-3xl sm:text-4xl text-white tracking-tight">
            Business Room Architecture
          </h1>
          <p className="text-xs text-[#8E8E8E] mt-1 font-light">
            Configure how your digital storefront and store profile appear to customers across your city.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('business-room-view', { sellerId: seller.id })}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#161616] hover:bg-[#202020] text-[#E5C392] border border-[#FFFFFF18] text-[10px] uppercase tracking-[0.2em] font-medium transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Launch Public Room URL</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-[#102816] border border-[#1E4D2B] text-[#86EFAC] text-xs flex items-center gap-2 font-mono">
          <CheckCircle2 className="h-4 w-4 text-[#86EFAC] shrink-0" />
          <span>Seller storefront configurations published to local market.</span>
        </div>
      )}

      {/* Live Storefront Preview Header Card */}
      <div className="border border-[#FFFFFF18] bg-[#121212] overflow-hidden">
        <div className="relative h-48 w-full bg-[#181818]">
          <img
            src={bannerUrl || seller.bannerUrl}
            alt="Banner preview"
            className="w-full h-full object-cover grayscale contrast-115"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C0C0C] via-[#0C0C0C]/50 to-transparent"></div>
          
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
            <div className="flex items-center gap-4">
              <img
                src={storePhotoUrl || seller.storePhotoUrl || logoUrl || seller.logoUrl || DEFAULT_STORE_PHOTO}
                alt="Logo preview"
                className="w-16 h-16 object-cover border border-[#FFFFFF30] bg-[#161616]"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_STORE_PHOTO;
                }}
              />
              <div className="text-white">
                <span className="text-[9px] uppercase tracking-[0.25em] font-mono text-[#E5C392]">
                  {businessCategory}
                </span>
                <h2 className="font-serif text-2xl text-white mt-0.5">{businessName || 'Seller Store Name'}</h2>
                <p className="text-xs text-[#AAA] font-light italic">{tagline || 'Store tagline...'}</p>
              </div>
            </div>

            <div className="hidden sm:block text-right text-[10px] uppercase tracking-wider text-[#999] font-mono">
              <span className="bg-[#181818] border border-[#FFFFFF15] px-3 py-1.5">
                📍 {area}, {city}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Storefront Details */}
        <div className="bg-[#121212] border border-[#FFFFFF18] p-6 space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-[#E5C392] font-mono flex items-center gap-2 border-b border-[#FFFFFF10] pb-3">
            <Store className="h-3.5 w-3.5" />
            <span>Storefront Profile & Identity</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1.5">
                Business Room Legal / Public Name *
              </label>
              <input
                type="text"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#181818] border border-[#FFFFFF15] text-sm text-white focus:outline-none focus:border-[#E5C392]"
                required
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1.5">
                Seller Category / Primary Specialty
              </label>
              <select
                value={businessCategory}
                onChange={e => setBusinessCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#181818] border border-[#FFFFFF15] text-xs text-white focus:outline-none focus:border-[#E5C392]"
              >
                {PRODUCT_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1.5">
              Curatorial Tagline (One-sentence premise)
            </label>
            <input
              type="text"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#181818] border border-[#FFFFFF15] text-xs text-white focus:outline-none focus:border-[#E5C392]"
            />
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1.5">
              Seller Story & Description (Philosophy, Sourcing, Heritage)
            </label>
            <textarea
              rows={3}
              value={businessDescription}
              onChange={e => setBusinessDescription(e.target.value)}
              className="w-full p-3 bg-[#181818] border border-[#FFFFFF15] text-xs text-white focus:outline-none focus:border-[#E5C392]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div>
              <ImageUploadBox
                id="business-room-store-photo"
                label="Storefront / Business Photograph"
                helperText="Main business photo appearing in your Public Business Room, Search & Discovery"
                currentImageUrl={storePhotoUrl || seller.storePhotoUrl || logoUrl || seller.logoUrl}
                onUpload={async (file, onProgress, cancelRef) => {
                  const res = await uploadStorePhoto(file, seller.id, onProgress, cancelRef);
                  setStorePhotoUrl(res.downloadUrl);
                  setLogoUrl(res.downloadUrl);
                  await updateSellerProfile({
                    id: seller.id,
                    storePhotoUrl: res.downloadUrl,
                    logoUrl: res.downloadUrl,
                  });
                  return res.downloadUrl;
                }}
                onRemove={async () => {
                  const toDelete = storePhotoUrl || seller.storePhotoUrl || logoUrl || seller.logoUrl;
                  if (toDelete) {
                    await deleteStorageImage(toDelete);
                  }
                  setStorePhotoUrl('');
                  setLogoUrl('');
                  await updateSellerProfile({
                    id: seller.id,
                    storePhotoUrl: '',
                    logoUrl: '',
                  });
                }}
                aspectRatio="square"
                placeholderText="Upload Store Photo"
              />
            </div>

            <div>
              <ImageUploadBox
                id="business-room-banner-photo"
                label="Hero Banner Photograph"
                helperText="Atmospheric cover image (16:9 or panoramic)"
                currentImageUrl={bannerUrl || seller.bannerUrl}
                onUpload={async (file, onProgress, cancelRef) => {
                  const res = await uploadStoreBanner(file, seller.id, onProgress, cancelRef);
                  setBannerUrl(res.downloadUrl);
                  await updateSellerProfile({
                    id: seller.id,
                    bannerUrl: res.downloadUrl,
                  });
                  return res.downloadUrl;
                }}
                onRemove={async () => {
                  if (bannerUrl) {
                    await deleteStorageImage(bannerUrl);
                  }
                  setBannerUrl('');
                  await updateSellerProfile({
                    id: seller.id,
                    bannerUrl: '',
                  });
                }}
                aspectRatio="video"
                placeholderText="Upload Store Banner"
              />
            </div>
          </div>
        </div>

        {/* Operating Hours & Contact */}
        <div className="bg-[#121212] border border-[#FFFFFF18] p-6 space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-[#E5C392] font-mono flex items-center gap-2 border-b border-[#FFFFFF10] pb-3">
            <Clock className="h-3.5 w-3.5" />
            <span>Studio Hours & Dispatch Coordinates</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1.5">
                Active Hours
              </label>
              <input
                type="text"
                value={openingHours}
                onChange={e => setOpeningHours(e.target.value)}
                placeholder="e.g. 10:00 AM - 9:00 PM"
                className="w-full px-3.5 py-2.5 bg-[#181818] border border-[#FFFFFF15] text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1.5">
                Contact Phone
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#181818] border border-[#FFFFFF15] text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1.5">
                Studio Communication Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#181818] border border-[#FFFFFF15] text-xs text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Delivery & Fulfillment Policies */}
        <div className="bg-[#121212] border border-[#FFFFFF18] p-6 space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-[#E5C392] font-mono flex items-center gap-2 border-b border-[#FFFFFF10] pb-3">
            <Truck className="h-3.5 w-3.5" />
            <span>Fulfillment Channels & Delivery Schedules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="p-3 bg-[#181818] border border-[#FFFFFF15] flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={sellerDelivery}
                onChange={e => setSellerDelivery(e.target.checked)}
                className="accent-[#E5C392]"
              />
              <span className="font-mono text-[11px] text-[#CCC]">Seller Direct Delivery</span>
            </label>

            <label className="p-3 bg-[#181818] border border-[#FFFFFF15] flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={thirdParty}
                onChange={e => setThirdParty(e.target.checked)}
                className="accent-[#E5C392]"
              />
              <span className="font-mono text-[11px] text-[#CCC]">Porter / Third-Party</span>
            </label>

            <label className="p-3 bg-[#181818] border border-[#FFFFFF15] flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={buyerPickup}
                onChange={e => setBuyerPickup(e.target.checked)}
                className="accent-[#E5C392]"
              />
              <span className="font-mono text-[11px] text-[#CCC]">Patron Studio Pickup</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1.5">
                Standard Dispatch Fee (₹)
              </label>
              <input
                type="number"
                value={baseDeliveryFee}
                onChange={e => setBaseDeliveryFee(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#181818] border border-[#FFFFFF15] text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1.5">
                Complimentary Delivery Threshold (₹)
              </label>
              <input
                type="number"
                value={freeDeliveryAbove}
                onChange={e => setFreeDeliveryAbove(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#181818] border border-[#FFFFFF15] text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-[#808080] font-mono mb-1.5">
                Coverage Perimeter
              </label>
              <select
                value={serviceRadiusKm}
                onChange={e => setServiceRadiusKm(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#181818] border border-[#FFFFFF15] text-xs text-white focus:outline-none focus:border-[#E5C392]"
              >
                <option value={5}>Within 5 km radius</option>
                <option value={10}>Within 10 km radius</option>
                <option value={15}>Within 15 km radius</option>
                <option value={25}>Within 25 km radius</option>
                <option value={50}>Metropolitan Wide (50 km)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            className="py-3 px-8 bg-[#F5F5F5] hover:bg-[#E5C392] text-black text-[10px] uppercase tracking-[0.2em] font-semibold transition flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            <span>Publish Storefront Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
