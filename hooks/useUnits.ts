import { getLocales } from 'expo-localization';

// US, Liberia, Myanmar are the only countries using imperial
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

export type UnitSystem = 'imperial' | 'metric';

function getUnitSystem(): UnitSystem {
  const locale = getLocales()[0];
  return locale?.regionCode && IMPERIAL_REGIONS.has(locale.regionCode) ? 'imperial' : 'metric';
}

const unitSystem = getUnitSystem();

export function useUnits() {
  return {
    system: unitSystem,
    isImperial: unitSystem === 'imperial',

    // Distance: km ↔ mi
    formatDistance: (km: number) =>
      unitSystem === 'imperial'
        ? `${(km * 0.621371).toFixed(1)} mi`
        : `${km.toFixed(1)} km`,

    // Elevation: m ↔ ft
    formatElevation: (meters: number) =>
      unitSystem === 'imperial'
        ? `${Math.round(meters * 3.28084)} ft`
        : `${Math.round(meters)} m`,

    // Speed: km/h ↔ mph
    formatSpeed: (kmh: number) =>
      unitSystem === 'imperial'
        ? `${(kmh * 0.621371).toFixed(1)} mph`
        : `${kmh.toFixed(1)} km/h`,

    // Pace: min/km ↔ min/mi
    formatPace: (minPerKm: number) => {
      const pace = unitSystem === 'imperial' ? minPerKm * 1.60934 : minPerKm;
      const mins = Math.floor(pace);
      const secs = Math.round((pace - mins) * 60);
      const unit = unitSystem === 'imperial' ? '/mi' : '/km';
      return `${mins}:${secs.toString().padStart(2, '0')}${unit}`;
    },

    distanceUnit: unitSystem === 'imperial' ? 'mi' : 'km',
    elevationUnit: unitSystem === 'imperial' ? 'ft' : 'm',
    speedUnit: unitSystem === 'imperial' ? 'mph' : 'km/h',
  };
}
