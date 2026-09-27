import { supabase } from "@/integrations/supabase/client";
import { NNNP_TRAILS_METADATA } from "./trailData";

export interface ParticipantInput {
  fullName: string;
  age: number;
  gender: string;
  contactNumber: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalConditions?: string;
}

export interface BookingSubmission {
  userId: string;
  trailId: string;
  trailName: string;
  trekkingDate: string; // YYYY-MM-DD
  timeSlot: string;     // e.g. "05:00 AM - Sunrise Trek"
  participantsCount: number;
  guideId?: string | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalNotes?: string;
  participants: ParticipantInput[];
  validIdUrl?: string;
  waiverUrl?: string;
  medicalCertUrl?: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  priority: "Low" | "Normal" | "Urgent" | "Critical";
  category: "Weather" | "Advisory" | "Maintenance" | "Event";
  published_at: string;
  is_active: boolean;
}

export interface RatingReviewItem {
  id: string;
  booking_id: string;
  user_id: string;
  user_name?: string;
  guide_id?: string | null;
  guide_name?: string | null;
  trail_id: string;
  trail_name?: string;
  trail_rating: number;
  guide_rating?: number;
  overall_rating: number;
  feedback_text: string;
  created_at: string;
}

// Generate human-friendly NNNP reference number
export function generateReferenceNumber(): string {
  const year = new Date().getFullYear();
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `NNNP-${year}-${randomPart}`;
}

// Check capacity for a trail, date, and time slot
export async function checkSlotCapacity(trailId: string, climbDate: string, timeSlot: string, maxCapacity = 20) {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, group_size, status, permit_number")
      .eq("trail_id", trailId)
      .eq("climb_date", climbDate)
      .neq("status", "cancelled")
      .neq("status", "rejected");

    if (error) {
      console.warn("Capacity check fallback:", error);
      return { booked: 0, available: maxCapacity, isFull: false };
    }

    const booked = (data || []).reduce((sum, b: any) => sum + (b.group_size || 1), 0);
    const available = Math.max(0, maxCapacity - booked);

    return {
      booked,
      available,
      isFull: available <= 0,
    };
  } catch (err) {
    return { booked: 0, available: maxCapacity, isFull: false };
  }
}

// Fetch available tour guides for date & slot with double-booking check
export async function fetchAvailableGuides(date: string, timeSlot?: string) {
  try {
    // 1. Fetch all profiles with role = 'guide'
    const { data: guides, error: guideError } = await supabase
      .from("profiles")
      .select("id, full_name, phone, image_url, bio, experience_years, certifications")
      .eq("role", "guide");

    if (guideError || !guides) {
      console.warn("Error fetching guides:", guideError);
      return [];
    }

    // 2. Fetch guide bookings for that date
    const { data: bookedGuides } = await supabase
      .from("bookings")
      .select("guide_id, status, notes")
      .eq("climb_date", date)
      .not("guide_id", "is", null)
      .neq("status", "cancelled")
      .neq("status", "rejected");

    // 3. Mark availability: if guide has booking on that date
    const bookedGuideIds = new Set((bookedGuides || []).map((b: any) => b.guide_id));

    return guides.map((guide) => ({
      ...guide,
      isAvailable: !bookedGuideIds.has(guide.id),
      conflictCount: (bookedGuides || []).filter((b: any) => b.guide_id === guide.id).length,
    }));
  } catch (err) {
    console.warn("fetchAvailableGuides error:", err);
    return [];
  }
}

