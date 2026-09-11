import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { LocationPicker } from '../common/LocationPicker';
import { Modal } from '../common/Modal';
import { LocationInfo } from '../../types';
import {
  Settings,
  RefreshCw,
  ShieldCheck,
  User,
  Store,
  Check,
  AlertTriangle,
  Trash2,
  Loader2,
  MapPin,
  Edit3,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { ImageUploadBox } from '../common/ImageUploadBox';
import {
  uploadUserProfilePhoto,
  uploadStorePhoto,
  deleteStorageImage,
  DEFAULT_AVATAR,
  DEFAULT_STORE_PHOTO
} from '../../services/imageStorageService';

interface SellerSettingsProps {
  onNavigate?: (tab: string, extra?: any) => void;
}

export const SellerSettings: React.FC<SellerSettingsProps> = ({ onNavigate }) => {
  const { currentUser, updateUserProfile, updateUserLocation } = useAuth();
  const {
    getSellerByUserId,
    resetToDemoData,
    deleteSellerStore,
    updateSellerProfile,
  } = useStore();

  const seller = currentUser ? getSellerByUserId(currentUser.id) : undefined;
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isEditingLocation, setIsEditingLocation] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfile({ fullName, phone });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLocationConfirmed = async (newLocation: LocationInfo) => {
    await updateUserLocation(newLocation);
    if (seller) {
      await updateSellerProfile({
        id: seller.id,
        location: newLocation,
      });
    }
    setIsEditingLocation(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleDeleteStore = async () => {
    if (!seller) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteSellerStore(seller.id);
      await updateUserProfile({ role: 'BUYER' });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      if (onNavigate) {
        onNavigate('buyer-home');
      }
    } catch (err: any) {
      console.error('Failed to delete store:', err);
      setDeleteError(err.message || 'Failed to remove storefront. Please try again.');
      setIsDeleting(false);
    }
  };

  const currentLocation = seller?.location || currentUser?.location;

  return (
    <div className="max-w-3xl space-y-6 text-stone-900">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
          Store Settings & Location
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Manage your business location, store details, and seller account.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Settings and store location updated successfully.</span>
        </div>
      )}

      {resetSuccess && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Demo state reset to initial catalog.</span>
        </div>
      )}

      {/* Seller Profile Photo / DP Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Camera className="h-4 w-4 text-emerald-700" />
            <span>Seller Personal Profile Photo (DP)</span>
          </h3>
          <span className="text-[11px] text-stone-500 font-normal">Identifies you in conversations & seller badge</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-stone-200 bg-stone-100 shadow-sm flex items-center justify-center">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.fullName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-emerald-100/70 text-emerald-800 text-2xl font-bold font-serif">
                  {currentUser?.fullName?.charAt(0).toUpperCase() || 'S'}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 w-full max-w-md">
            <ImageUploadBox
              id="seller-avatar-upload"
              label="Upload or Replace Profile Photo"
              helperText="JPG, PNG or WebP under 5 MB"
              currentImageUrl={currentUser?.avatarUrl}
              onUpload={async (file, onProgress, cancelRef) => {
                const res = await uploadUserProfilePhoto(file, onProgress, cancelRef);
                await updateUserProfile({ avatarUrl: res.downloadUrl });
                return res.downloadUrl;
              }}
              onRemove={async () => {
                if (currentUser?.avatarUrl) {
                  await deleteStorageImage(currentUser.avatarUrl);
                }
                await updateUserProfile({ avatarUrl: '' });
              }}
              placeholderText="Upload Seller Photo"
            />
          </div>
        </div>
      </div>

      {/* Seller Store Photo Card */}
      {seller && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                <Store className="h-4 w-4 text-emerald-700" />
                <span>Store / Business Photograph</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                A real photograph of your bakery, workshop, boutique, or physical store.
              </p>
            </div>
            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-medium">
              Public Storefront
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative shrink-0">
              <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-stone-200 bg-stone-100 shadow-sm flex items-center justify-center">
                {(seller.storePhotoUrl || seller.logoUrl) ? (
                  <img
                    src={seller.storePhotoUrl || seller.logoUrl}
                    alt={seller.businessName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_STORE_PHOTO;
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-stone-100 text-stone-400 p-2 text-center">
                    <Store className="h-8 w-8 mb-1" />
                    <span className="text-[10px]">No Photo</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 w-full max-w-md">
              <ImageUploadBox
                id="seller-store-photo-upload"
                label="Storefront Photo"
                helperText="Appears on Business Room, Discovery & Search"
                currentImageUrl={seller.storePhotoUrl || seller.logoUrl}
                onUpload={async (file, onProgress, cancelRef) => {
                  const res = await uploadStorePhoto(file, seller.id, onProgress, cancelRef);
                  await updateSellerProfile({
                    id: seller.id,
                    storePhotoUrl: res.downloadUrl,
                    logoUrl: res.downloadUrl,
                  });
                  return res.downloadUrl;
                }}
                onRemove={async () => {
                  const oldPhoto = seller.storePhotoUrl || seller.logoUrl;
                  if (oldPhoto) {
                    await deleteStorageImage(oldPhoto);
                  }
                  await updateSellerProfile({
                    id: seller.id,
                    storePhotoUrl: '',
                    logoUrl: '',
                  });
                }}
                placeholderText="Upload Store Photo"
              />
            </div>
          </div>
        </div>
      )}

      {/* Account Info */}
      <form onSubmit={handleSaveProfile} className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-700" />
            <span>Seller Account Info</span>
          </h3>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Verified Seller</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Phone Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1.5">
            Verified Google Email
          </label>
          <input
            type="email"
            value={currentUser?.email || ''}
            disabled
            className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 text-xs text-stone-500 rounded-xl cursor-not-allowed"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-xl transition cursor-pointer shadow-xs active:scale-[0.99]"
          >
            Save Account Details
          </button>
        </div>
      </form>

      {/* Store Location with Google Maps */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-700" />
              <span>Business & Storefront Location</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              This location is used so neighborhood customers nearby can discover your store.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingLocation(true)}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Change Location</span>
          </button>
        </div>

        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
          <div className="flex items-start gap-2.5">
            <Store className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-stone-900">
                {seller?.businessName || 'Your Store'}
              </p>
              <p className="text-xs text-stone-700 mt-0.5">
                {currentLocation?.address || 'No street address set yet'}
              </p>
              <p className="text-xs text-stone-600 mt-0.5">
                {[
                  currentLocation?.area,
                  currentLocation?.city,
                  currentLocation?.state,
                  currentLocation?.pincode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {currentLocation?.coordinates && (
                <p className="text-[11px] text-stone-500 font-mono mt-1">
                  GPS: {currentLocation.coordinates.lat.toFixed(4)}, {currentLocation.coordinates.lng.toFixed(4)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for editing store location */}
      <Modal
        isOpen={isEditingLocation}
        onClose={() => setIsEditingLocation(false)}
        title="Edit Storefront Location"
        subtitle="Search your store address or pinpoint on the interactive map"
        maxWidth="2xl"
      >
        <LocationPicker
          initialLocation={currentLocation}
          onLocationSelect={() => {}}
          onConfirm={handleLocationConfirmed}
          confirmButtonText="Save this Store Location"
        />
      </Modal>

      {/* Danger Zone: Delete Store */}
      {seller && (
        <div className="bg-red-50/50 border border-red-200 rounded-2xl p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between border-b border-red-100 pb-3">
            <h3 className="text-sm font-semibold text-red-900 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-600" />
              <span>Delete Store</span>
            </h3>
            <span className="text-[11px] text-red-700 font-medium px-2 py-0.5 bg-red-100 rounded-md">
              Irreversible
            </span>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            Permanently delete <strong className="text-stone-900 font-semibold">{seller.businessName}</strong> and all listed products. Your account will revert to a standard customer account.
          </p>

          {deleteError && (
            <div className="p-3 bg-red-100 text-red-800 text-xs rounded-xl">
              {deleteError}
            </div>
          )}

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Store</span>
            </button>
          ) : (
            <div className="p-5 bg-white border border-red-300 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-start gap-2.5 text-red-700 text-xs font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-stone-900">Are you sure you want to permanently delete your store?</p>
                  <p className="text-xs text-stone-500 font-normal mt-0.5">
                    This will remove your store profile, all products, and cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteStore}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-xl transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Deleting Store...</span>
                    </>
                  ) : (
                    <span>Delete Store</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
