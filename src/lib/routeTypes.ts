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

export interface ReferenceLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevation?: string;
  description: string;
  originalRef?: string;
}

export interface JumpOffOption {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  elevation?: string;
  isPrimary?: boolean;
  notes?: string;
}

export type TrailRouteStatus = "draft" | "pending_verification" | "published" | "inactive";

export interface TrailRouteConfig {
  trailKey: string;
  name: string;
  dbNamePattern: string;
  location: string;
  mountain: string;
  primaryJumpOff: JumpOffOption;
  alternateJumpOffs?: JumpOffOption[];
  referenceLocations?: ReferenceLocation[];
  destination: {
    name: string;
    lat: number;
    lng: number;
    elevation?: string;
    originalRef?: string;
  };
  defaultPoints: RoutePoint[];
  defaultCheckpoints: CheckpointItem[];
  defaultDistanceKm: number;
  estimatedDuration: string;
  difficulty: "Easy" | "Moderate" | "Challenging" | "Difficult";
  safetyReminders: string[];
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
        pointType: "start" | "destination" | "checkpoint" | "reference";
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

// -------------------------------------------------------------
// 1. MT. MANDALAGAN TRAIL
// Primary Jump-off: Old Hospital, Brgy. Patag, Silay City (10.6946, 123.1742)
// Alternate Jump-off: Sitio Campuestohan, Brgy. Cabatangan, Talisay City (10.7250, 123.1450)
// Destination: Mt. Mandalagan Summit (10.6375, 123.2358)
// Checkpoint: Tinagong Dagat (10.6515, 123.2190)
// -------------------------------------------------------------
export const MANDALAGAN_DEFAULT_START: RoutePoint = {
  lat: 10.6946,
  lng: 123.1742, // Old Hospital, Barangay Patag, Silay City
};

export const MANDALAGAN_CAMPUESTOHAN_START: RoutePoint = {
  lat: 10.7250,
  lng: 123.1450, // Sitio Campuestohan, Barangay Cabatangan, Talisay City
};

export const MANDALAGAN_DEFAULT_DESTINATION: RoutePoint = {
  lat: 10.6375,
  lng: 123.2358, // Mount Mandalagan Summit
};

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
    description: "High mountain caldera lakebed surrounded by pristine mossy forest. Verified basecamp location.",
  },
  {
    id: "cp-alor-stream",
    name: "Alor Stream / Water Source",
    lat: 10.6842,
    lng: 123.1865,
    elevation: "980 MASL",
    description: "First primary natural spring water refilling point after leaving Patag proper.",
  },
  {
    id: "cp-camp-one",
    name: "Camp 1 Rainforest Rest Stop",
    lat: 10.6908,
    lng: 123.1785,
    elevation: "820 MASL",
    description: "Junction between community trails and dense mountain canopy.",
  },
];

// -------------------------------------------------------------
// 2. MT. SILAY TRAIL (Exact coordinates from Master Prompt)
// Starting Point: Sitio Campuestohan / Campuestohan Highland Resort area,
// Barangay Cabatangan, Talisay City (10.600000, 123.133333, ~800m elevation)
// Intermediate Reference Location: Mt. Mandalagan / Tinagong Dagat Peak
// (10.664444, 123.220000, ~1,510–1,683 MASL)
// Destination: Mt. Silay Summit (10.770319, 123.232801, ~1,535 MASL)
// -------------------------------------------------------------
export const SILAY_DEFAULT_START: RoutePoint = {
  lat: 10.600000,
  lng: 123.133333, // Sitio Campuestohan / Highland Resort area, Brgy. Cabatangan (10°36'N, 123°08'E)
};

export const SILAY_DEFAULT_DESTINATION: RoutePoint = {
  lat: 10.770319,
  lng: 123.232801, // Mt. Silay Summit (10°46'13"N, 123°14'01"E)
};

export const SILAY_REFERENCE_LOCATIONS: ReferenceLocation[] = [
  {
    id: "ref-tinagong-dagat-peak",
    name: "Mt. Mandalagan / Tinagong Dagat Peak",
    lat: 10.664444,
    lng: 123.220000,
    elevation: "1,510 - 1,683 MASL",
    originalRef: "10°39'52\"N, 123°13'12\"E",
    description: "Geographical reference point. Only included in the route if the actual hiking path passes through it and is verified.",
  },
];

