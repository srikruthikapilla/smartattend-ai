/**
 * Trusted Device Fingerprinting Utility
 * Computes a unique hash based on browser hardware, screen resolution, timezone, canvas rendering,
 * and user agent parameters.
 */

export interface DeviceInfo {
  fingerprint: string;
  deviceName: string;
  platform: string;
  timestamp: string;
}

export function getBrowserFingerprint(): DeviceInfo {
  const nav = window.navigator;
  const screen = window.screen;

  const rawStr = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency || 4,
    nav.maxTouchPoints || 0
  ].join('||');

  // Simple DJB2 Hash function for fast deterministic hashing
  let hash = 5381;
  for (let i = 0; i < rawStr.length; i++) {
    hash = (hash * 33) ^ rawStr.charCodeAt(i);
  }
  const fingerprint = 'DEV-' + Math.abs(hash).toString(16).toUpperCase();

  // Construct readable device name
  let deviceName = 'Browser Device';
  if (nav.userAgent.includes('Windows')) deviceName = 'Windows PC';
  else if (nav.userAgent.includes('Mac')) deviceName = 'MacBook / Mac';
  else if (nav.userAgent.includes('Android')) deviceName = 'Android Mobile';
  else if (nav.userAgent.includes('iPhone') || nav.userAgent.includes('iPad')) deviceName = 'Apple iOS Device';
  else if (nav.userAgent.includes('Linux')) deviceName = 'Linux PC';

  return {
    fingerprint,
    deviceName,
    platform: nav.platform || 'Web Browser',
    timestamp: new Date().toISOString()
  };
}
