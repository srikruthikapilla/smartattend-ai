import { QRPayload, QRSession } from '../types/session';

/**
 * Generates a dynamic 30-second rotation token for an active QR attendance session.
 */
export function generateQRPayload(session: QRSession, rotationNumber: number): { token: string; payload: QRPayload } {
  const now = Date.now();
  const validityMs = (session.qrValiditySecs || 30) * 1000;
  const exp = now + validityMs;
  const nonce = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
  
  const payload: QRPayload = {
    sId: session.sessionId,
    rot: rotationNumber,
    ts: now,
    exp: exp,
    nonce: nonce,
    sig: btoa(`${session.sessionId}:${rotationNumber}:${now}:${nonce}`).substring(0, 16),
    loc: {
      lat: session.geofence.lat,
      lng: session.geofence.lng,
      rad: session.geofence.radiusMeters,
    }
  };

  return {
    token: JSON.stringify(payload),
    payload
  };
}

export interface QRValidationResult {
  valid: boolean;
  errorCode?: 'EXPIRED_QR' | 'INVALID_SESSION' | 'OUTDATED_ROTATION' | 'MALFORMED_QR' | 'SESSION_ENDED';
  message: string;
  payload?: QRPayload;
}

/**
 * Validates a scanned QR payload against the current live session context.
 */
export function validateQRPayload(
  scannedText: string,
  activeSession: QRSession | null
): QRValidationResult {
  if (!activeSession) {
    return {
      valid: false,
      errorCode: 'SESSION_ENDED',
      message: 'Attendance session has ended or is not active.'
    };
  }

  let payload: QRPayload;
  try {
    payload = JSON.parse(scannedText);
    if (!payload.sId || !payload.rot || !payload.exp || !payload.sig) {
      throw new Error('Missing fields');
    }
  } catch (e) {
    return {
      valid: false,
      errorCode: 'MALFORMED_QR',
      message: 'Invalid QR format. Please scan a valid SBIT Attendance QR code.'
    };
  }

  if (payload.sId !== activeSession.sessionId) {
    return {
      valid: false,
      errorCode: 'INVALID_SESSION',
      message: 'QR code belongs to a different session.'
    };
  }

  const now = Date.now();
  // Allow a 5-second clock skew buffer
  if (now > payload.exp + 5000) {
    return {
      valid: false,
      errorCode: 'EXPIRED_QR',
      message: 'QR code has expired! Please scan the current rotated QR code on screen.'
    };
  }

  if (payload.rot < activeSession.currentRotationNumber) {
    return {
      valid: false,
      errorCode: 'OUTDATED_ROTATION',
      message: 'This QR code has already been rotated out. Screenshots/old codes are rejected.'
    };
  }

  return {
    valid: true,
    message: 'QR Code verified successfully.',
    payload
  };
}
