import React, { useState, useEffect } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { Modal } from '../common/Modal';
import { MapPin, Navigation, Save, ShieldCheck } from 'lucide-react';
import { LeafletMap } from './LeafletMap';

interface GPSConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GPSConfigModal: React.FC<GPSConfigModalProps> = ({ isOpen, onClose }) => {
  const { geofence, updateGeofence } = useAttendance();

  const [lat, setLat] = useState<number>(geofence.latitude || 17.2472);
  const [lng, setLng] = useState<number>(geofence.longitude || 80.1514);
  const [radius, setRadius] = useState<number>(geofence.radiusMeters || 150);
  const [enabled, setEnabled] = useState<boolean>(geofence.enabled ?? true);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setLat(geofence.latitude || 17.2472);
      setLng(geofence.longitude || 80.1514);
      setRadius(geofence.radiusMeters || 150);
      setEnabled(geofence.enabled ?? true);
    }
  }, [isOpen, geofence]);

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

  const handleMapClick = (clickLat: number, clickLng: number) => {
    setLat(clickLat);
    setLng(clickLng);
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
    <Modal isOpen={isOpen} onClose={onClose} title="Campus Geofence Configuration" maxWidth="lg">
      <form onSubmit={handleSave} className="space-y-5">
        
        {/* Enable / Disable Geofence Switch */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Enforce Location Boundary Check</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Only allow students to mark attendance if inside the designated radius.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900 dark:peer-checked:bg-teal-500"></div>
          </label>
        </div>

        {/* Interactive OpenStreetMap — Click to set anchor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Click map to set anchor point
            </label>
            <span className="text-[10px] font-mono text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <LeafletMap
              centerLat={lat}
              centerLng={lng}
              radiusMeters={radius}
              height="220px"
              zoom={16}
              interactive={true}
              onMapClick={handleMapClick}
              showRadius={enabled}
            />
          </div>
        </div>

        {/* Anchor Coordinates Form */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Anchor Latitude</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="number"
                step="0.000001"
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value))}
                required
                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-slate-900 dark:focus:border-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">Anchor Longitude</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="number"
                step="0.000001"
                value={lng}
                onChange={(e) => setLng(parseFloat(e.target.value))}
                required
                className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-slate-900 dark:focus:border-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Radius Selector */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Enforcement Radius (Meters)
            </label>
            <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
              {radius} Meters
            </span>
          </div>
          <input
            type="range"
            min="20"
            max="1000"
            step="10"
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-teal-500"
          />
        </div>

        {/* Location Detection Button */}
        <button
          type="button"
          onClick={captureAdminLocation}
          disabled={isLocating}
          className="w-full py-2.5 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2"
        >
          <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
          {isLocating ? 'Acquiring GPS Fix...' : 'Set Anchor to Current Administrator Location'}
        </button>

        {savedSuccess && (
          <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
            <span>Geofence parameters updated and propagated to all live sessions!</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs uppercase tracking-wider shadow-sm hover:opacity-90 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>

      </form>
    </Modal>
  );
};