export const DEFAULT_SILAY_GPS_POINTS: RoutePoint[] = [
  { lat: 10.600000, lng: 123.133333 }, // Sitio Campuestohan Entrance (800m)
  { lat: 10.638500, lng: 123.158200 }, // Cabatangan Upper Ridge
  { lat: 10.685000, lng: 123.185000 }, // North Mountain Saddle
  { lat: 10.732000, lng: 123.211000 }, // Malanog River Basin Approach
  { lat: 10.754000, lng: 123.223500 }, // WWII Bomber Plane Historical Site
  { lat: 10.770319, lng: 123.232801 }, // Mt. Silay Summit Peak (1,535 MASL)
];

export const DEFAULT_SILAY_CHECKPOINTS: CheckpointItem[] = [
  {
    id: "cp-silay-bomber",
    name: "WWII Bomber Plane Wreckage Site",
    lat: 10.754000,
    lng: 123.223500,
    elevation: "1,340 MASL",
    description: "Historical WWII aircraft wreckage site protected under NNNP heritage guidelines.",
  },
  {
    id: "cp-cabatangan-ridge",
    name: "Cabatangan Highland Outlook",
    lat: 10.638500,
    lng: 123.158200,
    elevation: "1,050 MASL",
    description: "Ridge viewpoint overlooking Talisay and Bacolod plains.",
  },
];

// -------------------------------------------------------------
// 3. MT. CANLANDOG TRAIL (Exact coordinates from Master Prompt)
// Location: Barangay Canlandog, Municipality of Murcia, Negros Occidental
// Starting Point: Barangay Canlandog Center, Murcia (10.6074, 123.1365, ~452m)
// Destination: Mount Canlandog Peak (10.608238, 123.145951, ~987m)
// Alternate Jump-off: Lopez Jaena Route, near Agrilog Transloading Station
// -------------------------------------------------------------
export const CANLANDOG_DEFAULT_START: RoutePoint = {
  lat: 10.6074,
  lng: 123.1365, // Barangay Canlandog Center, Murcia (~452m)
};

export const CANLANDOG_LOPEZ_JAENA_START: RoutePoint = {
  lat: 10.6025,
  lng: 123.1250, // Lopez Jaena Route / near Agrilog Transloading Station
};

export const CANLANDOG_DEFAULT_DESTINATION: RoutePoint = {
  lat: 10.608238,
  lng: 123.145951, // Mount Canlandog Peak (~987m)
};

export const DEFAULT_CANLANDOG_GPS_POINTS: RoutePoint[] = [
  { lat: 10.607400, lng: 123.136500 }, // Barangay Canlandog Center (452m)
  { lat: 10.607650, lng: 123.139200 }, // Canlandog Pine Grove Trail
  { lat: 10.607900, lng: 123.142400 }, // Bago River Stream Crossing
  { lat: 10.608238, lng: 123.145951 }, // Mount Canlandog Peak (987m)
];

export const DEFAULT_CANLANDOG_CHECKPOINTS: CheckpointItem[] = [
  {
    id: "cp-canlandog-stream",
    name: "Canlandog Stream Crossing",
    lat: 10.607900,
    lng: 123.142400,
    elevation: "620 MASL",
    description: "Mountain stream crossing; exercise caution after rain.",
  },
  {
    id: "cp-canlandog-pine",
    name: "Canlandog Pine Tree Ridge",
    lat: 10.607650,
    lng: 123.139200,
    elevation: "550 MASL",
    description: "Cool pine grove rest stop along the ascent path.",
  },
];

// -------------------------------------------------------------
// 4. MALATAN-OG VIEWING DECK TO MALATAN-OG FALLS (Exact coordinates & Plus Code)
// Location: Barangay Kumaliskis, Don Salvador Benedicto, Negros Occidental
// Starting Point: Malatan-og Viewing Deck along Eco-Tourism Highway
// Starting Coordinates: 10.58755, 123.23221 (Plus Code: H6QJ+2V2)
// Destination: Malatan-og Falls: 10.59391, 123.22771 (Plus Code: 7Q25H6VH+H3)
// -------------------------------------------------------------
export const MALATANOG_DEFAULT_START: RoutePoint = {
  lat: 10.58755,
  lng: 123.23221, // Malatan-og Viewing Deck (Plus Code: H6QJ+2V2)
};

