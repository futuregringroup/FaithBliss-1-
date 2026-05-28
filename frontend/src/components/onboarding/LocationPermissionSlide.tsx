import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ChevronDown } from 'lucide-react';
import type { OnboardingData } from './types';

interface LocationPermissionSlideProps {
  onboardingData: OnboardingData;
  setOnboardingData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  isVisible: boolean;
  onLocationResolved?: () => void;
  showValidationErrors?: boolean;
}

const fetchWithTimeout = (url: string, options: RequestInit = {}, ms = 6000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
  // Provider 1: BigDataCloud
  try {
    const res = await fetchWithTimeout(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );
    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision || '';
      const country = data.countryName || '';
      const result = [city, country].filter(Boolean).join(', ');
      if (result) return result;
    }
  } catch { /* fall through */ }

  // Provider 2: OpenStreetMap Nominatim
  try {
    const res = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (res.ok) {
      const data = await res.json();
      if (!data.error) {
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.county || addr.state_district || addr.state || '';
        const country = addr.country || '';
        const result = [city, country].filter(Boolean).join(', ');
        if (result) return result;
      }
    }
  } catch { /* fall through */ }

  // Provider 3: geocode.maps.co (no key needed)
  try {
    const res = await fetchWithTimeout(
      `https://geocode.maps.co/reverse?lat=${latitude}&lon=${longitude}&format=json`
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || addr.state || '';
      const country = addr.country || '';
      const result = [city, country].filter(Boolean).join(', ');
      if (result) return result;
    }
  } catch { /* fall through */ }

  throw new Error('All geocoding providers failed');
};

const LocationPermissionSlide: React.FC<LocationPermissionSlideProps> = ({
  onboardingData,
  setOnboardingData,
  isVisible,
  onLocationResolved,
  showValidationErrors = false,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHowUsed, setShowHowUsed] = useState(false);
  const [coordsCaptured, setCoordsCaptured] = useState(false);
  const isLocationMissing = !onboardingData.location?.trim() && !coordsCaptured;

  if (!isVisible) return null;

  const requestLocation = async () => {
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this browser. Enter your location manually below.');
      return;
    }

    setIsRequesting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const address = await reverseGeocode(latitude, longitude);
          setOnboardingData((prev) => ({
            ...prev,
            latitude,
            longitude,
            location: address || prev.location,
          }));
        } catch {
          const { latitude, longitude } = position.coords;
          setOnboardingData((prev) => ({ ...prev, latitude, longitude }));
          setCoordsCaptured(true);
          setError(null);
        } finally {
          setIsRequesting(false);
        }
      },
      () => {
        setError('Location permission denied. You can still continue by typing your location manually.');
        setIsRequesting(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.45 }}
      className="space-y-8 text-center"
    >
      <div className="space-y-4">
        <h2 className="text-4xl font-bold leading-tight text-white">So, are you from around here?</h2>
        <p className="mx-auto max-w-xl text-lg text-slate-300">
          Set your location to see who&apos;s in your area or beyond. You won&apos;t be able to match with people otherwise.
        </p>
      </div>

      <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full bg-white/10">
        <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white/40 bg-white/10">
          <MapPin className="h-14 w-14 text-slate-300" />
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-3">
        <button
          type="button"
          onClick={requestLocation}
          disabled={isRequesting}
          className="w-full rounded-full bg-white py-4 text-2xl font-bold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isRequesting ? 'Allowing...' : 'Allow'}
        </button>

        <button
          type="button"
          onClick={() => setShowHowUsed((prev) => !prev)}
          className="flex w-full items-center justify-center gap-2 py-2 text-lg font-semibold text-white"
        >
          How is my location used?
          <ChevronDown className={`h-5 w-5 transition ${showHowUsed ? 'rotate-180' : ''}`} />
        </button>

        {showHowUsed && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-left text-sm text-slate-300">
            We use your location to show nearby matches, filter by distance, and improve discovery quality. You can
            update this later in profile settings.
          </div>
        )}
      </div>

      <div className="mx-auto max-w-xl text-left">
        <label className="mb-2 block text-sm font-semibold text-gray-300">Or enter location manually</label>
        <input
          type="text"
          value={onboardingData.location || ''}
          onChange={(e) => setOnboardingData((prev) => ({ ...prev, location: e.target.value }))}
          placeholder="City, State / Country"
          className={`w-full rounded-xl border bg-slate-900/50 p-4 text-white placeholder-slate-400 focus:border-pink-400 focus:outline-none ${
            showValidationErrors && isLocationMissing ? 'border-red-400/70' : 'border-white/15'
          }`}
        />
        {showValidationErrors && isLocationMissing ? (
          <p className="mt-2 text-sm text-red-400">Please allow location access or type your location manually.</p>
        ) : null}
        {error && <p className="mt-2 text-sm text-amber-300">{error}</p>}
        {onboardingData.location ? (
          <p className="mt-2 text-sm text-emerald-300">Location set: {onboardingData.location}</p>
        ) : coordsCaptured ? (
          <p className="mt-2 text-sm text-emerald-300">Location captured — you can continue or type your city below.</p>
        ) : null}
      </div>
    </motion.div>
  );
};

export default LocationPermissionSlide;
