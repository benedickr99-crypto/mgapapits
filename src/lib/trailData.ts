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
    lat: 10.6865,
    lng: 123.1873,
    imageUrl: "/images/trails/mt-mandalagan.jpg",
    meetingPoint: {
      name: "Patag Eco-Tourism Park / DENR Outpost",
      description: "DENR Registration and Briefing Center before starting the ascent.",
      landmark: "Near Patag Hospital Ruins & Eco-Tourism Center",
      address: "Sitio Patag, Brgy. Patag, Silay City, Negros Occidental",
    },
    navigationUrls: {
      googleMaps: "https://www.google.com/maps/search/?api=1&query=10.6865,123.1873",
      waze: "https://waze.com/ul?ll=10.6865,123.1873&navigate=yes",
    },
    highlights: [
      "Tinagong Dagat (Hidden Sea / High Caldera)",
      "Sulfur vent viewing area",
      "Pristine mossy rainforest canopy",
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
    name: "Mt. Silay (Cabatangan Trail)",
    alias: "Cabatangan Trail",
    mountain: "Mount Silay",
    barangay: "Brgy. Cabatangan",
    city: "Talisay City",
    elevation: "1,535 MASL",
    distance: "12.0 km",
    duration: "6 - 8 hours",
    difficulty: "Moderate",
    maxCapacityPerSlot: 20,
    timeSlots: ["05:00 AM - Sunrise Trek", "07:00 AM - Morning Trek", "01:00 PM - Afternoon Trek"],
    lat: 10.7412,
    lng: 123.1368,
    imageUrl: "/images/trails/mt-silay.jpg",
    meetingPoint: {
      name: "Cabatangan Barangay Hall / Forest Ranger Station",
      description: "Meeting hall for guide assignment and safety briefing.",
      landmark: "Adjacent to Cabatangan Elementary School",
      address: "Brgy. Cabatangan, Talisay City, Negros Occidental",
    },
    navigationUrls: {
      googleMaps: "https://www.google.com/maps/search/?api=1&query=10.7412,123.1368",
      waze: "https://waze.com/ul?ll=10.7412,123.1368&navigate=yes",
    },
    highlights: [
      "WWII Historical bomber plane wreckage",
      "Panoramic views of Panay Gulf & Bacolod skyline",
      "Rich endemic bird habitat",
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
    ],
  },
  "mt-marapara": {
    name: "Mt. Marapara (Canlandog Trail)",
    alias: "Canlandog Trail",
    mountain: "Mount Marapara",
    barangay: "Brgy. Canlandog",
    city: "Murcia",
    elevation: "1,200 MASL",
    distance: "9.2 km",
    duration: "4 - 5 hours",
    difficulty: "Moderate",
    maxCapacityPerSlot: 25,
    timeSlots: ["05:00 AM - Sunrise Trek", "07:00 AM - Morning Trek", "01:00 PM - Afternoon Trek"],
    lat: 10.6054,
    lng: 123.0841,
    imageUrl: "/images/trails/mt-marapara.jpg",
    meetingPoint: {
      name: "Canlandog Community Tourism Station",
      description: "Guide dispatch counter and registration desk.",
      landmark: "Near Canlandog Barangay Plaza",
      address: "Brgy. Canlandog, Murcia, Negros Occidental",
    },
    navigationUrls: {
      googleMaps: "https://www.google.com/maps/search/?api=1&query=10.6054,123.0841",
      waze: "https://waze.com/ul?ll=10.6054,123.0841&navigate=yes",
    },
    highlights: [
      "Dense pine groves & highland breeze",
      "Cascading mountain springs & river crossings",
      "Viewdeck overlooking Bago river valley",
    ],
    equipmentNeeded: [
      "Quick-dry trekking apparel",
      "River crossing sandals or draining trail shoes",
      "Waterproof dry bag for electronics",
    ],
    safetyGuidelines: [
      "Exercise caution during rainy periods as river currents can rise.",
      "Always follow guide instructions at water crossings.",
    ],
  },
  "kumalisikis": {
    name: "Kumalisikis Trail",
    alias: "Kumalisikis Nature Path",
    mountain: "Don Salvador Benedicto Highlands",
    barangay: "Brgy. Kumaliskis",
    city: "Don Salvador Benedicto",
    elevation: "950 MASL",
    distance: "5.5 km",
    duration: "2 - 3 hours",
    difficulty: "Easy",
    maxCapacityPerSlot: 30,
    timeSlots: ["05:00 AM - Sunrise Trek", "07:00 AM - Morning Trek", "01:00 PM - Afternoon Trek"],
    lat: 10.5698,
    lng: 123.2384,
    imageUrl: "/images/trails/kumalisikis.jpg",
    meetingPoint: {
      name: "DSB Tourist Assistance & Tourism Center",
      description: "Scenic outpost with parking and registration amenities.",
      landmark: "Along Eco-Tourism Highway beside DSB Welcome Arch",
      address: "Brgy. Kumaliskis, Don Salvador Benedicto, Negros Occidental",
    },
    navigationUrls: {
      googleMaps: "https://www.google.com/maps/search/?api=1&query=10.5698,123.2384",
      waze: "https://waze.com/ul?ll=10.5698,123.2384&navigate=yes",
    },
    highlights: [
      "Lantawan Viewdeck & pine tree lined highway",
      "Malatan-og and Mag-aso waterfalls viewing points",
      "Gentle walking paths suitable for families & beginners",
    ],
    equipmentNeeded: [
      "Comfortable walking shoes or sneakers",
      "Sun protection (hat, sunscreen)",
      "Hydration bottle",
    ],
    safetyGuidelines: [
      "Stay on designated trails.",
      "Properly dispose of all trash in designated bins.",
    ],
  },
};

export function getTrailMetadata(trailNameOrId?: string | null): TrailDetail {
  if (!trailNameOrId) return NNNP_TRAILS_METADATA["mt-mandalagan"];

  const clean = trailNameOrId.toLowerCase();
  if (clean.includes("mandalagan") || clean.includes("patag")) {
    return NNNP_TRAILS_METADATA["mt-mandalagan"];
  }
  if (clean.includes("silay") || clean.includes("cabatangan")) {
    return NNNP_TRAILS_METADATA["mt-silay"];
  }
  if (clean.includes("marapara") || clean.includes("canlandog")) {
    return NNNP_TRAILS_METADATA["mt-marapara"];
  }
  if (clean.includes("kumalisikis") || clean.includes("kumaliskis") || clean.includes("dsb")) {
    return NNNP_TRAILS_METADATA["kumalisikis"];
  }

  return NNNP_TRAILS_METADATA["mt-mandalagan"];
}

export function getTrailImage(trailNameOrId?: string | null): string {
  const meta = getTrailMetadata(trailNameOrId);
  return meta.imageUrl || "/images/trails/mt-mandalagan.jpg";
}
