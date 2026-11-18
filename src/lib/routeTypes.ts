export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface CheckpointItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevation?: string;
  description?: string;
}

export interface TrailGeoJSON {
  type: "FeatureCollection";
  features: [
    {
      type: "Feature";
      geometry: {
        type: "LineString";
        coordinates: [number, number][]; // [longitude, latitude]
      };
      properties: {
        name: string;
        distance_km: number;
        stroke?: string;
      };
    },
    ...{
      type: "Feature";
      geometry: {
        type: "Point";
        coordinates: [number, number]; // [longitude, latitude]
      };
      properties: {
        name: string;
        pointType: "start" | "destination" | "checkpoint";
        elevation?: string;
        description?: string;
      };
    }[]
  ];
}

/**
 * Calculates haversine distance between two lat/lng coordinates in km
 */
export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates total route distance along a series of points
 */
export function calculateTotalDistance(points: RoutePoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateHaversineKm(
      points[i].lat,
      points[i].lng,
      points[i + 1].lat,
      points[i + 1].lng
    );
  }
  return Number(total.toFixed(2));
}

/**
 * Mount Mandalagan official reference points
 */
export const MANDALAGAN_DEFAULT_START: RoutePoint = {
  lat: 10.6946,
  lng: 123.1742, // Old Hospital, Barangay Patag, Silay City
};

export const MANDALAGAN_DEFAULT_DESTINATION: RoutePoint = {
  lat: 10.6375,
  lng: 123.2358, // Mount Mandalagan Summit
};

/**
 * Verified default route points connecting Old Hospital, Patag to Mt. Mandalagan Summit
 * through verified terrain (including Tinagong Dagat caldera).
 */
export const DEFAULT_MANDALAGAN_GPS_POINTS: RoutePoint[] = [
  { lat: 10.6946, lng: 123.1742 }, // Old Hospital, Barangay Patag
  { lat: 10.6908, lng: 123.1785 }, // Camp 1 Rainforest Junction
  { lat: 10.6842, lng: 123.1865 }, // Alor Stream / Mossy Forest Entrance
  { lat: 10.6755, lng: 123.1942 }, // Ridge Trail Lookout
  { lat: 10.6680, lng: 123.2025 }, // Bamboo Gully Ascent
  { lat: 10.6592, lng: 123.2118 }, // Tinagong Dagat Caldera Entry
  { lat: 10.6515, lng: 123.2190 }, // Tinagong Dagat Main Campsite / Lake bed
  { lat: 10.6442, lng: 123.2275 }, // South Rim Saddle
  { lat: 10.6375, lng: 123.2358 }, // Mount Mandalagan Summit (Peak)
];

export const DEFAULT_MANDALAGAN_CHECKPOINTS: CheckpointItem[] = [
  {
    id: "cp-tinagong-dagat",
    name: "Tinagong Dagat (Hidden Sea Caldera)",
    lat: 10.6515,
    lng: 123.2190,
    elevation: "1,550 MASL",
    description: "High mountain caldera lakebed surrounded by pristine mossy forest. Ideal basecamp location.",
  },
  {
    id: "cp-alor-stream",
    name: "Alor Stream / Water Source",
    lat: 10.6842,
    lng: 123.1865,
    elevation: "980 MASL",
    description: "First primary natural spring water refilling point after leaving Patag proper.",
  },
];