// Create Online Trekking Booking with Participants
export async function createOnlineBooking(submission: BookingSubmission) {
  const referenceNumber = generateReferenceNumber();

  // Create clean, human-readable summary of participants for direct viewing in database Table Editor
  const participantListText = (submission.participants || [])
    .map(
      (p, idx) =>
        `${idx + 1}. ${p.fullName} | Age: ${p.age || "N/A"} | Gender: ${p.gender || "N/A"} | Phone: ${p.contactNumber || "N/A"} | Emergency: ${p.emergencyContactName || submission.emergencyContactName} (${p.emergencyContactPhone || submission.emergencyContactPhone}) | Medical: ${p.medicalConditions || "None"}`
    )
    .join("\n");

  const formattedNotes = [
    `TIME SLOT: ${submission.timeSlot}`,
    `PERMIT / REF: ${referenceNumber}`,
    `EMERGENCY CONTACT: ${submission.emergencyContactName} (${submission.emergencyContactPhone})`,
    submission.medicalNotes ? `GENERAL MEDICAL NOTES: ${submission.medicalNotes}` : null,
    `\nPARTICIPANTS ROSTER (${submission.participantsCount} pax):\n${participantListText}`,
    `\n---METADATA_JSON---`,
    JSON.stringify({
      timeSlot: submission.timeSlot,
      referenceNumber,
      emergencyContactName: submission.emergencyContactName,
      emergencyContactPhone: submission.emergencyContactPhone,
      medicalNotes: submission.medicalNotes || "",
      participants: submission.participants,
    }),
  ]
    .filter(Boolean)
    .join("\n");

  // 1. Prepare base booking payload guaranteed compatible with public.bookings
  const basePayload: any = {
    user_id: submission.userId,
    trail_id: submission.trailId,
    climb_date: submission.trekkingDate,
    group_size: submission.participantsCount,
    status: "pending",
    guide_id: submission.guideId || null,
    permit_number: referenceNumber,
    emergency_contact_name: submission.emergencyContactName,
    emergency_contact_phone: submission.emergencyContactPhone,
    notes: formattedNotes,
    valid_id_url: submission.validIdUrl || null,
    waiver_url: submission.waiverUrl || null,
    medical_cert_url: submission.medicalCertUrl || null,
  };

  let bookingData: any = null;

  // Try extended schema first (if migration with time_slot, reference_number has been run)
  try {
    const extendedPayload = {
      ...basePayload,
      time_slot: submission.timeSlot,
      reference_number: referenceNumber,
      medical_notes: submission.medicalNotes || "",
    };

    const { data: extData, error: extErr } = await supabase
      .from("bookings")
      .insert(extendedPayload)
      .select()
      .single();

    if (!extErr && extData) {
      bookingData = extData;
    }
  } catch (e) {
    // Continue to standard insert
  }

  // If extended insert failed or skipped, insert with standard columns
  if (!bookingData) {
    const { data: stdData, error: stdErr } = await supabase
      .from("bookings")
      .insert(basePayload)
      .select()
      .single();

    if (stdErr) {
      console.error("Booking insert error in Supabase:", stdErr);
      throw stdErr;
    }
    bookingData = stdData;
  }

  // 2. Try inserting individual rows into booking_participants table if it exists
  if (bookingData && submission.participants && submission.participants.length > 0) {
    try {
      const participantRows = submission.participants.map((p) => ({
        booking_id: bookingData.id,
        full_name: p.fullName,
        age: p.age,
        gender: p.gender,
        contact_number: p.contactNumber,
        emergency_contact_name: p.emergencyContactName || submission.emergencyContactName,
        emergency_contact_phone: p.emergencyContactPhone || submission.emergencyContactPhone,
        medical_conditions: p.medicalConditions || "None",
      }));

      await (supabase as any)
        .from("booking_participants")
        .insert(participantRows);
    } catch (partErr) {
      console.warn("booking_participants table not available yet (notes column used):", partErr);
    }
  }

  // 3. Insert notification into notifications table in database
  try {
    await supabase.from("notifications").insert({
      user_id: submission.userId,
      title: "Booking Submitted",
      message: `Your booking (Permit: ${referenceNumber}) for ${submission.trailName || "Trail"} on ${submission.trekkingDate} (${submission.timeSlot}) has been registered and is pending DENR review.`,
      type: "booking",
      read: false,
    });
  } catch (notifErr) {
    console.warn("Could not insert notification into database:", notifErr);
  }

  // 4. Save to local storage as local cache
  saveLocalParticipants(bookingData.id, submission.participants, referenceNumber, submission.timeSlot);

  return { ...bookingData, reference_number: referenceNumber, time_slot: submission.timeSlot };
}

// Local storage fallback for participants as local cache
function saveLocalParticipants(bookingId: string, participants: ParticipantInput[], refNumber: string, timeSlot: string) {
  try {
    const key = `nnnp_participants_${bookingId}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        bookingId,
        referenceNumber: refNumber,
        timeSlot,
        participants,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("Local participant save failed:", err);
  }
}

export function getLocalParticipants(bookingId: string): ParticipantInput[] | null {
  try {
    const raw = localStorage.getItem(`nnnp_participants_${bookingId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.participants || null;
    }
  } catch (err) {
    // Ignore
  }
  return null;
}

// Universal extractor: Reads participants from database booking.notes or booking_participants or local cache
export function getBookingParticipants(booking: any): ParticipantInput[] | null {
  if (!booking) return null;

  // 1. Check if booking already has participants array
  if (Array.isArray(booking.participants) && booking.participants.length > 0) {
    return booking.participants;
  }

  // 2. Parse from booking.notes where we embed METADATA_JSON or participants
  if (booking.notes) {
    try {
      if (booking.notes.includes("---METADATA_JSON---")) {
        const jsonStr = booking.notes.split("---METADATA_JSON---")[1]?.trim();
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed.participants) && parsed.participants.length > 0) {
            return parsed.participants;
          }
        }
      }
      if (booking.notes.trim().startsWith("{") && booking.notes.trim().endsWith("}")) {
        const parsed = JSON.parse(booking.notes);
        if (Array.isArray(parsed.participants)) return parsed.participants;
      }
    } catch (e) {}
  }

  // 3. Fallback to localStorage
  return getLocalParticipants(booking.id || booking.bookingId);
}

