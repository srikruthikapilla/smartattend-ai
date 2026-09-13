import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons (Leaflet bundles break with Vite/webpack)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom student marker icon (small teal dot with pulse)
const studentIcon = L.divIcon({
  className: '',
  html: `<div class="relative flex items-center justify-center w-4 h-4">
           <div class="absolute inset-0 bg-teal-400 rounded-full animate-ping opacity-75"></div>
           <div class="relative w-3 h-3 bg-teal-500 rounded-full border-2 border-white shadow-sm"></div>
         </div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Red out-of-bounds marker (pulse)
const outOfBoundsIcon = L.divIcon({
  className: '',
  html: `<div class="relative flex items-center justify-center w-4 h-4">
           <div class="absolute inset-0 bg-rose-400 rounded-full animate-ping opacity-75"></div>
           <div class="relative w-3 h-3 bg-rose-500 rounded-full border-2 border-white shadow-sm"></div>
         </div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Campus center marker (blue pulse)
const campusIcon = L.divIcon({
  className: '',
  html: `<div class="relative flex items-center justify-center w-6 h-6">
           <div class="absolute inset-0 bg-blue-400 rounded-full animate-pulse opacity-40"></div>
           <div class="relative w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export interface StudentMarker {
  lat: number;
  lng: number;
  name: string;
  hallTicket?: string;
  status?: string;
  distanceM?: number;
}

interface LeafletMapProps {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  height?: string;
  zoom?: number;
  students?: StudentMarker[];
  interactive?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  showRadius?: boolean;
}

/**
 * Internal component to re-center the map when props change.
 */
const MapRecenter: React.FC<{ lat: number; lng: number; zoom: number }> = ({ lat, lng, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [lat, lng, zoom, map]);
  return null;
};

/**
 * Internal component to handle map click events.
 */
const MapClickHandler: React.FC<{ onClick: (lat: number, lng: number) => void }> = ({ onClick }) => {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

/**
 * Reusable OpenStreetMap component using Leaflet / react-leaflet.
 * Shows campus center, geofence radius circle, and optional student markers.
 */
export const LeafletMap: React.FC<LeafletMapProps> = ({
  centerLat,
  centerLng,
  radiusMeters,
  height = '240px',
  zoom = 16,
  students = [],
  interactive = false,
  onMapClick,
  className = '',
  showRadius = true,
}) => {
  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={zoom}
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      zoomControl={interactive}
      attributionControl={false}
      style={{ height, width: '100%', borderRadius: '16px', zIndex: 10, backgroundColor: '#f1f5f9' }}
      className={`shadow-inner ${className}`}
    >
      {/* Standard OpenStreetMap Tiles */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      <MapRecenter lat={centerLat} lng={centerLng} zoom={zoom} />

      {/* Click handler for interactive mode */}
      {interactive && onMapClick && <MapClickHandler onClick={onMapClick} />}

      {/* Campus center marker */}
      <Marker position={[centerLat, centerLng]} icon={campusIcon}>
        <Popup className="custom-popup">
          <div className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">Campus Center</div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            {centerLat.toFixed(5)}, {centerLng.toFixed(5)}
          </div>
        </Popup>
      </Marker>

      {/* Geofence radius circle */}
      {showRadius && (
        <Circle
          center={[centerLat, centerLng]}
          radius={radiusMeters}
          pathOptions={{
            color: '#0d9488', // teal-600
            weight: 2,
            fillColor: '#14b8a6', // teal-500
            fillOpacity: 0.15,
            dashArray: '4 6',
          }}
        />
      )}

      {/* Student check-in markers */}
      {students.map((s, idx) => {
        const isOutOfBounds = (s.distanceM ?? 0) > radiusMeters;
        return (
          <Marker
            key={`student-${idx}-${s.hallTicket || s.name}`}
            position={[s.lat, s.lng]}
            icon={isOutOfBounds ? outOfBoundsIcon : studentIcon}
          >
            <Popup className="custom-popup">
              <div className="font-heading font-semibold text-sm text-slate-800 dark:text-slate-100">{s.name}</div>
              {s.hallTicket && (
                <div className="text-[11px] text-slate-500 font-mono mt-0.5 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded w-fit">
                  {s.hallTicket}
                </div>
              )}
              {s.distanceM != null && (
                <div className={`text-[11px] font-medium mt-1.5 flex items-center gap-1 ${isOutOfBounds ? 'text-rose-500' : 'text-teal-600 dark:text-teal-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOutOfBounds ? 'bg-rose-500' : 'bg-teal-500'}`}></span>
                  {s.distanceM}m {isOutOfBounds ? 'Out of bounds' : 'Within range'}
                </div>
              )}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default LeafletMap;
