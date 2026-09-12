import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LocationPicker } from '../common/LocationPicker';
import { LocationInfo, UserRole } from '../../types';
import { APP_CONFIG } from '../../constants/config';
import {
  ArrowRight,
  User as UserIcon,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ShoppingBag,
  Store,
} from 'lucide-react';

interface RoleSelectionScreenProps {
  onRoleSelected?: (role: 'SELLER' | 'BUYER') => void;
  onSelectRole?: (role: 'SELLER' | 'BUYER') => void;
}

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  onRoleSelected,
  onSelectRole,
}) => {
  const { currentUser, completeOnboarding } = useAuth();

  // Start on Step 1 to ensure Name, Phone, and Location are verified
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [location, setLocation] = useState<LocationInfo>(() => {
    return currentUser?.location || {
      city: APP_CONFIG.defaultLocation.city,
      state: APP_CONFIG.defaultLocation.state,
      pincode: APP_CONFIG.defaultLocation.pincode,
      area: APP_CONFIG.defaultLocation.area,
      address: '',
      coordinates: { lat: 17.4156, lng: 78.4350 },
    };
  });

  // Update initial fields when currentUser loads from Firebase
  React.useEffect(() => {
    if (currentUser?.fullName && !name) {
      setName(currentUser.fullName);
    }
    if (currentUser?.phone && !phone) {
      setPhone(currentUser.phone);
    }
    if (currentUser?.location?.city && !location.city) {
      setLocation(currentUser.location);
    }
  }, [currentUser]);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const validatePhone = (val: string): boolean => {
    if (!val.trim()) return true; // Optional on initial quick onboarding
    const cleaned = val.replace(/[\s\-\(\)\+]/g, '');
    return /^\d{10,13}$/.test(cleaned);
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (phone.trim() && !validatePhone(phone)) {
      setPhoneError('Please enter a valid 10-digit mobile number (e.g. 9876543210).');
      return;
    }

    setStep(2);
  };

  const handleSelectRole = async (selectedRole: 'SELLER' | 'BUYER') => {
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const cleanName = name.trim() || currentUser?.fullName || 'Customer';
      const cleanPhone = phone.trim() || currentUser?.phone || '';

      await completeOnboarding({
        fullName: cleanName,
        phoneNumber: cleanPhone,
        location,
        role: selectedRole,
      });

      setIsSaving(false);
      if (onRoleSelected) onRoleSelected(selectedRole);
      if (onSelectRole) onSelectRole(selectedRole);
    } catch (err: any) {
      console.error('Error during onboarding completion:', err);
      setErrorMsg(err?.message || 'Unable to finish setting up your account. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 text-stone-900">
      <div className="max-w-3xl w-full bg-white border border-stone-200 rounded-3xl shadow-xl p-6 sm:p-10">
        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="space-y-6">
            {/* Step 1 Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-full text-xs font-medium">
                <span>Step 1 of 2</span>
                <span>•</span>
                <span>Profile & Location</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                Complete Your Profile
              </h1>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                Enter your contact info and pinpoint your location for delivery and orders.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => {
                      setPhone(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="e.g. 9876543210"
                    required
                    className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-xs text-stone-900 focus:outline-none ${
                      phoneError
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-stone-300 focus:border-amber-600 focus:ring-1 focus:ring-amber-600'
                    }`}
                  />
                </div>
                {phoneError && (
                  <span className="text-[11px] text-red-600 mt-1 block">
                    {phoneError}
                  </span>
                )}
              </div>
            </div>

            {/* Location Picker */}
            <div className="pt-2 border-t border-stone-100">
              <label className="block text-xs font-semibold text-stone-900 mb-2">
                Your Delivery / Store Location on Interactive Map *
              </label>
              <LocationPicker
                initialLocation={location}
                onLocationSelect={loc => setLocation(loc)}
              />
            </div>

            {/* Submit Step 1 */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 px-6 bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
              >
                <span>Continue to Role Selection</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Step 2 Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-full text-xs font-medium">
                <span>Step 2 of 2</span>
                <span>•</span>
                <span>Choose Role</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                How will you use LocalCart?
              </h1>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                Welcome, <span className="text-stone-900 font-semibold">{name}</span>! Select your account type to proceed.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Two Large Role Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6 text-left">
              {/* Buyer Option */}
              <div
                onClick={() => !isSaving && handleSelectRole('BUYER')}
                className="group relative cursor-pointer border-2 border-stone-200 hover:border-amber-500 bg-white hover:bg-amber-50/30 rounded-2xl p-6 transition-all flex flex-col justify-between shadow-xs hover:shadow-md"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl mb-4 group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 group-hover:text-amber-800">
                    I want to Buy
                  </h3>
                  <span className="text-xs text-stone-500 block mb-3 mt-0.5">
                    Customer Account
                  </span>
                  <p className="text-xs text-stone-600 leading-relaxed mb-4">
                    Discover products from neighborhood businesses, home bakers, and local stores, and buy directly.
                  </p>

                  <ul className="space-y-2 text-xs text-stone-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Browse local shops and unique products</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Direct order placement with transparent bills</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Pay directly via UPI or Cash on Delivery</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-amber-800">
                  <span>Enter as Buyer</span>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                  )}
                </div>
              </div>

              {/* Seller Option */}
              <div
                onClick={() => !isSaving && handleSelectRole('SELLER')}
                className="group relative cursor-pointer border-2 border-stone-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/30 rounded-2xl p-6 transition-all flex flex-col justify-between shadow-xs hover:shadow-md"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl mb-4 group-hover:scale-105 transition-transform">
                    <Store className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 group-hover:text-emerald-800">
                    I want to Sell
                  </h3>
                  <span className="text-xs text-stone-500 block mb-3 mt-0.5">
                    Store & Business Account
                  </span>
                  <p className="text-xs text-stone-600 leading-relaxed mb-4">
                    Create a public store, showcase your inventory, manage stock, and receive orders directly.
                  </p>

                  <ul className="space-y-2 text-xs text-stone-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Create and customize your store profile</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Manage inventory with automatic stock locking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Zero marketplace commission on direct orders</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-xs font-semibold text-emerald-800">
                  <span>Open Store</span>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                  )}
                </div>
              </div>
            </div>

            {/* Options footer */}
            <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 transition font-medium cursor-pointer"
              >
                <span>Edit name, phone or delivery address (optional)</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Google-verified account</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
