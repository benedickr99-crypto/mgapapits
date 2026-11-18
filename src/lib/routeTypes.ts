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

export interface JumpOffOption {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  isPrimary?: boolean;
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
  destination: {
    name: string;
    lat: number;
    lng: number;
    elevation?: string;
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
// 2. MT. SILAY TRAIL
// Jump-off: Sitio Campuestohan, Barangay Cabatangan, Talisay City (10.7412, 123.1368)
// Destination: Mt. Silay Summit (10.7620, 123.1810)
// Distinct route from Mandalagan!
// -------------------------------------------------------------
export const SILAY_DEFAULT_START: RoutePoint = {
  lat: 10.7412,
  lng: 123.1368, // Cabatangan Ranger Station / Sitio Campuestohan
};

export const SILAY_DEFAULT_DESTINATION: RoutePoint = {
  lat: 10.7620,
  lng: 123.1810, // Mt. Silay Summit Peak
};

export const DEFAULT_SILAY_GPS_POINTS: RoutePoint[] = [
  { lat: 10.7412, lng: 123.1368 }, // Sitio Campuestohan / Cabatangan Ranger Station
  { lat: 10.7455, lng: 123.1445 }, // Campuestohan Highland Ridge
  { lat: 10.7498, lng: 123.1530 }, // Malanog River Crossing
  { lat: 10.7540, lng: 123.1635 }, // WWII Bomber Plane Historical Site
  { lat: 10.7582, lng: 123.1722 }, // Upper Mossy Cloud Forest
  { lat: 10.7620, lng: 123.1810 }, // Mt. Silay Summit Peak
];

export const DEFAULT_SILAY_CHECKPOINTS: CheckpointItem[] = [
  {
    id: "cp-silay-bomber",
    name: "WWII Bomber Plane Wreckage Site",
    lat: 10.7540,
    lng: 123.1635,
    elevation: "1,340 MASL",
    description: "Historical WWII aircraft wreckage site protected under NNNP heritage guidelines.",
  },
  {
    id: "cp-silay-river",
    name: "Malanog River Crossing",
    lat: 10.7498,
    lng: 123.1530,
    elevation: "1,120 MASL",
    description: "Clean river water crossing point with shallow gravel bed.",
  },
];

// -------------------------------------------------------------
// 3. MT. MARAPARA TRAIL
// Jump-off: Barangay Canlandog, Municipality of Murcia (10.6054, 123.0841)
// Destination: Mt. Marapara Summit (10.6150, 123.1495)
// -------------------------------------------------------------
export const MARAPARA_DEFAULT_START: RoutePoint = {
  lat: 10.6054,
  lng: 123.0841, // Brgy. Canlandog Tourism Station, Murcia
};

export const MARAPARA_DEFAULT_DESTINATION: RoutePoint = {
  lat: 10.6150,
  lng: 123.1495, // Mt. Marapara Summit
};

export const DEFAULT_MARAPARA_GPS_POINTS: RoutePoint[] = [
  { lat: 10.6054, lng: 123.0841 }, // Canlandog Tourism Station
  { lat: 10.6078, lng: 123.0975 }, // Bago River Tributary
  { lat: 10.6102, lng: 123.1110 }, // Highland Pine Ridge
  { lat: 10.6125, lng: 123.1265 }, // Marapara Viewdeck Plateau
  { lat: 10.6138, lng: 123.1380 }, // North Ridge Forest Trail
  { lat: 10.6150, lng: 123.1495 }, // Mt. Marapara Summit Peak
];

export const DEFAULT_MARAPARA_CHECKPOINTS: CheckpointItem[] = [
  {
    id: "cp-marapara-river",
    name: "Bago River Tributary Crossing",
    lat: 10.6078,
    lng: 123.0975,
    elevation: "680 MASL",
    description: "River crossing point; heed guide warnings during heavy downpours.",
  },
  {
    id: "cp-marapara-pines",
    name: "Canlandog Pine Tree Grove",
    lat: 10.6102,
    lng: 123.1110,
    elevation: "920 MASL",
    description: "Cool microclimate rest area with shaded canopy.",
  },
];

// -------------------------------------------------------------
// 4. MALATAN-OG FALLS TRAIL
// Trail Name: Malatan-og Viewing Deck to Malatan-og Falls
// Location: Barangay Kumaliskis, Don Salvador Benedicto, Negros Occidental
// Starting Point: Malatan-og Viewing Deck (10.58755, 123.23221)
// Destination: Malatan-og Falls (10.59391, 123.22771)
// EXACT COORDINATES AS SPECIFIED IN USER MASTER PROMPT!
// -------------------------------------------------------------
export const MALATANOG_DEFAULT_START: RoutePoint = {
  lat: 10.58755,
  lng: 123.23221, // Malatan-og Viewing Deck
};

export const MALATANOG_DEFAULT_DESTINATION: RoutePoint = {
  lat: 10.59391,
  lng: 123.22771, // Malatan-og Falls
};

export const DEFAULT_MALATANOG_GPS_POINTS: RoutePoint[] = [
  { lat: 10.58755, lng: 123.23221 }, // Malatan-og Viewing Deck
  { lat: 10.58910, lng: 123.23120 }, // Lantawan Pine Forest Path
  { lat: 10.59080, lng: 123.23010 }, // Mountain Steps Descent
  { lat: 10.59220, lng: 123.22880 }, // Stream Basin Approach
  { lat: 10.59391, lng: 123.22771 }, // Malatan-og Falls Basin
];

export const DEFAULT_MALATANOG_CHECKPOINTS: CheckpointItem[] = [
  {
    id: "cp-malatanog-viewdeck",
    name: "Malatan-og Viewing Deck",
    lat: 10.58755,
    lng: 123.23221,
    elevation: "820 MASL",
    description: "Highway viewdeck overlooking Malatan-og Falls and the canyon.",
  },
  {
    id: "cp-malatanog-basin",
    name: "Malatan-og Falls Natural Pool",
    lat: 10.59391,
    lng: 123.22771,
    elevation: "650 MASL",
    description: "Cold natural waterfall basin surrounded by lush canyon cliffs.",
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
    },
    alternateJumpOffs: [
      {
        id: "campuestohan-mandalagan",
        name: "Sitio Campuestohan, Barangay Cabatangan",
        location: "Talisay City, Negros Occidental",
        lat: 10.7250,
        lng: 123.1450,
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
    location: "Sitio Campuestohan, Barangay Cabatangan, Talisay City",
    mountain: "Mount Silay",
    primaryJumpOff: {
      id: "campuestohan-silay",
      name: "Sitio Campuestohan, Barangay Cabatangan",
      location: "Talisay City, Negros Occidental",
      lat: 10.7412,
      lng: 123.1368,
      isPrimary: true,
    },
    destination: {
      name: "Mt. Silay Summit",
      lat: 10.7620,
      lng: 123.1810,
      elevation: "1,535 MASL",
    },
    defaultPoints: DEFAULT_SILAY_GPS_POINTS,
    defaultCheckpoints: DEFAULT_SILAY_CHECKPOINTS,
    defaultDistanceKm: 12.0,
    estimatedDuration: "6 - 8 hours",
    difficulty: "Moderate",
    safetyReminders: [
      "Do not tamper with or move artifacts at the WWII bomber wreckage site.",
      "Maintain trail discipline on steep ridges and muddy sections.",
    ],
  },
  "mt-marapara": {
    trailKey: "mt-marapara",
    name: "Mt. Marapara Trail",
    dbNamePattern: "Marapara",
    location: "Barangay Canlandog, Municipality of Murcia",
    mountain: "Mount Marapara",
    primaryJumpOff: {
      id: "canlandog-murcia",
      name: "Barangay Canlandog Tourism Station",
      location: "Murcia, Negros Occidental",
      lat: 10.6054,
      lng: 123.0841,
      isPrimary: true,
    },
    destination: {
      name: "Mt. Marapara Summit",
      lat: 10.6150,
      lng: 123.1495,
      elevation: "1,200 MASL",
    },
    defaultPoints: DEFAULT_MARAPARA_GPS_POINTS,
    defaultCheckpoints: DEFAULT_MARAPARA_CHECKPOINTS,
    defaultDistanceKm: 9.2,
    estimatedDuration: "4 - 5 hours",
    difficulty: "Moderate",
    safetyReminders: [
      "River currents can swell rapidly during rainfall.",
      "Always follow the accredited guide's commands during river crossings.",
    ],
  },
  "kumalisikis": {
    trailKey: "kumalisikis",
    name: "Malatan-og Viewing Deck to Malatan-og Falls",
    dbNamePattern: "Kumalisikis",
    location: "Barangay Kumaliskis, Don Salvador Benedicto",
    mountain: "Don Salvador Benedicto Highlands",
    primaryJumpOff: {
      id: "malatanog-viewdeck",
      name: "Malatan-og Viewing Deck",
      location: "Brgy. Kumaliskis, Don Salvador Benedicto",
      lat: 10.58755,
      lng: 123.23221,
      isPrimary: true,
    },
    destination: {
      name: "Malatan-og Falls",
      lat: 10.59391,
      lng: 123.22771,
      elevation: "650 MASL",
    },
    defaultPoints: DEFAULT_MALATANOG_GPS_POINTS,
    defaultCheckpoints: DEFAULT_MALATANOG_CHECKPOINTS,
    defaultDistanceKm: 5.5,
    estimatedDuration: "2 - 3 hours",
    difficulty: "Easy",
    safetyReminders: [
      "Steps down to the falls can become slippery when damp.",
      "Keep to designated walkways and do not litter in the river basin.",
    ],
  },
};
