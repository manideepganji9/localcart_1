import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocationInfo } from '../../types';
import { APP_CONFIG } from '../../constants/config';
import {
  MapPin,
  Search,
  Navigation,
  Check,
  Compass,
  AlertCircle,
  Loader2,
  Info,
  Layers,
  Crosshair,
  Sparkles,
} from 'lucide-react';
import {
  searchLocations,
  reverseGeocodeCoordinates,
  forwardGeocodeAddress,
  GeocodingResult,
} from '../../services/geocodingService';

interface LocationPickerProps {
  initialLocation?: LocationInfo;
  onLocationSelect: (location: LocationInfo) => void;
  onConfirm?: (location: LocationInfo) => void;
  className?: string;
  confirmButtonText?: string;
  compact?: boolean;
}

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export const LocationPicker: React.FC<LocationPickerProps> = ({
  initialLocation,
  onLocationSelect,
  onConfirm,
  className = '',
  confirmButtonText = 'Confirm Location',
  compact = false,
}) => {
  // Coordinates (fallback to default or standard center)
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(() => {
    if (initialLocation?.coordinates?.lat && initialLocation?.coordinates?.lng) {
      return initialLocation.coordinates;
    }
    if (initialLocation?.latitude && initialLocation?.longitude) {
      return { lat: initialLocation.latitude, lng: initialLocation.longitude };
    }
    return { lat: 17.4156, lng: 78.4350 };
  });

  // Address fields
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [houseNumber, setHouseNumber] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState(initialLocation?.area || '');
  const [city, setCity] = useState(initialLocation?.city || '');
  const [state, setState] = useState(initialLocation?.state || '');
  const [pincode, setPincode] = useState(initialLocation?.pincode || '');

  // Keep internal state synchronized whenever initialLocation changes (e.g. from user profile or Firestore load)
  useEffect(() => {
    if (initialLocation) {
      if (initialLocation.address !== undefined) setAddress(initialLocation.address);
      if (initialLocation.area !== undefined) setArea(initialLocation.area);
      if (initialLocation.city !== undefined) setCity(initialLocation.city);
      if (initialLocation.state !== undefined) setState(initialLocation.state);
      if (initialLocation.pincode !== undefined) setPincode(initialLocation.pincode);

      const lat = initialLocation.latitude ?? initialLocation.coordinates?.lat;
      const lng = initialLocation.longitude ?? initialLocation.coordinates?.lng;
      if (lat !== undefined && lng !== undefined) {
        setCoords({ lat, lng });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({ center: [lng, lat], zoom: 14 });
        }
        if (markerRef.current) {
          markerRef.current.setLngLat([lng, lat]);
        }
      }
    }
  }, [
    initialLocation?.address,
    initialLocation?.area,
    initialLocation?.city,
    initialLocation?.state,
    initialLocation?.pincode,
    initialLocation?.latitude,
    initialLocation?.longitude,
    initialLocation?.coordinates?.lat,
    initialLocation?.coordinates?.lng,
  ]);

  // UI state
  const [activeTab, setActiveTab] = useState<'map' | 'manual'>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // MapLibre references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Notify parent of location changes
  const syncLocation = useCallback(
    (overrides?: Partial<LocationInfo>) => {
      const activeCoords = overrides?.coordinates !== undefined ? overrides.coordinates : coords;
      const updated: LocationInfo = {
        label: initialLocation?.label || '',
        address: overrides?.address !== undefined ? overrides.address : address,
        area: overrides?.area !== undefined ? overrides.area : area,
        city: overrides?.city !== undefined ? overrides.city : city,
        state: overrides?.state !== undefined ? overrides.state : state,
        pincode: overrides?.pincode !== undefined ? overrides.pincode : pincode,
        coordinates: activeCoords,
        latitude: activeCoords?.lat,
        longitude: activeCoords?.lng,
      };
      onLocationSelect(updated);
    },
    [address, area, city, state, pincode, coords, initialLocation?.label, onLocationSelect]
  );

  // Reverse geocoding handler
  const handleReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      setStatusMessage('Resolving address from coordinates...');
      try {
        const result = await reverseGeocodeCoordinates(lat, lng);
        if (result) {
          const newAddress = result.formattedAddress || `${result.area || result.city}, ${result.state}`;
          setAddress(newAddress);
          if (result.area) setArea(result.area);
          if (result.city) setCity(result.city);
          if (result.state) setState(result.state);
          if (result.pincode) setPincode(result.pincode);
          if (result.street) setStreet(result.street);

          syncLocation({
            address: newAddress,
            area: result.area || area,
            city: result.city || city,
            state: result.state || state,
            pincode: result.pincode || pincode,
            coordinates: { lat, lng },
          });
          setStatusMessage(null);
        } else {
          setStatusMessage('Location pinned. You can edit street details below.');
        }
      } catch (err) {
        console.warn('Reverse geocoding error:', err);
        setStatusMessage(null);
      }
    },
    [area, city, state, pincode, syncLocation]
  );

  // Initialize MapLibre GL instance
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Already initialized

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: OPENFREEMAP_STYLE,
        center: [coords.lng, coords.lat],
        zoom: 14,
        attributionControl: false,
      });

      // Add navigation controls (zoom in/out, compass)
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          visualizePitch: true,
        }),
        'top-right'
      );

      // Add custom attribution quietly in bottom-right
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: '© <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        }),
        'bottom-right'
      );

      // Create draggable custom marker
      const markerEl = document.createElement('div');
      markerEl.className = 'custom-maplibre-marker';
      markerEl.innerHTML = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
          <div style="width: 36px; height: 36px; border-radius: 9999px; background-color: #D97706; display: flex; align-items: center; justify-content: center; border: 3px solid #FFFFFF; box-shadow: 0 4px 10px rgba(217, 119, 6, 0.4);">
            <svg style="width: 18px; height: 18px; color: #FFFFFF;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5" fill="#FFFFFF"/>
            </svg>
          </div>
          <div style="width: 2px; height: 8px; background-color: #B45309;"></div>
          <div style="width: 12px; height: 4px; border-radius: 9999px; background-color: rgba(0,0,0,0.3); filter: blur(1px);"></div>
        </div>
      `;

      const marker = new maplibregl.Marker({
        element: markerEl,
        draggable: true,
      })
        .setLngLat([coords.lng, coords.lat])
        .addTo(map);

      // Handle drag end
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        const newLat = Number(lngLat.lat.toFixed(6));
        const newLng = Number(lngLat.lng.toFixed(6));
        setCoords({ lat: newLat, lng: newLng });
        handleReverseGeocode(newLat, newLng);
      });

      // Handle map click
      map.on('click', (e) => {
        const newLat = Number(e.lngLat.lat.toFixed(6));
        const newLng = Number(e.lngLat.lng.toFixed(6));
        marker.setLngLat([newLng, newLat]);
        setCoords({ lat: newLat, lng: newLng });
        handleReverseGeocode(newLat, newLng);
      });

      map.on('load', () => {
        setMapLoaded(true);
        map.resize();
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    } catch (error) {
      console.error('Failed to initialize MapLibre map:', error);
      setStatusMessage('Map tile loading failed. You can still input your address details.');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Resize observer to ensure tiles adjust to modal and responsive widths
  useEffect(() => {
    if (!mapContainerRef.current || !mapInstanceRef.current) return;
    const observer = new ResizeObserver(() => {
      mapInstanceRef.current?.resize();
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, [mapLoaded]);

  // Keep map and marker synchronized if coordinates update externally
  const panToCoords = useCallback((newLat: number, newLng: number, zoomLevel = 15) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: [newLng, newLat],
        zoom: zoomLevel,
        essential: true,
      });
    }
    if (markerRef.current) {
      markerRef.current.setLngLat([newLng, newLat]);
    }
  }, []);

  // Search address handler using Photon
  const handleSearch = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setStatusMessage('Searching open global database...');
    try {
      const results = await searchLocations(query);
      setSearchResults(results);
      if (results.length === 0) {
        setStatusMessage('No locations found. Try entering landmark, neighborhood, or city name.');
      } else {
        setStatusMessage(null);
      }
    } catch (err) {
      console.warn('Location search error:', err);
      setStatusMessage('Search error. You can drag the pin on the map or enter address manually.');
    } finally {
      setIsSearching(false);
    }
  };

  // Select a search result
  const handleSelectSearchResult = (res: GeocodingResult) => {
    setCoords({ lat: res.lat, lng: res.lng });
    setAddress(res.formattedAddress);
    if (res.city) setCity(res.city);
    if (res.state) setState(res.state);
    if (res.area) setArea(res.area);
    if (res.pincode) setPincode(res.pincode);
    if (res.street) setStreet(res.street);

    setSearchResults([]);
    setSearchQuery('');
    setStatusMessage(null);

    panToCoords(res.lat, res.lng, 15);

    syncLocation({
      address: res.formattedAddress,
      city: res.city || city,
      state: res.state || state,
      area: res.area || area,
      pincode: res.pincode || pincode,
      coordinates: { lat: res.lat, lng: res.lng },
    });
  };

  // Current GPS location locator
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setStatusMessage('Detecting current device GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setCoords({ lat, lng });
        setIsLocating(false);
        panToCoords(lat, lng, 16);
        handleReverseGeocode(lat, lng);
      },
      err => {
        console.warn('Geolocation permission error:', err);
        setIsLocating(false);
        setStatusMessage('Location permission denied or unavailable. You can search or pinpoint on the map.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Forward geocode manual address fields
  const handleLocateManualAddress = async () => {
    setIsGeocoding(true);
    setStatusMessage('Finding address coordinates on map...');
    try {
      const fullAddress = [houseNumber, street, area, city, state, pincode].filter(Boolean).join(', ');
      setAddress(fullAddress);

      const result = await forwardGeocodeAddress({
        houseOrFlat: houseNumber,
        street,
        area,
        city,
        state,
        pincode,
      });

      if (result) {
        setCoords({ lat: result.lat, lng: result.lng });
        panToCoords(result.lat, result.lng, 15);
        setStatusMessage('Location matched on map!');
        syncLocation({
          address: fullAddress,
          area,
          city,
          state,
          pincode,
          coordinates: { lat: result.lat, lng: result.lng },
        });
      } else {
        setStatusMessage('Could not pinpoint exact street. You can drag the pin on the map to exact position.');
      }
    } catch (err) {
      console.warn('Manual address geocoding failed:', err);
      setStatusMessage('Address entered. Pinpoint your location on the map to fine-tune coordinates.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleConfirm = () => {
    const finalLoc: LocationInfo = {
      label: initialLocation?.label || '',
      address: address || [houseNumber, street, area, city, state, pincode].filter(Boolean).join(', '),
      area,
      city,
      state,
      pincode,
      coordinates: coords,
      latitude: coords?.lat,
      longitude: coords?.lng,
    };
    if (onConfirm) onConfirm(finalLoc);
    else onLocationSelect(finalLoc);
  };

  return (
    <div className={`space-y-4 text-stone-800 ${className}`}>
      {/* Search Bar & Current Location Button */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleSearch(e);
              }
            }}
            placeholder="Search address, neighborhood, city or landmark worldwide..."
            className="w-full pl-9 pr-24 py-2.5 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 shadow-xs"
          />
          <button
            type="button"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              handleSearch(e);
            }}
            disabled={isSearching}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Search'}
          </button>
        </div>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs"
        >
          {isLocating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />
          ) : (
            <Navigation className="h-3.5 w-3.5 text-amber-700" />
          )}
          <span>Use my location</span>
        </button>
      </div>

      {/* Autocomplete / Search Results dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl shadow-lg divide-y divide-stone-100 max-h-56 overflow-y-auto z-20">
          {searchResults.map((res, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectSearchResult(res)}
              className="w-full text-left p-3 hover:bg-stone-50 transition flex items-start gap-2.5 cursor-pointer"
            >
              <MapPin className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-stone-900 truncate">{res.formattedAddress}</p>
                <p className="text-[11px] text-stone-500">
                  {[res.area, res.city, res.state, res.pincode, res.country].filter(Boolean).join(', ')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Status Notice */}
      {statusMessage && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-100 border border-stone-200 text-xs text-stone-600">
          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Mode Switcher: Interactive Map vs. Manual Entry */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('map');
              setTimeout(() => mapInstanceRef.current?.resize(), 100);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'map'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Interactive Map</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'manual'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <span>Address Details</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-mono bg-stone-50 px-2 py-0.5 rounded border border-stone-200">
          <Crosshair className="w-3 h-3 text-amber-600" />
          <span>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
        </div>
      </div>

      {/* Real Interactive MapLibre GL Map (always rendered to maintain map instance) */}
      <div className={`space-y-3 ${activeTab === 'map' ? 'block' : 'hidden'}`}>
        <div className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 shadow-inner">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Floating Instructions Pill */}
          <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-stone-200 shadow-xs text-[11px] text-stone-700 flex items-center gap-1.5 pointer-events-none">
            <Compass className="w-3.5 h-3.5 text-amber-600" />
            <span>Click or drag pin to place your location</span>
          </div>

          {/* Floating Location Summary Bar */}
          <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-stone-200 shadow-md flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs font-medium text-stone-900 truncate">
                {address || `${area || city}, ${state} ${pincode}`}
              </p>
            </div>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md shrink-0">
              Pinned
            </span>
          </div>
        </div>
      </div>

      {/* Manual Address Entry Form */}
      <div className={`space-y-3.5 ${activeTab === 'manual' ? 'block' : 'block pt-1'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Flat / House / Building No.
            </label>
            <input
              type="text"
              value={houseNumber}
              onChange={e => {
                setHouseNumber(e.target.value);
                const full = [e.target.value, street, area, city, state, pincode].filter(Boolean).join(', ');
                setAddress(full);
                syncLocation({ address: full });
              }}
              placeholder="e.g. Flat 302, Green Meadows"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Street / Road / Landmark
            </label>
            <input
              type="text"
              value={street}
              onChange={e => {
                setStreet(e.target.value);
                const full = [houseNumber, e.target.value, area, city, state, pincode].filter(Boolean).join(', ');
                setAddress(full);
                syncLocation({ address: full });
              }}
              placeholder="e.g. 5th Cross Road, Near Central Park"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-[11px] font-medium text-stone-600 mb-1">Locality / Area</label>
            <input
              type="text"
              value={area}
              onChange={e => {
                setArea(e.target.value);
                syncLocation({ area: e.target.value });
              }}
              placeholder="e.g. Indiranagar"
              className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-stone-600 mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={e => {
                setCity(e.target.value);
                syncLocation({ city: e.target.value });
              }}
              placeholder="e.g. Bengaluru"
              className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-stone-600 mb-1">State</label>
            <input
              type="text"
              value={state}
              onChange={e => {
                setState(e.target.value);
                syncLocation({ state: e.target.value });
              }}
              placeholder="e.g. Karnataka"
              className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-stone-600 mb-1">PIN / Postal Code</label>
            <input
              type="text"
              value={pincode}
              onChange={e => {
                setPincode(e.target.value);
                syncLocation({ pincode: e.target.value });
              }}
              placeholder="e.g. 560038"
              className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-600"
            />
          </div>
        </div>

        {/* Locate Address on Map Button */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleLocateManualAddress}
            disabled={isGeocoding || (!area && !city && !street)}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isGeocoding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Crosshair className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>Locate Address on Map</span>
          </button>

          <span className="text-[11px] text-stone-500">
            Coordinates: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Confirmation Button */}
      <button
        type="button"
        onClick={handleConfirm}
        className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm rounded-xl transition shadow-xs hover:shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
      >
        <Check className="h-4 w-4" />
        <span>{confirmButtonText}</span>
      </button>
    </div>
  );
};