// Universal extractor: Reads time slot from database
export function getBookingTimeSlot(booking: any): string {
  if (!booking) return "06:00 AM - Standard Trek";
  if (booking.time_slot) return booking.time_slot;
  if (booking.notes) {
    try {
      if (booking.notes.includes("---METADATA_JSON---")) {
        const jsonStr = booking.notes.split("---METADATA_JSON---")[1]?.trim();
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (parsed.timeSlot) return parsed.timeSlot;
        }
      }
      const match = booking.notes.match(/TIME SLOT:\s*([^\n\r]+)/i) || booking.notes.match(/Time Slot:\s*([^.]+)/);
      if (match) return match[1].trim();
    } catch (e) {}
  }
  return "06:00 AM - Standard Trek";
}

// Universal extractor: Reads reference / permit number from database
export function getBookingReferenceNumber(booking: any): string {
  if (!booking) return "NNNP-BOOKING";
  if (booking.permit_number) return booking.permit_number;
  if (booking.reference_number) return booking.reference_number;
  if (booking.notes) {
    const match = booking.notes.match(/PERMIT \/ REF:\s*([^\n\r]+)/i);
    if (match) return match[1].trim();
  }
  const year = booking.created_at ? new Date(booking.created_at).getFullYear() : new Date().getFullYear();
  const idPart = (booking.id || "").substring(0, 5).toUpperCase();
  return `NNNP-${year}-${idPart || "ONLINE"}`;
}

// Default Announcements for NNNP
export const DEFAULT_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: "ann-1",
    title: "Trekking Permits Mandatory for all Northern Negros Peaks",
    content: "All trekkers entering Mt. Mandalagan, Mt. Silay, Mt. Marapara, or Kumalisikis must secure confirmed online booking and register with DENR-accredited guides prior to entry. Walk-in trekking without verified guide is strictly prohibited.",
    priority: "Normal",
    category: "Advisory",
    published_at: new Date().toISOString(),
    is_active: true,
  },
  {
    id: "ann-2",
    title: "Weather Advisory: Mossy Forest & Tinagong Dagat Caldera Fog",
    content: "Due to afternoon convection in Mount Mandalagan, expect zero-visibility fog starting 2:00 PM. All summit descents must commence no later than 1:30 PM. Ensure headlamps and rain shells are packed.",
    priority: "Urgent",
    category: "Weather",
    published_at: new Date(Date.now() - 86400000).toISOString(),
    is_active: true,
  },
  {
    id: "ann-3",
    title: "Leave No Trace & Protected Wildlife Protocol",
    content: "NNNP is the sanctuary of the critically endangered Visayan Spotted Deer and Rufous-headed Hornbill. Trekkers caught leaving plastic waste or disturbing wildlife face fines under RA 7586 (NIPAS Act).",
    priority: "Normal",
    category: "Advisory",
    published_at: new Date(Date.now() - 172800000).toISOString(),
    is_active: true,
  },
];

let cachedAnnouncements: { data: AnnouncementItem[]; timestamp: number } | null = null;

// Remote table flags (always enabled to ensure database visibility)
export const isRemoteAnnouncementsEnabled = () => true;
export const isRemoteReviewsEnabled = () => true;

// Fetch Announcements with database-first priority
export async function fetchAnnouncements(): Promise<AnnouncementItem[]> {
  if (cachedAnnouncements && Date.now() - cachedAnnouncements.timestamp < 3 * 60 * 1000) {
    return cachedAnnouncements.data;
  }

  let result: AnnouncementItem[] | null = null;

  try {
    const { data, error } = await (supabase as any)
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .order("published_at", { ascending: false });

    if (!error && data && data.length > 0) {
      result = data;
    }
  } catch (err) {}

  // Load any locally created announcements as fallback
  if (!result) {
    try {
      const local = localStorage.getItem("nnnp_custom_announcements");
      if (local) {
        const custom: AnnouncementItem[] = JSON.parse(local);
        result = [...custom, ...DEFAULT_ANNOUNCEMENTS];
      }
    } catch (e) {}
  }

  const finalAnnouncements = result || DEFAULT_ANNOUNCEMENTS;
  cachedAnnouncements = { data: finalAnnouncements, timestamp: Date.now() };
  return finalAnnouncements;
}