export const MALATANOG_DEFAULT_DESTINATION: RoutePoint = {
  lat: 10.59391,
  lng: 123.22771, // Malatan-og Falls (Plus Code: 7Q25H6VH+H3)
};

export const DEFAULT_MALATANOG_GPS_POINTS: RoutePoint[] = [
  { lat: 10.58755, lng: 123.23221 }, // Malatan-og Viewing Deck (H6QJ+2V2)
  { lat: 10.58910, lng: 123.23120 }, // Lantawan Pine Forest Path
  { lat: 10.59080, lng: 123.23010 }, // Mountain Steps Descent
  { lat: 10.59220, lng: 123.22880 }, // Stream Basin Approach
  { lat: 10.59391, lng: 123.22771 }, // Malatan-og Falls Basin (7Q25H6VH+H3)
];

export const DEFAULT_MALATANOG_CHECKPOINTS: CheckpointItem[] = [
  {
    id: "cp-malatanog-viewdeck",
    name: "Malatan-og Viewing Deck (H6QJ+2V2)",
    lat: 10.58755,
    lng: 123.23221,
    elevation: "820 MASL",
    description: "Highway viewing deck overlooking the canyon and waterfall entrance.",
  },
  {
    id: "cp-malatanog-basin",
    name: "Malatan-og Falls Natural Pool (7Q25H6VH+H3)",
    lat: 10.59391,
    lng: 123.22771,
    elevation: "650 MASL",
    description: "Cold mountain waterfall basin surrounded by lush vertical canyon cliffs.",
  },
];

