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

// Custom student marker icon (small teal dot)
const studentIcon = L.divIcon({
  className: '',
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#14b8a6;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// Red out-of-bounds marker
const outOfBoundsIcon = L.divIcon({
  className: '',
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
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
      style={{ height, width: '100%', borderRadius: '12px' }}
      className={className}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      <MapRecenter lat={centerLat} lng={centerLng} zoom={zoom} />

      {/* Click handler for interactive mode */}
      {interactive && onMapClick && <MapClickHandler onClick={onMapClick} />}

      {/* Campus center marker */}
      <Marker position={[centerLat, centerLng]}>
        <Popup>
          <div style={{ fontWeight: 600, fontSize: '13px' }}>Campus Center</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
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
            color: '#14b8a6',
            weight: 2,
            fillColor: '#14b8a6',
            fillOpacity: 0.08,
            dashArray: '6 4',
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
            <Popup>
              <div style={{ fontWeight: 600, fontSize: '12px' }}>{s.name}</div>
              {s.hallTicket && (
                <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                  {s.hallTicket}
                </div>
              )}
              {s.distanceM != null && (
                <div style={{ fontSize: '11px', color: isOutOfBounds ? '#ef4444' : '#14b8a6' }}>
                  {s.distanceM}m {isOutOfBounds ? '(Out of bounds)' : '(Within range)'}
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
