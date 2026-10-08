"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix webpack icon bug
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface MapProperty {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}
export interface MapPropertyInput {
  id: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

export default function PropertyMapInner({
  properties,
  allProperties,
  label,
}: {
  properties: MapProperty[];
  allProperties: MapPropertyInput[];
  label?: string;
}) {
  // Geocode properties without coordinates once per mount (Nominatim: 1 req/s).
  const initial = useRef(allProperties);
  useEffect(() => {
    const missing = initial.current.filter((p) => !p.latitude);
    missing.forEach(async (p, i) => {
      await new Promise((r) => setTimeout(r, i * 1100));
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(p.address + ", Puerto Rico")}`
      );
      const data = await res.json();
      if (data[0]) {
        await fetch("/api/properties/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: p.id, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }),
        });
      }
    });
  }, []);

  return (
    <div role="region" aria-label={label} className="overflow-hidden rounded-xl border border-border">
      <MapContainer center={[18.2208, -66.5901]} zoom={9} className="z-0 h-96 w-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {properties.map((p) => (
          <Marker key={p.id} position={[p.latitude, p.longitude]}>
            <Popup>
              {p.name}
              <br />
              {p.address}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
