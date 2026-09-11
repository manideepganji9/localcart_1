import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { LocationPicker } from '../common/LocationPicker';
import { Modal } from '../common/Modal';
import { LocationInfo } from '../../types';
import { User, MapPin, Phone, Mail, Save, Check, ShoppingBag, ShieldCheck, Edit3, Camera } from 'lucide-react';
import { ImageUploadBox } from '../common/ImageUploadBox';
import { uploadUserProfilePhoto, deleteStorageImage } from '../../services/imageStorageService';

interface BuyerAccountProps {
  onNavigate: (tab: string, extra?: any) => void;
}

export const BuyerAccount: React.FC<BuyerAccountProps> = ({ onNavigate }) => {
  const { currentUser, updateUserProfile, updateUserLocation } = useAuth();
  const { orders, customerLocation, updateCustomerLocation } = useStore();

  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);

  const buyerOrders = currentUser ? orders.filter(o => o.buyerId === currentUser.id) : [];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfile({
      fullName,
      phone,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLocationConfirmed = async (newLocation: LocationInfo) => {
    await updateCustomerLocation(newLocation);
    await updateUserProfile({
      savedAddress: newLocation.address,
    });
    setIsEditingLocation(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const currentLocation = customerLocation || currentUser?.location;

  return (
    <div className="max-w-3xl space-y-6 text-stone-900">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
          My Account & Delivery Address
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Manage your personal profile, Google verified account, profile photo, and delivery location.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Profile and delivery address updated successfully.</span>
        </div>
      )}

      {/* Buyer Profile Photo / DP Section */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <Camera className="h-4 w-4 text-amber-600" />
            <span>Profile Photo / Display Picture</span>
          </h3>
          <span className="text-[11px] text-stone-500 font-normal">Visible on orders & chat</span>
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
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-amber-100/60 text-amber-800 text-2xl font-bold font-serif">
                  {currentUser?.fullName?.charAt(0).toUpperCase() || 'B'}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 w-full max-w-md">
            <ImageUploadBox
              id="buyer-avatar-upload"
              label="Choose or Replace Profile Photo"
              helperText="JPEG, PNG or WebP under 5 MB"
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
              placeholderText="Upload Profile Photo"
            />
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <User className="h-4 w-4 text-amber-600" />
            <span>Personal Information</span>
          </h3>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Google Account</span>
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
              className="w-full px-3.5 py-2.5 bg-white border border-stone-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 rounded-xl text-xs text-stone-900 focus:outline-none"
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
              className="w-full px-3.5 py-2.5 bg-white border border-stone-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-600 rounded-xl text-xs text-stone-900 focus:outline-none"
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

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Contact Info</span>
          </button>
        </div>
      </form>

      {/* Delivery Address Card with Real Google Maps Location Picker */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-600" />
              <span>Delivery Address & Location</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Used to calculate proximity to local shops and deliver orders.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingLocation(true)}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Change Location</span>
          </button>
        </div>

        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
          <div className="flex items-start gap-2.5">
            <MapPin className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-stone-900">
                {currentLocation?.address || currentUser?.savedAddress || 'No detailed address set yet'}
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

      {/* Modal for editing location */}
      <Modal
        isOpen={isEditingLocation}
        onClose={() => setIsEditingLocation(false)}
        title="Edit Delivery Address"
        subtitle="Search your address, move the pin on the interactive map, or use GPS location"
        maxWidth="2xl"
      >
        <LocationPicker
          initialLocation={currentLocation}
          onLocationSelect={() => {}}
          onConfirm={handleLocationConfirmed}
          confirmButtonText="Save this Delivery Address"
        />
      </Modal>

      {/* Orders Summary Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-amber-600" />
            <span>Orders Overview</span>
          </h3>
          <span className="text-xs font-medium text-stone-500">
            Total Orders: {buyerOrders.length}
          </span>
        </div>

        <button
          onClick={() => onNavigate('buyer-orders')}
          className="w-full py-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-stone-800 text-xs font-medium transition cursor-pointer"
        >
          View All My Orders →
        </button>
      </div>
    </div>
  );
};
