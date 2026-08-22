/**
 * Calculates the great-circle distance between two points in meters using the Haversine Formula.
 * 
 * Formula:
 * a = sin²(Δφ/2) + cos(φ1) ⋅ cos(φ2) ⋅ sin²(Δλ/2)
 * c = 2 ⋅ atan2( √a, √(1−a) )
 * d = R ⋅ c
 * 
 * R = 6371000 meters (Earth's radius)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's mean radius in meters
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = R * c;

  return Math.round(distanceMeters * 10) / 10; // Round to 1 decimal place
}

/**
 * Validates if student location is within the allowed campus radius (meters)
 */
export function isWithinGeofence(
  studentLat: number,
  studentLng: number,
  campusLat: number,
  campusLng: number,
  allowedRadiusMeters: number
): { valid: boolean; distanceMeters: number } {
  const distance = calculateHaversineDistance(studentLat, studentLng, campusLat, campusLng);
  return {
    valid: distance <= allowedRadiusMeters,
    distanceMeters: distance
  };
}
