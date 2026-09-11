import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { LocationPicker } from '../common/LocationPicker';
import { PRODUCT_CATEGORIES } from '../../constants/config';
import { LocationInfo } from '../../types';
import { ShoppingBag, Sparkles, ArrowRight, Check, MapPin } from 'lucide-react';

interface BuyerOnboardingProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export const BuyerOnboarding: React.FC<BuyerOnboardingProps> = ({ onComplete }) => {
  const { currentUser, updateUserLocation } = useAuth();
  const { createBuyerProfile, setCurrentCity, setCurrentArea } = useStore();

  const [location, setLocation] = useState<LocationInfo>(() => {
    return (
      currentUser?.location || {
        city: 'Bengaluru',
        state: 'Karnataka',
        area: 'Indiranagar',
        pincode: '560038',
        address: '',
        coordinates: { lat: 12.9784, lng: 77.6408 },
      }
    );
  });

  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Bakery & Desserts',
    'Handmade Jewellery',
    'Gifts & Handcrafted Studio',
  ]);

  const toggleCategory = (catName: string) => {
    setSelectedCategories(prev =>
      prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]
    );
  };

  const handleLocationConfirmed = (confirmedLoc: LocationInfo) => {
    setLocation(confirmedLoc);
  };

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    updateUserLocation(location);
    if (location.city) setCurrentCity(location.city);
    if (location.area) setCurrentArea(location.area);

    createBuyerProfile({
      userId: currentUser.id,
      fullName: currentUser.fullName,
      email: currentUser.email,
      phone: currentUser.phone,
      location,
      preferredCategories: selectedCategories,
    });

    onComplete();
  };

  return (
    <div className="min-h-[85vh] py-8 px-4 sm:px-6 flex items-center justify-center bg-stone-50 text-stone-900">
      <div className="max-w-2xl w-full bg-white border border-stone-200 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-stone-100 pb-5">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Welcome to LocalCart
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900">
              Set Your Real Delivery Location
            </h1>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
          Pinpoint your address on the interactive map so nearby bakers, crafters, and local studios can dispatch fresh orders directly to your door.
        </p>

        {/* Real Interactive Map Location Picker */}
        <div className="border border-stone-200 rounded-2xl p-4 bg-stone-50/50">
          <LocationPicker
            initialLocation={location}
            onLocationSelect={handleLocationConfirmed}
            onConfirm={handleLocationConfirmed}
            confirmButtonText="Save Delivery Location"
          />
        </div>

        {/* Favorite Categories */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>What are you interested in shopping for?</span>
            </span>
            <span className="text-[11px] text-stone-400">Optional</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRODUCT_CATEGORIES.map(cat => {
              const isSelected = selectedCategories.includes(cat.name);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.name)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50 border-amber-300 text-amber-950 font-medium'
                      : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900'
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-amber-600 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-stone-500 truncate">
            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate">
              {location.address || `${location.area || location.city}, ${location.state}`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white font-medium text-xs sm:text-sm rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.99] shrink-0"
          >
            <span>Start Exploring</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
