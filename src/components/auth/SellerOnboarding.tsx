import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { extractSellerOnboardingInfo } from '../../services/geminiService';
import { LocationPicker } from '../common/LocationPicker';
import { PRODUCT_CATEGORIES, BUSINESS_TYPES, APP_CONFIG } from '../../constants/config';
import { LocationInfo } from '../../types';
import { DEFAULT_STORE_PHOTO, DEFAULT_STORE_BANNER } from '../../services/imageStorageService';
import {
  Sparkles,
  Store,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Wand2,
  Loader2,
  Info,
  Building,
  Check,
} from 'lucide-react';

interface SellerOnboardingProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export const SellerOnboarding: React.FC<SellerOnboardingProps> = ({ onComplete }) => {
  const { currentUser, updateUserLocation } = useAuth();
  const { createSellerProfile } = useStore();

  // Step 1: Freeform input
  const [productsText, setProductsText] = useState('I make homemade chocolate cakes, red velvet cupcakes, and fudgy brownies');
  const [businessTypeText, setBusinessTypeText] = useState('Home Bakery / Cloud Kitchen');
  const [isExtracting, setIsExtracting] = useState(false);
  const [aiExtracted, setAiExtracted] = useState(false);

  // Step 2: Structured business fields
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('Bakery & Desserts');
  const [tagline, setTagline] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [serviceRadiusKm, setServiceRadiusKm] = useState(15);
  const [contactPhone, setContactPhone] = useState(currentUser?.phone || '+91 98765 43210');
  const [deliveryModes, setDeliveryModes] = useState({
    sellerDelivery: true,
    thirdParty: true,
    buyerPickup: true,
    baseDeliveryFee: 50,
  });

  // Store Location State
  const [location, setLocation] = useState<LocationInfo>(() => {
    return (
      currentUser?.location || {
        city: 'Bengaluru',
        state: 'Karnataka',
        area: 'Indiranagar',
        pincode: '560038',
        address: '12th Main Road, Indiranagar',
        coordinates: { lat: 12.9784, lng: 77.6408 },
      }
    );
  });

  const [step, setStep] = useState<1 | 2>(1);

