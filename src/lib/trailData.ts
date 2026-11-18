export interface TrailDetail {
  id?: string;
  name: string;
  alias?: string;
  mountain: string;
  barangay: string;
  city: string;
  elevation: string;
  distance: string;
  duration: string;
  difficulty: "Easy" | "Moderate" | "Challenging" | "Difficult";
  maxCapacityPerSlot: number;
  timeSlots: string[];
  lat: number;
  lng: number;
  imageUrl: string;
  meetingPoint: {
    name: string;
    description: string;
    landmark: string;
    address: string;
  };
  navigationUrls: {
    googleMaps: string;
    waze: string;
  };
  highlights: string[];
  equipmentNeeded: string[];
  safetyGuidelines: string[];
}

export const TIME_SLOTS = [
  "05:00 AM - Sunrise Trek",
  "07:00 AM - Morning Trek",
  "01:00 PM - Afternoon Trek",
];

export const NNNP_TRAILS_METADATA: Record<string, TrailDetail> = {
  "mt-mandalagan": {
    name: "Mt. Mandalagan (Patag Trail)",
    alias: "Patag Trail",
    mountain: "Mount Mandalagan",
    barangay: "Brgy. Patag",
    city: "Silay City",
    elevation: "1,885 MASL",
    distance: "14.5 km back-and-forth",
    duration: "7 - 9 hours",
    difficulty: "Challenging",
    maxCapacityPerSlot: 15,
    timeSlots: ["05:00 AM - Sunrise Trek", "07:00 AM - Morning Trek"],
    lat: 10.6946,
    lng: 123.1742,
    imageUrl: "/images/trails/mt-mandalagan.jpg",
    meetingPoint: {
      name: "Old Hospital / Patag Eco-Tourism Park",
      description: "DENR Registration and Briefing Center before starting the ascent.",
      landmark: "Old Hospital, Barangay Patag, Silay City",
      address: "Sitio Patag, Brgy. Patag, Silay City, Negros Occidental",
    },
    navigationUrls: {
      googleMaps: "https://www.google.com/maps/search/?api=1&query=10.6946,123.1742",
      waze: "https://waze.com/ul?ll=10.6946,123.1742&navigate=yes",
    },
    highlights: [
      "Tinagong Dagat (Hidden Sea / High Caldera lakebed)",
      "Sulfur vent viewing area and mossy rainforest canopy",
      "Visayan spotted deer & hornbill sanctuary",
    ],
    equipmentNeeded: [
      "Trekking poles",
      "Rain gear / poncho",
      "Sturdy trail shoes with aggressive lugs",
      "Minimum 2L drinking water",
      "Headlamp / flashlight",
    ],
    safetyGuidelines: [
      "Registration and DENR certified guide is mandatory.",
      "Strict 'Leave No Trace' policy enforced.",
      "Weather checks required prior to ascent due to rapid caldera fog.",
    ],
  },
  "mt-silay": {
    name: "Mt. Silay Trail",
    alias: "Campuestohan to Mt. Silay Summit",
    mountain: "Mount Silay",
    barangay: "Brgy. Cabatangan",
    city: "Talisay City",
    elevation: "1,535 MASL",
    distance: "12.0 km",
    duration: "6 - 8 hours",
    difficulty: "Moderate",
    maxCapacityPerSlot: 20,
    timeSlots: ["05:00 AM - Sunrise Trek", "07:00 AM - Morning Trek", "01:00 PM - Afternoon Trek"],
    lat: 10.600000,
    lng: 123.133333,
    imageUrl: "/images/trails/mt-silay.jpg",
    meetingPoint: {
      name: "Sitio Campuestohan / Campuestohan Highland Area",
      description: "Guide dispatch and safety briefing point at 800m elevation.",
      landmark: "Sitio Campuestohan, Barangay Cabatangan",
      address: "Brgy. Cabatangan, Talisay City, Negros Occidental (10°36'N, 123°08'E)",
    },
    navigationUrls: {
      googleMaps: "https://www.google.com/maps/search/?api=1&query=10.600000,123.133333",
      waze: "https://waze.com/ul?ll=10.600000,123.133333&navigate=yes",
    },
    highlights: [
      "WWII Historical bomber plane wreckage site",
      "Panoramic views of Panay Gulf & Bacolod skyline",
      "Geographical vantage of Mt. Mandalagan / Tinagong Dagat Peak",
    ],
    equipmentNeeded: [
      "Trail footwear",
      "Light waterproof jacket",
      "At least 1.5L hydration",
      "Whistle & personal first aid",
    ],
    safetyGuidelines: [
      "Do not tamper with or move artifacts around the aircraft wreckage site.",
      "Maintain trail discipline on steep ridges.",
      "Tinagong Dagat is an intermediate geographical reference; stay on verified Silay trail path.",
    ],
  },
  "mt-canlandog": {
    name: "Mt. Canlandog Trail",
    alias: "Canlandog to Canlandog Peak",
    mountain: "Mount Canlandog",
    barangay: "Brgy. Canlandog",
    city: "Murcia",
    elevation: "987 MASL",
    distance: "9.2 km",
    duration: "4 - 5 hours",
    difficulty: "Moderate",
    maxCapacityPerSlot: 25,
    timeSlots: ["05:00 AM - Sunrise Trek", "07:00 AM - Morning Trek", "01:00 PM - Afternoon Trek"],
    lat: 10.6074,
    lng: 123.1365,
    imageUrl: "/images/trails/mt-marapara.jpg",
    meetingPoint: {
      name: "Barangay Canlandog Center",
      description: "Community tourism station and registration desk at 452m elevation.",
      landmark: "Canlandog Barangay Center (Alternate: Lopez Jaena Route)",
      address: "Brgy. Canlandog, Murcia, Negros Occidental (10.6074°N, 123.1365°E)",
    },
    navigationUrls: {
      googleMaps: "https://www.google.com/maps/search/?api=1&query=10.6074,123.1365",
      waze: "https://waze.com/ul?ll=10.6074,123.1365&navigate=yes",
    },
    highlights: [
      "Ascent to Mount Canlandog Peak (987 MASL)",
      "Highland pine ridges and Bago river tributaries",
      "Optional verified Lopez Jaena jump-off route",
    ],
    equipmentNeeded: [
      "Quick-dry trekking apparel",
      "River crossing sandals or draining trail shoes",
      "Waterproof dry bag for electronics",
    ],
    safetyGuidelines: [
      "Exercise caution during rainy periods as river currents can rise.",
      "Always follow guide instructions at water crossings.",
      "Independent trail from Mt. Marapara; confirm trail entrance before dispatch.",
    ],
  },
  "malatan-og": {
    name: "Malatan-og Viewing Deck to Malatan-og Falls",
    alias: "Malatan-og Falls Trail",
    mountain: "Don Salvador Benedicto Highlands",
    barangay: "Brgy. Kumaliskis",
    city: "Don Salvador Benedicto",
    elevation: "820 MASL to 650 MASL Basin",
    distance: "5.5 km",
    duration: "2 - 3 hours",
    difficulty: "Easy",
    maxCapacityPerSlot: 30,
    timeSlots: ["05:00 AM - Sunrise Trek", "07:00 AM - Morning Trek", "01:00 PM - Afternoon Trek"],
    lat: 10.58755,
    lng: 123.23221,
    imageUrl: "/images/trails/kumalisikis.jpg",
    meetingPoint: {
      name: "Malatan-og Viewing Deck",
      description: "Scenic roadside deck along the Eco-Tourism Highway (Plus Code: H6QJ+2V2).",
      landmark: "Malatan-og Viewing Deck, Eco-Tourism Highway",
      address: "Brgy. Kumaliskis, Don Salvador Benedicto, Negros Occidental (10.58755°N, 123.23221°E)",
    },
    navigationUrls: {
      googleMaps: "https://www.google.com/maps/search/?api=1&query=10.58755,123.23221",
      waze: "https://waze.com/ul?ll=10.58755,123.23221&navigate=yes",
    },
    highlights: [
      "Malatan-og Viewing Deck panoramic canyon views (Plus Code H6QJ+2V2)",
      "Cold mountain river canyon and Malatan-og Falls natural pool (Plus Code 7Q25H6VH+H3)",
      "Lantawan pine tree forest paths",
    ],
    equipmentNeeded: [
      "Comfortable walking shoes or sneakers with grip",
      "Sun protection & light rain jacket",
      "Hydration bottle",
    ],
    safetyGuidelines: [
      "Steps down to the falls can become slippery when damp.",
      "Stay on designated walkways and keep the river basin clean.",
    ],
  },
};

