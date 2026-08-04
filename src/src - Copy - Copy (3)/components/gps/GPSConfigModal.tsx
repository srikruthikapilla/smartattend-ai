import React, { useState } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { Modal } from '../common/Modal';
import { MapPin, Navigation, Save, ShieldCheck, AlertCircle } from 'lucide-react';

interface GPSConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GPSConfigModal: React.FC<GPSConfigModalProps> = ({ isOpen, onClose }) => {
  const { geofence, updateGeofence } = useAttendance();

  const [lat, setLat] = useState<number>(geofence.latitude);
  const [lng, setLng] = useState<number>(geofence.longitude);
  const [radius, setRadius] = useState<number>(geofence.radiusMeters);
  const [enabled, setEnabled] = useState<boolean>(geofence.enabled);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const captureAdminLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setIsLocating(false);
      },
      (err) => {
        alert(`Failed to capture location: ${err.message}. Preserving SBIT campus anchor.`);
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateGeofence({
      latitude: Number(lat),
      longitude: Number(lng),
      radiusMeters: Number(radius),
      enabled
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configure SBIT GPS Geofence Radius" maxWidth="lg">
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Enable / Disable Geofence Switch */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <div>
            <h4 className="font-bold text-white text-sm">Enforce Location Boundary Check</h4>
            <p className="text-xs text-slate-400">
              Only allow students to mark attendance if inside configured radius.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Capture Admin Location Button */}
        <div className="flex justify-between items-center p-3.5 rounded-xl bg-blue-950/30 border border-blue-800/40">
          <div className="text-xs">
            <div className="font-semibold text-blue-300">Set Campus Anchor via Current Device GPS</div>
            <div className="text-slate-400">Captures exact latitude and longitude of current location.</div>
          </div>
          <button
            type="button"
            onClick={captureAdminLocation}
            disabled={isLocating}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            {isLocating ? 'Locating...' : 'Capture GPS'}
          </button>
        </div>

        {/* Lat / Lng Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Latitude (°N)</label>
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(parseFloat(e.target.value))}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Longitude (°E)</label>
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(parseFloat(e.target.value))}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Interactive Radius Slider (0 - 2000 meters) */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <label className="font-semibold text-slate-300">Allowed Geofence Radius (0 – 2000m)</label>
            <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-mono font-bold text-sm">
              {radius} meters
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="2000"
            step="25"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />

          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0m (Exact Point)</span>
            <span>500m (Campus)</span>
            <span>1000m</span>
            <span>2000m (Wide Area)</span>
          </div>
        </div>

        {/* Haversine Formula Note */}
        <div className="p-3 rounded-lg bg-slate-800/40 text-slate-400 text-xs flex items-center gap-2 border border-slate-700/40">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Distance evaluated via Haversine spherical trigonometric distance model.</span>
        </div>

        {savedSuccess && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-xs font-semibold text-center">
            Geofence Settings Saved Successfully!
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            Save GPS Settings
          </button>
        </div>

      </form>
    </Modal>
  );
};
