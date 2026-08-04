// src/utils/gps.ts

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Returns the user's current GPS coordinates.
 */
export function getCurrentLocation(): Promise<LocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error("Location permission denied."));
            break;

          case error.POSITION_UNAVAILABLE:
            reject(new Error("Location unavailable."));
            break;

          case error.TIMEOUT:
            reject(new Error("Location request timed out."));
            break;

          default:
            reject(new Error("Unable to get current location."));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Calculate distance between two coordinates
 * using the Haversine Formula.
 *
 * Returns distance in meters.
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Check whether the student is inside the campus.
 */
export function isInsideGeofence(
  currentLat: number,
  currentLng: number,
  campusLat: number,
  campusLng: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(
    currentLat,
    currentLng,
    campusLat,
    campusLng
  );

  return distance <= radiusMeters;
}