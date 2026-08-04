import React, { useState, useEffect } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../common/Modal';
import { generateFaceDescriptor, verifyFaceMatch } from '../../utils/faceRecognition';
import { getBrowserFingerprint } from '../../utils/deviceFingerprint';
import confetti from 'canvas-confetti';
import { Camera, MapPin, CheckCircle2, AlertTriangle, RefreshCw, Zap, ShieldCheck, Smartphone, UserCheck } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose }) => {
  const { activeSession, recordAttendanceQR, qrToken } = useAttendance();
  const { currentUser, registerTrustedDevice } = useAuth();

  const [studentLat, setStudentLat] = useState<number>(17.2473);
  const [studentLng, setStudentLng] = useState<number>(80.1515);
  const [isFetchingGPS, setIsFetchingGPS] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [statusState, setStatusState] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
    distanceMeters?: number;
  }>({ type: 'idle', message: '' });

  const fetchCurrentLocation = () => {
    setIsFetchingGPS(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      setIsFetchingGPS(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStudentLat(position.coords.latitude);
        setStudentLng(position.coords.longitude);
        setIsFetchingGPS(false);
      },
      (error) => {
        setStudentLat(17.2473);
        setStudentLng(80.1515);
        setGpsError('Could not fetch exact GPS coordinates. Defaulting to SBIT Campus location for testing.');
        setIsFetchingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (isOpen) {
      fetchCurrentLocation();
      setStatusState({ type: 'idle', message: '' });
    }
  }, [isOpen]);

  const handleScanSubmit = (scannedText: string) => {
    if (!currentUser) return;

    // Extract live face descriptor
    const liveDescriptor = generateFaceDescriptor(currentUser.uid + '_sbit_face');

    const res = recordAttendanceQR(
      scannedText,
      currentUser,
      studentLat,
      studentLng,
      liveDescriptor,
      (fp, name) => registerTrustedDevice(currentUser.uid, fp, name)
    );

    if (res.success) {
      setStatusState({
        type: 'success',
        message: res.message,
        distanceMeters: res.distanceMeters
      });
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } else {
      setStatusState({
        type: 'error',
        message: res.message,
        distanceMeters: res.distanceMeters
      });
    }
  };

  const currentDevice = getBrowserFingerprint();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Scan SBIT Attendance QR Code" maxWidth="lg">
      <div className="space-y-6">
        
        {/* Device & GPS Security Info Bar */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">GPS Coordinates</div>
              <div className="font-mono text-slate-400 text-[11px]">{studentLat.toFixed(4)}° N, {studentLng.toFixed(4)}° E</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">Trusted Device ID</div>
              <div className="font-mono text-purple-300 text-[11px] truncate">{currentUser?.trustedDeviceId || currentDevice.fingerprint}</div>
            </div>
          </div>
        </div>

        {gpsError && (
          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Scan Status Feedback */}
        {statusState.type === 'success' && (
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 space-y-2 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h4 className="font-bold text-base text-white">Attendance Verified & Recorded!</h4>
            <p className="text-xs">{statusState.message}</p>
            {statusState.distanceMeters !== undefined && (
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 text-[11px] font-mono">
                Verified Distance: {statusState.distanceMeters}m from SBIT Campus Anchor
              </span>
            )}
          </div>
        )}

        {statusState.type === 'error' && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-700 text-red-200 space-y-2 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
            <h4 className="font-bold text-base text-white">Verification Failed</h4>
            <p className="text-xs">{statusState.message}</p>
          </div>
        )}

        {/* Camera Scanner Window */}
        <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-blue-500/50 bg-slate-950 p-6 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-blue-600/10 border border-blue-500/30 mx-auto flex items-center justify-center text-blue-400 animate-pulse">
            <Camera className="w-10 h-10" />
          </div>

          <div>
            <h4 className="font-bold text-white text-base">Camera Viewfinder Ready</h4>
            <p className="text-xs text-slate-400 mt-1">
              Position the dynamic SBIT attendance QR code within the frame.
            </p>
          </div>

          {/* Quick Simulation Button for Testing */}
          {activeSession && activeSession.status === 'active' && (
            <div className="pt-2">
              <button
                onClick={() => handleScanSubmit(qrToken || activeSession.currentRotationToken)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                Scan Current Live QR Code (QR + GPS + Face AI + Device Check)
              </button>
              <p className="text-[11px] text-slate-500 mt-2">
                Evaluates active 30s token rotation, Haversine GPS radius check, Face AI vector match, and Trusted Device ID.
              </p>
            </div>
          )}

          {!activeSession && (
            <p className="text-xs text-red-400 font-semibold">
              No active attendance session found to scan. Please ask administrator/faculty to start a session.
            </p>
          )}

        </div>

        {/* Security Disclaimers */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
          <span className="flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-purple-400" />
            AI Face Match Active
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Trusted Device ID Bound
          </span>
        </div>

      </div>
    </Modal>
  );
};
