export interface QRSession {
  sessionId: string;
  sessionTitle?: string;
  branch: string;
  year: string;
  semester: string;
  section: string;
  facultyId: string;
  facultyName: string;
  durationMins: number;
  qrValiditySecs: number; // Defaults to 30
  status: 'active' | 'expired' | 'terminated';
  startTimestamp: number;
  endTimestamp: number;
  currentRotationToken: string;
  currentRotationNumber: number;
  lastRotatedAt: number;
  geofence: {
    lat: number;
    lng: number;
    radiusMeters: number;
    enabled: boolean;
  };
  totalPresent: number;
  totalLate: number;
  totalAbsent: number;
  createdAt: string;
}

export interface QRPayload {
  sId: string;           // Session ID
  rot: number;           // Rotation count
  ts: number;            // Timestamp
  exp: number;           // Token Expiry timestamp
  nonce: string;         // Random cryptographic token
  sig: string;           // HMAC / validation signature
  loc: {                 // Geofence center
    lat: number;
    lng: number;
    rad: number;
  };
}