// Aliases for backward compatibility
NNNP_TRAILS_METADATA["mt-marapara"] = NNNP_TRAILS_METADATA["mt-canlandog"];
NNNP_TRAILS_METADATA["kumalisikis"] = NNNP_TRAILS_METADATA["malatan-og"];

export function getTrailMetadata(trailNameOrId?: string | null): TrailDetail {
  if (!trailNameOrId) return NNNP_TRAILS_METADATA["mt-mandalagan"];

  const clean = trailNameOrId.toLowerCase();
  if (clean.includes("mandalagan") || clean.includes("patag")) {
    return NNNP_TRAILS_METADATA["mt-mandalagan"];
  }
  if (clean.includes("silay") || clean.includes("cabatangan")) {
    return NNNP_TRAILS_METADATA["mt-silay"];
  }
  if (clean.includes("canlandog") || clean.includes("marapara")) {
    return NNNP_TRAILS_METADATA["mt-canlandog"];
  }
  if (clean.includes("malatan") || clean.includes("kumalisikis") || clean.includes("kumaliskis") || clean.includes("dsb")) {
    return NNNP_TRAILS_METADATA["malatan-og"];
  }

  return NNNP_TRAILS_METADATA["mt-mandalagan"];
}

export function getTrailImage(trailNameOrId?: string | null): string {
  const meta = getTrailMetadata(trailNameOrId);
  return meta.imageUrl || "/images/trails/mt-mandalagan.jpg";
}
