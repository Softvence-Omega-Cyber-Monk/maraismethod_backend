/**
 * Distance conversion utility
 */
export const KM_TO_MILES = 0.621371;
export const MILES_TO_KM = 1.60934;
export const EARTH_RADIUS_KM = 6371;
export const EARTH_RADIUS_MILES = EARTH_RADIUS_KM * KM_TO_MILES;

/**
 * Converts kilometers to miles
 */
export function kmToMiles(km: number): number {
  return km * KM_TO_MILES;
}

/**
 * Converts miles to kilometers
 */
export function milesToKm(miles: number): number {
  return miles * MILES_TO_KM;
}

/**
 * Converts degrees to radians
 */
export function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in miles by default
 */
export function calculateDistanceInMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}