// Save Announcement (Admin) - saves directly to Supabase
export async function saveAnnouncement(announcement: Omit<AnnouncementItem, "id" | "published_at">) {
  cachedAnnouncements = null; // Invalidate cache
  const newAnn: AnnouncementItem = {
    ...announcement,
    id: `ann-${Date.now()}`,
    published_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await (supabase as any)
      .from("announcements")
      .insert({
        title: announcement.title,
        content: announcement.content,
        priority: announcement.priority,
        category: announcement.category,
        is_active: announcement.is_active,
      })
      .select()
      .single();

    if (!error && data) return data;
  } catch (err) {
    console.warn("Could not insert announcement to database:", err);
  }

  // Local fallback storage
  try {
    const current = localStorage.getItem("nnnp_custom_announcements");
    const list: AnnouncementItem[] = current ? JSON.parse(current) : [];
    list.unshift(newAnn);
    localStorage.setItem("nnnp_custom_announcements", JSON.stringify(list));
  } catch (e) {}

  return newAnn;
}

// Sample Reviews Seed
export const DEFAULT_REVIEWS: RatingReviewItem[] = [
  {
    id: "rev-1",
    booking_id: "seed-1",
    user_id: "user-1",
    user_name: "Carlo M. (Negros Mountaineers)",
    guide_id: "guide-1",
    guide_name: "Ramon Guanzon",
    trail_id: "mt-mandalagan",
    trail_name: "Mt. Mandalagan (Patag Trail)",
    trail_rating: 5,
    guide_rating: 5,
    overall_rating: 5,
    feedback_text: "Incredible experience through the mossy cloud forest! Our guide Ramon was extremely knowledgeable on indigenous flora and handled safety calmly at Tinagong Dagat caldera.",
    created_at: new Date(Date.now() - 345600000).toISOString(),
  },
  {
    id: "rev-2",
    booking_id: "seed-2",
    user_id: "user-2",
    user_name: "Elena Vasquez",
    guide_id: "guide-2",
    guide_name: "Junmar Alunan",
    trail_id: "mt-silay",
    trail_name: "Mt. Silay (Cabatangan Trail)",
    trail_rating: 5,
    guide_rating: 4,
    overall_rating: 5,
    feedback_text: "The WWII historical plane crash site was awe-inspiring. Well-maintained trail and clear directions from the DENR ranger station.",
    created_at: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: "rev-3",
    booking_id: "seed-3",
    user_id: "user-3",
    user_name: "Mark Villanueva",
    guide_id: null,
    guide_name: "Local Tourism Guide",
    trail_id: "kumalisikis",
    trail_name: "Kumalisikis Nature Path",
    trail_rating: 4,
    guide_rating: 5,
    overall_rating: 4,
    feedback_text: "Perfect morning hike for beginners. Waterfalls were rushing and the pine trees at Don Salvador Benedicto make it feel like Little Baguio!",
    created_at: new Date(Date.now() - 864000000).toISOString(),
  },
];

// Fetch Ratings & Reviews with database-first priority
export async function fetchReviews(): Promise<RatingReviewItem[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("ratings_reviews")
      .select("*")
      .eq("is_approved", true)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {}

  try {
    const local = localStorage.getItem("nnnp_custom_reviews");
    if (local) {
      const custom = JSON.parse(local);
      return [...custom, ...DEFAULT_REVIEWS];
    }
  } catch (e) {}

  return DEFAULT_REVIEWS;
}

// Submit a Review directly to database
export async function submitReview(review: {
  bookingId: string;
  userId: string;
  userName?: string;
  guideId?: string | null;
  guideName?: string | null;
  trailId: string;
  trailName?: string;
  trailRating: number;
  guideRating?: number;
  overallRating: number;
  feedbackText: string;
}) {
  const item: RatingReviewItem = {
    id: `rev-${Date.now()}`,
    booking_id: review.bookingId,
    user_id: review.userId,
    user_name: review.userName || "Verified Trekker",
    guide_id: review.guideId || null,
    guide_name: review.guideName || null,
    trail_id: review.trailId,
    trail_name: review.trailName || "NNNP Trail",
    trail_rating: review.trailRating,
    guide_rating: review.guideRating,
    overall_rating: review.overallRating,
    feedback_text: review.feedbackText,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await (supabase as any)
      .from("ratings_reviews")
      .insert({
        booking_id: review.bookingId,
        user_id: review.userId,
        guide_id: review.guideId || null,
        trail_id: review.trailId,
        trail_rating: review.trailRating,
        guide_rating: review.guideRating || null,
        overall_rating: review.overallRating,
        feedback_text: review.feedbackText,
        is_approved: true,
      })
      .select()
      .single();

    if (!error && data) return data;
  } catch (err) {
    console.warn("Could not insert review into database:", err);
  }

  // Local fallback
  try {
    const current = localStorage.getItem("nnnp_custom_reviews");
    const list = current ? JSON.parse(current) : [];
    list.unshift(item);
    localStorage.setItem("nnnp_custom_reviews", JSON.stringify(list));
  } catch (e) {}

  return item;
}
