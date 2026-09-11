/**
 * Modular Geocoding Service
 * Uses open, free geocoding providers (Photon by Komoot powered by OpenStreetMap,
 * with Nominatim fallback) that require NO Google Maps API key and NO paid tokens.
 * This provider is fully configurable and decoupled from UI components.
 */

export interface GeocodingResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  area: string;
  pincode: string;
  street?: string;
  country?: string;
}

export interface AddressComponents {
  houseOrFlat?: string;
  street?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

/**
 * Format a human-readable display string from Photon feature properties
 */
function buildPhotonAddress(props: any): {
  formattedAddress: string;
  city: string;
  state: string;
  area: string;
  pincode: string;
  street: string;
  country: string;
} {
  const name = props.name || '';
  const street = [props.housenumber, props.street].filter(Boolean).join(' ') || (props.housenumber ? `No. ${props.housenumber}` : '');
  const area = props.district || props.suburb || props.locality || props.neighbourhood || '';
  const city = props.city || props.town || props.village || props.county || props.municipality || '';
  const state = props.state || '';
  const pincode = props.postcode || '';
  const country = props.country || '';

  // Build clean segments without duplicate words
  const segments: string[] = [];
  if (name && name !== street && name !== city && name !== area) {
    segments.push(name);
  }
  if (street) segments.push(street);
  if (area && !segments.includes(area)) segments.push(area);
  if (city && !segments.includes(city)) segments.push(city);
  if (state && !segments.includes(state)) segments.push(state);
  if (pincode) segments.push(pincode);
  if (country && !segments.includes(country)) segments.push(country);

  const formattedAddress = segments.join(', ') || [city, state, country].filter(Boolean).join(', ') || 'Selected Map Location';

  return {
    formattedAddress,
    city,
    state,
    area: area || (street ? street : name),
    pincode,
    street,
    country,
  };
}

/**
 * Search locations worldwide via Photon (OpenStreetMap data) with fallback
 */
export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  try {
    // Primary: Photon Open Geocoding API
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=6&lang=en`;
    const response = await fetch(photonUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.features && Array.isArray(data.features) && data.features.length > 0) {
        return data.features.map((feature: any) => {
          const coords = feature.geometry.coordinates; // [lng, lat]
          const parsed = buildPhotonAddress(feature.properties || {});
          return {
            formattedAddress: parsed.formattedAddress,
            lat: Number(coords[1].toFixed(6)),
            lng: Number(coords[0].toFixed(6)),
            city: parsed.city,
            state: parsed.state,
            area: parsed.area,
            pincode: parsed.pincode,
            street: parsed.street,
            country: parsed.country,
          };
        });
      }
    }
  } catch (err) {
    console.warn('Photon geocoding error, trying fallback:', err);
  }

  // Fallback: OpenStreetMap Nominatim API
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5&addressdetails=1`;
    const fallbackRes = await fetch(nominatimUrl, {
      headers: { 'Accept-Language': 'en' },
    });

    if (fallbackRes.ok) {
      const items = await fallbackRes.json();
      return items.map((item: any) => {
        const a = item.address || {};
        const city = a.city || a.town || a.village || a.county || '';
        const state = a.state || '';
        const area = a.suburb || a.neighbourhood || a.road || a.residential || '';
        const pincode = a.postcode || '';
        const country = a.country || '';
        return {
          formattedAddress: item.display_name,
          lat: Number(parseFloat(item.lat).toFixed(6)),
          lng: Number(parseFloat(item.lon).toFixed(6)),
          city,
          state,
          area,
          pincode,
          country,
        };
      });
    }
  } catch (err) {
    console.warn('Fallback geocoding error:', err);
  }

  return [];
}

/**
 * Reverse geocode latitude/longitude coordinates to a human-readable address
 */
export async function reverseGeocodeCoordinates(lat: number, lng: number): Promise<GeocodingResult | null> {
  try {
    // Primary: Photon Reverse API
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`;
    const response = await fetch(photonUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.features && Array.isArray(data.features) && data.features.length > 0) {
        const feature = data.features[0];
        const parsed = buildPhotonAddress(feature.properties || {});
        return {
          formattedAddress: parsed.formattedAddress,
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          city: parsed.city,
          state: parsed.state,
          area: parsed.area,
          pincode: parsed.pincode,
          street: parsed.street,
          country: parsed.country,
        };
      }
    }
  } catch (err) {
    console.warn('Photon reverse geocoding error, trying fallback:', err);
  }

  // Fallback: OpenStreetMap Nominatim Reverse API
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (res.ok) {
      const data = await res.json();
      const a = data.address || {};
      const city = a.city || a.town || a.village || a.county || '';
      const state = a.state || '';
      const area = a.suburb || a.neighbourhood || a.road || a.residential || '';
      const pincode = a.postcode || '';
      const country = a.country || '';
      return {
        formattedAddress: data.display_name || `${area || city}, ${state}`,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        city,
        state,
        area,
        pincode,
        country,
      };
    }
  } catch (err) {
    console.warn('Fallback reverse geocoding error:', err);
  }

  return null;
}

/**
 * Forward geocode a structured manual address into coordinates
 */
export async function forwardGeocodeAddress(components: AddressComponents): Promise<GeocodingResult | null> {
  const parts = [
    components.houseOrFlat,
    components.street,
    components.area,
    components.city,
    components.state,
    components.pincode,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  // Try query with most specific components first
  const query = parts.join(', ');
  const results = await searchLocations(query);

  if (results.length > 0) {
    return results[0];
  }

  // If specific search returns no results, try broader city + area
  const broaderParts = [components.area, components.city, components.state].filter(Boolean);
  if (broaderParts.length > 0) {
    const broaderResults = await searchLocations(broaderParts.join(', '));
    if (broaderResults.length > 0) {
      return broaderResults[0];
    }
  }

  return null;
}