  // AI Extraction handler
  const handleAIExtract = async () => {
    if (!productsText.trim()) return;
    setIsExtracting(true);
    try {
      const extracted = await extractSellerOnboardingInfo(productsText, businessTypeText);
      if (!businessName) {
        setBusinessName(extracted.businessNameSuggestion || `${currentUser?.fullName?.split(' ')[0]}'s Store`);
      }
      if (extracted.businessCategory) {
        setBusinessCategory(extracted.businessCategory);
      } else if (productsText) {
        setBusinessCategory(productsText.slice(0, 50));
      }
      setTagline(extracted.tagline || 'Fresh quality goods for neighborhood celebrations');
      setBusinessDescription(extracted.businessDescription || productsText);
      setAiExtracted(true);
      setStep(2);
    } catch (e) {
      console.warn('Extraction fallback:', e);
      setStep(2);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleManualNext = () => {
    if (!businessName) {
      setBusinessName(`${currentUser?.fullName?.split(' ')[0] || 'My'}'s Store`);
    }
    if (!tagline) {
      setTagline('Quality products for local customers');
    }
    if (!businessDescription) {
      setBusinessDescription(productsText || 'Local store serving quality goods.');
    }
    if (!businessCategory) {
      setBusinessCategory(productsText ? productsText.slice(0, 50) : 'Homemade Cakes & Desserts');
    }
    setStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const slug = (businessName || 'my-store')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    // Save location to user document too
    updateUserLocation(location);

    createSellerProfile({
      userId: currentUser.id,
      businessName: businessName || `${currentUser.fullName}'s Store`,
      businessSlug: `${slug}-${Date.now().toString().slice(-4)}`,
      businessCategory: businessCategory || 'Homemade Cakes & Desserts',
      whatYouSell: businessCategory || 'Homemade Cakes & Desserts',
      businessDescription: businessDescription || productsText,
      tagline: tagline || 'Quality products for local customers',
      location,
      serviceRadiusKm,
      bannerUrl: DEFAULT_STORE_BANNER,
      storePhotoUrl: DEFAULT_STORE_PHOTO,
      logoUrl: DEFAULT_STORE_PHOTO,
      openingHours: '10:00 AM - 8:30 PM (Daily)',
      deliveryOptions: {
        sellerDelivery: deliveryModes.sellerDelivery,
        thirdParty: deliveryModes.thirdParty,
        buyerPickup: deliveryModes.buyerPickup,
        baseDeliveryFee: deliveryModes.baseDeliveryFee,
        freeDeliveryAbove: 1500,
        estimatedTime: '2 - 4 hours',
      },
      contactPhone: contactPhone || currentUser.phone || '',
      contactEmail: currentUser.email,
      tags: ['Local Store', 'Verified', (businessCategory || '').toLowerCase()],
    });

    onComplete();
  };

  return (
    <div className="min-h-[85vh] py-8 px-4 sm:px-6 flex items-center justify-center bg-stone-50 text-stone-900">
      <div className="max-w-3xl w-full bg-white border border-stone-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
        {/* Progress Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Seller Registration
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
                {step === 1 ? 'Describe Your Business' : 'Storefront Details & Map Location'}
              </h1>
            </div>
          </div>
          <div className="text-xs font-semibold px-3 py-1.5 bg-stone-100 text-stone-700 rounded-full border border-stone-200">
            Step {step} of 2
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-5 text-xs sm:text-sm">
            <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-start gap-3 text-emerald-950">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" />
              <div className="text-xs leading-relaxed">
                <span className="font-semibold text-emerald-900">AI Assistance:</span> Describe your products in everyday language. LocalCart AI will organize your store category, name suggestion, and narrative automatically.
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                What do you make or sell?
              </label>
              <textarea
                rows={3}
                value={productsText}
                onChange={e => setProductsText(e.target.value)}
                placeholder="Example: I make fresh sourdough bread, croissants, chocolate cupcakes, and fruit tarts..."
                className="w-full p-3.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Business Type / Model
              </label>
              <select
                value={businessTypeText}
                onChange={e => setBusinessTypeText(e.target.value)}
                className="w-full p-3 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-emerald-600"
              >
                {BUSINESS_TYPES.map(bt => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
              <button
                type="button"
                onClick={handleAIExtract}
                disabled={isExtracting || !productsText.trim()}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing catalog...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Auto-Complete with AI</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleManualNext}
                className="w-full sm:w-auto px-5 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-xs sm:text-sm rounded-xl transition cursor-pointer"
              >
                Continue Manually →
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 text-xs sm:text-sm">
            {aiExtracted && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Details extracted and organized from your description!</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Business / Brand Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="e.g. Maya's Local Bakes"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  What do you sell? *
                </label>
                <input
                  type="text"
                  value={businessCategory}
                  onChange={e => setBusinessCategory(e.target.value)}
                  placeholder="e.g. Homemade Cakes, Cupcakes & Desserts"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-emerald-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  placeholder="e.g. Freshly baked with pure Belgian butter"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-emerald-600 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Storefront Description
              </label>
              <textarea
                rows={2}
                value={businessDescription}
                onChange={e => setBusinessDescription(e.target.value)}
                className="w-full p-3 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Storefront Location Section on Real Map */}
            <div className="pt-2 border-t border-stone-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-emerald-700" />
                    <span>Storefront & Kitchen Location</span>
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Pinpoint your physical studio/kitchen so customers nearby can find you and calculate delivery distance.
                  </p>
                </div>
              </div>

              <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/50">
                <LocationPicker
                  initialLocation={location}
                  onLocationSelect={loc => setLocation(loc)}
                  onConfirm={loc => setLocation(loc)}
                  confirmButtonText="Save Store Location"
                />
              </div>

              {/* Service Radius */}
              <div className="pt-1">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Service Delivery Radius
                </label>
                <select
                  value={serviceRadiusKm}
                  onChange={e => setServiceRadiusKm(Number(e.target.value))}
                  className="w-full sm:w-64 p-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value={5}>Within 5 km (Hyperlocal)</option>
                  <option value={10}>Within 10 km (Standard)</option>
                  <option value={15}>Within 15 km (Extended)</option>
                  <option value={25}>Within 25 km (Citywide)</option>
                </select>
              </div>
            </div>

            {/* Delivery Methods */}
            <div className="pt-2 border-t border-stone-100">
              <label className="block text-xs font-semibold text-stone-700 mb-2">
                Order Fulfillment Options
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label className="flex items-center gap-2.5 p-3 bg-white border border-stone-200 rounded-xl cursor-pointer text-xs text-stone-800 hover:border-stone-300">
                  <input
                    type="checkbox"
                    checked={deliveryModes.sellerDelivery}
                    onChange={e => setDeliveryModes({ ...deliveryModes, sellerDelivery: e.target.checked })}
                    className="accent-emerald-600 rounded"
                  />
                  <span>Self / Courier Delivery</span>
                </label>
                <label className="flex items-center gap-2.5 p-3 bg-white border border-stone-200 rounded-xl cursor-pointer text-xs text-stone-800 hover:border-stone-300">
                  <input
                    type="checkbox"
                    checked={deliveryModes.thirdParty}
                    onChange={e => setDeliveryModes({ ...deliveryModes, thirdParty: e.target.checked })}
                    className="accent-emerald-600 rounded"
                  />
                  <span>Porter / 3rd Party</span>
                </label>
                <label className="flex items-center gap-2.5 p-3 bg-white border border-stone-200 rounded-xl cursor-pointer text-xs text-stone-800 hover:border-stone-300">
                  <input
                    type="checkbox"
                    checked={deliveryModes.buyerPickup}
                    onChange={e => setDeliveryModes({ ...deliveryModes, buyerPickup: e.target.checked })}
                    className="accent-emerald-600 rounded"
                  />
                  <span>Customer Store Pickup</span>
                </label>
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-4 flex items-center justify-between border-t border-stone-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 text-xs text-stone-600 hover:text-stone-900 font-medium cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="submit"
                className="py-3 px-6 bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs sm:text-sm rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
              >
                <span>Launch Business Room</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