// -------------------------------------------------------------
// MASTER TRAIL ROUTE CONFIGS DICTIONARY
// -------------------------------------------------------------
export const FOUR_TRAILS_CONFIG: Record<string, TrailRouteConfig> = {
  "mt-mandalagan": {
    trailKey: "mt-mandalagan",
    name: "Mt. Mandalagan Trail",
    dbNamePattern: "Mandalagan",
    location: "Barangay Patag, Silay City & Talisay City",
    mountain: "Mount Mandalagan",
    primaryJumpOff: {
      id: "patag-old-hospital",
      name: "Old Hospital, Barangay Patag",
      location: "Silay City, Negros Occidental",
      lat: 10.6946,
      lng: 123.1742,
      isPrimary: true,
      elevation: "800 MASL",
    },
    alternateJumpOffs: [
      {
        id: "campuestohan-mandalagan",
        name: "Sitio Campuestohan, Barangay Cabatangan",
        location: "Talisay City, Negros Occidental",
        lat: 10.7250,
        lng: 123.1450,
        elevation: "850 MASL",
      },
    ],
    destination: {
      name: "Mt. Mandalagan Summit",
      lat: 10.6375,
      lng: 123.2358,
      elevation: "1,885 MASL",
    },
    defaultPoints: DEFAULT_MANDALAGAN_GPS_POINTS,
    defaultCheckpoints: DEFAULT_MANDALAGAN_CHECKPOINTS,
    defaultDistanceKm: 14.5,
    estimatedDuration: "7 - 9 hours",
    difficulty: "Challenging",
    safetyReminders: [
      "Registration and DENR certified guide is mandatory before ascending.",
      "Tinagong Dagat high caldera experiences sudden afternoon fog.",
      "Strict 'Leave No Trace' policy enforced across all protected zones.",
    ],
  },
  "mt-silay": {
    trailKey: "mt-silay",
    name: "Mt. Silay Trail",
    dbNamePattern: "Silay",
    location: "Northern Negros Natural Park, Negros Occidental",
    mountain: "Mount Silay",
    primaryJumpOff: {
      id: "campuestohan-silay-main",
      name: "Sitio Campuestohan / Campuestohan Highland Area",
      location: "Barangay Cabatangan, Talisay City (10°36'N, 123°08'E)",
      lat: 10.600000,
      lng: 123.133333,
      elevation: "800 MASL",
      isPrimary: true,
      notes: "Starting coordinates verified: 10.600000, 123.133333 (~800m elevation)",
    },
    referenceLocations: SILAY_REFERENCE_LOCATIONS,
    destination: {
      name: "Mt. Silay Summit",
      lat: 10.770319,
      lng: 123.232801,
      elevation: "1,535 MASL",
      originalRef: "10°46'13\"N, 123°14'01\"E",
    },
    defaultPoints: DEFAULT_SILAY_GPS_POINTS,
    defaultCheckpoints: DEFAULT_SILAY_CHECKPOINTS,
    defaultDistanceKm: 12.0,
    estimatedDuration: "6 - 8 hours",
    difficulty: "Moderate",
    safetyReminders: [
      "Tinagong Dagat is an intermediate geographical reference; do not include unless verified on the path.",
      "Do not tamper with or move artifacts at the WWII bomber wreckage site.",
      "Maintain trail discipline on steep ridges and muddy sections.",
    ],
  },
  "mt-canlandog": {
    trailKey: "mt-canlandog",
    name: "Mt. Canlandog Trail",
    dbNamePattern: "Canlandog",
    location: "Barangay Canlandog, Municipality of Murcia, Negros Occidental",
    mountain: "Mount Canlandog",
    primaryJumpOff: {
      id: "canlandog-center-main",
      name: "Barangay Canlandog Center, Murcia",
      location: "Brgy. Canlandog, Murcia, Negros Occidental",
      lat: 10.6074,
      lng: 123.1365,
      elevation: "452 MASL",
      isPrimary: true,
      notes: "Starting point at Barangay Canlandog Center (10.6074°N, 123.1365°E, ~452m)",
    },
    alternateJumpOffs: [
      {
        id: "lopez-jaena-route",
        name: "Lopez Jaena Route (near Agrilog Transloading Station)",
        location: "Bacolod–Murcia–Don Salvador Benedicto–San Carlos Road",
        lat: 10.6025,
        lng: 123.1250,
        elevation: "420 MASL",
        notes: "Possible additional jump-off option; exact entrance verified prior to departure.",
      },
    ],
    destination: {
      name: "Mount Canlandog Peak",
      lat: 10.608238,
      lng: 123.145951,
      elevation: "987 MASL",
    },
    defaultPoints: DEFAULT_CANLANDOG_GPS_POINTS,
    defaultCheckpoints: DEFAULT_CANLANDOG_CHECKPOINTS,
    defaultDistanceKm: 3.8,
    estimatedDuration: "2 - 3 hours",
    difficulty: "Moderate",
    safetyReminders: [
      "Do not assume the barangay center is the actual trail entrance; verify trail dispatch point.",
      "River currents can swell rapidly during rainfall.",
      "Keep this trail separate from Mt. Marapara and other mountain trails.",
    ],
  },
  "malatan-og": {
    trailKey: "malatan-og",
    name: "Malatan-og Viewing Deck to Malatan-og Falls",
    dbNamePattern: "Malatan",
    location: "Barangay Kumaliskis, Don Salvador Benedicto, Negros Occidental",
    mountain: "Don Salvador Benedicto Highlands",
    primaryJumpOff: {
      id: "malatanog-viewdeck-main",
      name: "Malatan-og Viewing Deck (Plus Code: H6QJ+2V2)",
      location: "Eco-Tourism Highway, Brgy. Kumaliskis, DSB",
      lat: 10.58755,
      lng: 123.23221,
      elevation: "820 MASL",
      isPrimary: true,
      notes: "Starting coordinates 10.58755, 123.23221 match Viewing Deck Plus Code H6QJ+2V2.",
    },
    destination: {
      name: "Malatan-og Falls (Plus Code: 7Q25H6VH+H3)",
      lat: 10.59391,
      lng: 123.22771,
      elevation: "650 MASL",
    },
    defaultPoints: DEFAULT_MALATANOG_GPS_POINTS,
    defaultCheckpoints: DEFAULT_MALATANOG_CHECKPOINTS,
    defaultDistanceKm: 2.2,
    estimatedDuration: "1.5 - 2.5 hours",
    difficulty: "Easy",
    safetyReminders: [
      "Steps down to the falls can become slippery when damp.",
      "Stay on designated walkways and do not litter in the river basin.",
    ],
  },
};

// Aliases for compatibility
FOUR_TRAILS_CONFIG["mt-marapara"] = FOUR_TRAILS_CONFIG["mt-canlandog"];
FOUR_TRAILS_CONFIG["kumalisikis"] = FOUR_TRAILS_CONFIG["malatan-og"];
