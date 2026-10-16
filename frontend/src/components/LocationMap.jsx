import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [17.385, 78.4867];
const ROUTE_COLORS = ["#147d64", "#3157d5", "#c2410c"];

function RecenterMap({ location }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), 15));
    }
  }, [location, map]);

  return null;
}

function FitRoutes({ routes }) {
  const map = useMap();

  useEffect(() => {
    const points = routes.flatMap((route) => route.geometry || []);
    if (points.length > 1) {
      map.fitBounds(points, { padding: [24, 24] });
    }
  }, [map, routes]);

  return null;
}

export default function LocationMap({
  location,
  routes = [],
  selectedRouteId,
  origin,
  destination
}) {
  return (
    <MapContainer className="location-map" center={DEFAULT_CENTER} zoom={14}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterMap location={location} />
      <FitRoutes routes={routes} />
      {routes.map((route, index) => (
        <Polyline
          key={route.route_id}
          positions={route.geometry}
          pathOptions={{
            color: ROUTE_COLORS[index % ROUTE_COLORS.length],
            opacity: route.route_id === selectedRouteId ? 0.95 : 0.5,
            weight: route.route_id === selectedRouteId ? 7 : 4
          }}
        >
          <Popup>
            {route.name} · {route.distance_km} km · about {route.duration_minutes} min on foot
          </Popup>
        </Polyline>
      ))}
      {origin && (
        <CircleMarker
          center={[origin.lat, origin.lon]}
          radius={8}
          pathOptions={{ color: "#ffffff", fillColor: "#147d64", fillOpacity: 1, weight: 2 }}
        >
          <Popup>Start: {origin.label}</Popup>
        </CircleMarker>
      )}
      {destination && (
        <CircleMarker
          center={[destination.lat, destination.lon]}
          radius={8}
          pathOptions={{ color: "#ffffff", fillColor: "#c2410c", fillOpacity: 1, weight: 2 }}
        >
          <Popup>Destination: {destination.label}</Popup>
        </CircleMarker>
      )}
      {location && (
        <CircleMarker
          center={[location.lat, location.lng]}
          radius={10}
          pathOptions={{ color: "#ffffff", fillColor: "#c2410c", fillOpacity: 1, weight: 3 }}
        >
          <Popup>Your current location</Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}