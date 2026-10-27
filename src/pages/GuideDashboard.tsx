import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  Loader2, Check, X, Calendar, User, Users,
  MapPin, Clock, MessageSquare, Shield,
  Award, Briefcase, Bell, CheckCircle, XCircle,
  AlertTriangle, Phone, Activity, ExternalLink, Eye,
  Star, ThumbsUp, Filter, Menu, ChevronRight, ChevronDown, Compass,
  ChevronLeft, CalendarDays, Coffee, Sparkles, CheckCheck, RotateCcw
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getLocalParticipants, getBookingParticipants, fetchReviews, type RatingReviewItem } from "@/lib/bookingService";
import { getTrailMetadata } from "@/lib/trailData";
import { toast } from "sonner";
import {
  createIncidentReport,
  getIncidentReports,
  type IncidentReport,
} from "@/lib/incidentService";

type Booking = {
  id: string;
  climb_date: string;
  status: string;
  group_size: number;
  accepted_at: string | null;
  declined_at: string | null;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string | null;
  permit_number?: string | null;
  trails: {
    name: string;
  } | null;
};

export default function GuideDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "upcoming" | "incidents" | "availability" | "profile" | "reviews">("pending");
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Ratings & Reviews State
  const [guideReviews, setGuideReviews] = useState<RatingReviewItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [starFilter, setStarFilter] = useState<number | null>(null);

  // Participant Roster Modal
  const [selectedBookingRoster, setSelectedBookingRoster] = useState<Booking | null>(null);

  // Incidents state
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    trail_name: "",
    booking_id: "",
    category: "hazard" as "medical" | "hazard" | "lost_trekker" | "weather" | "violation" | "other",
    severity: "medium" as "low" | "medium" | "high" | "critical",
    location_details: "",
    description: "",
    action_taken: "",
    requires_assistance: false,
  });

  // Availability states (Weekly-oriented)
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const formatDateKey = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [offDates, setOffDates] = useState<string[]>([]);
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date>(() => getMonday(new Date()));
  const [weeklyRoutine, setWeeklyRoutine] = useState<number[]>(() => {
    // 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat, 0: Sun
    try {
      const saved = localStorage.getItem(`guide_routine_${user?.id || "default"}`);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [1, 2, 3, 4, 5, 6, 0];
  });
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);

  // Profile edit states
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(profile?.bio || "");
  const [experience, setExperience] = useState(profile?.experience_years || 0);
  const [certifications, setCertifications] = useState(profile?.certifications || "");
  const [saving, setSaving] = useState(false);

  const fetchBookings = useCallback(async () => {
    if (!user) return [];
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          climb_date,
          status,
          group_size,
          accepted_at,
          declined_at,
          emergency_contact_name,
          emergency_contact_phone,
          notes,
          permit_number,
          trails (name)
        `)
        .eq("guide_id", user.id)
        .order("climb_date", { ascending: true });

      if (error) throw error;
      const bList = (data as unknown as Booking[]) || [];
      setBookings(bList);
      return bList;
    } catch (err) {
      console.error("Error fetching guide bookings:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchAvailability = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("guide_availability")
        .select("available_date")
        .eq("guide_id", user.id)
        .eq("status", "off");

      if (!error && data) {
        setOffDates(data.map((d: { available_date: string }) => d.available_date));
      }
    } catch (err) {
      console.error("Error fetching availability:", err);
    }
  }, [user?.id]);

  const fetchIncidents = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getIncidentReports(user.id);
      setIncidents(data);
    } catch (err) {
      console.error("Error fetching incidents:", err);
    }
  }, [user?.id]);

  const fetchGuideReviews = useCallback(async (currentBookings?: Booking[]) => {
    if (!user?.id) return;
    try {
      setLoadingReviews(true);

      const allReviews = await fetchReviews();
      const guideNameLower = (profile?.full_name || "").toLowerCase().trim();
      const refBookings = currentBookings || bookings;

      const matchedReviews = allReviews.filter((r) => {
        if (r.guide_id && (r.guide_id === user.id || (profile?.id && r.guide_id === profile.id))) return true;
        if (r.guide_name && guideNameLower && r.guide_name.toLowerCase().includes(guideNameLower)) return true;
        if (refBookings && refBookings.some((b) => b.id === r.booking_id)) return true;
        return false;
      });

      setGuideReviews(matchedReviews);
    } catch (err) {
      console.error("Error fetching guide reviews:", err);
    } finally {
      setLoadingReviews(false);
    }
  }, [user?.id, profile?.id, profile?.full_name]);

  useEffect(() => {
    if (!user?.id) return;

    fetchBookings().then((loadedBookings) => {
      fetchGuideReviews(loadedBookings);
    });
    fetchAvailability();
    fetchIncidents();

    // Real-time listener for guide accreditation status changes (approval/rejection)
    const profileChannel = supabase
      .channel(`guide-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        async () => {
          await refreshProfile();
        }
      )
      .subscribe();

    // Real-time listener for new/updated bookings assigned to this guide
    const bookingsChannel = supabase
      .channel(`guide-bookings-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `guide_id=eq.${user.id}`,
        },
        async () => {
          // Refresh bookings whenever any booking assigned to this guide changes
          const updated = await fetchBookings();
          fetchGuideReviews(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [user?.id]);

  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!incidentForm.description.trim()) {
      toast.error("Please describe what occurred.");
      return;
    }

    setSubmittingIncident(true);
    try {
      const res = await createIncidentReport({
        guide_id: user.id,
        trail_name: incidentForm.trail_name || "Trail / Summit Section",
        booking_id: incidentForm.booking_id || null,
        category: incidentForm.category,
        severity: incidentForm.severity,
        location_details: incidentForm.location_details,
        description: incidentForm.description,
        action_taken: incidentForm.action_taken,
        requires_assistance: incidentForm.requires_assistance,
        guide_name: profile?.full_name || "Tour Guide",
        guide_phone: profile?.phone || "",
      });

      if (res.success) {
        toast.success("🚨 Incident report transmitted directly to Park Admin & Dispatch!");
        setShowIncidentModal(false);
        setIncidentForm({
          trail_name: "",
          booking_id: "",
          category: "hazard",
          severity: "medium",
          location_details: "",
          description: "",
          action_taken: "",
          requires_assistance: false,
        });
        await fetchIncidents();
        setActiveTab("incidents");
      } else {
        toast.error(res.error || "Failed to submit incident report");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report");
    } finally {
      setSubmittingIncident(false);
    }
  };

  const handleDecision = async (id: string, decision: 'accept' | 'decline') => {
    const updateData = decision === 'accept'
      ? { accepted_at: new Date().toISOString(), declined_at: null }
      : { declined_at: new Date().toISOString(), accepted_at: null };

    try {
      const { error } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
      fetchBookings();
    } catch (err) {
      alert("Error updating booking status");
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: newStatus } as any)
        .eq("id", id);

      if (error) throw error;
      alert(`Trek status marked as: ${newStatus}`);
      fetchBookings();
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  const goToPreviousWeek = () => {
    setCurrentWeekMonday((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 7);
      return next;
    });
  };

  const goToNextWeek = () => {
    setCurrentWeekMonday((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  };

  const goToThisWeek = () => {
    setCurrentWeekMonday(getMonday(new Date()));
  };

  const jumpToDateWeek = (dateStr: string) => {
    if (!dateStr) return;
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      setCurrentWeekMonday(getMonday(d));
    }
  };

  // 7 days of the currently selected week (Mon -> Sun)
  const currentWeekDays = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map((offset) => {
      const dayDate = new Date(currentWeekMonday);
      dayDate.setDate(currentWeekMonday.getDate() + offset);
      const dateStr = formatDateKey(dayDate);
      const dayOfWeek = dayDate.getDay(); // 0 = Sun, 1 = Mon ...
      const dayName = dayDate.toLocaleDateString("en-US", { weekday: "short" });
      const fullDayName = dayDate.toLocaleDateString("en-US", { weekday: "long" });
      const monthDay = dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const todayStr = formatDateKey(new Date());
      const isToday = dateStr === todayStr;
      const isPast = dateStr < todayStr;
      const isOff = offDates.includes(dateStr);
      const dayBookings = bookings.filter(
        (b) => b.climb_date === dateStr && b.status !== "declined" && b.status !== "cancelled"
      );

      return {
        date: dayDate,
        dateStr,
        dayOfWeek,
        dayName,
        fullDayName,
        monthDay,
        isToday,
        isPast,
        isOff,
        dayBookings,
      };
    });
  }, [currentWeekMonday, offDates, bookings]);

  const currentWeekLabel = useMemo(() => {
    const monday = currentWeekDays[0]?.date || currentWeekMonday;
    const sunday = currentWeekDays[6]?.date || new Date(currentWeekMonday.getTime() + 6 * 86400000);
    const startStr = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} – ${endStr}`;
  }, [currentWeekDays, currentWeekMonday]);

  const weekAvailableCount = useMemo(() => {
    return currentWeekDays.filter((d) => !d.isOff).length;
  }, [currentWeekDays]);

  const weekOffCount = useMemo(() => {
    return currentWeekDays.filter((d) => d.isOff).length;
  }, [currentWeekDays]);

  const weekTreksCount = useMemo(() => {
    return currentWeekDays.reduce((acc, d) => acc + d.dayBookings.length, 0);
  }, [currentWeekDays]);

  const toggleAvailability = async (date: string, currentStatus: "off" | "available") => {
    if (!user) return;
    setIsUpdatingAvailability(true);
    try {
      if (currentStatus === "available") {
        const { error } = await supabase
          .from("guide_availability")
          .upsert({ guide_id: user.id, available_date: date, status: "off" });
        if (error) throw error;
        setOffDates((prev) => (prev.includes(date) ? prev : [...prev, date]));
        toast.success(`Marked as Off-Duty for ${date}`);
      } else {
        const { error } = await supabase
          .from("guide_availability")
          .delete()
          .eq("guide_id", user.id)
          .eq("available_date", date);
        if (error) throw error;
        setOffDates((prev) => prev.filter((d) => d !== date));
        toast.success(`Marked as Available for ${date}`);
      }
      fetchAvailability();
    } catch (err: any) {
      toast.error("Error updating availability: " + (err.message || "Failed"));
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  // Quick weekly batch actions
  const applyWeekAction = async (action: "all_available" | "all_off" | "weekdays_only" | "weekends_only") => {
    if (!user) return;
    setIsUpdatingAvailability(true);
    try {
      const datesToTurnOff: string[] = [];
      const datesToTurnAvailable: string[] = [];

      currentWeekDays.forEach((day) => {
        if (action === "all_available") {
          datesToTurnAvailable.push(day.dateStr);
        } else if (action === "all_off") {
          datesToTurnOff.push(day.dateStr);
        } else if (action === "weekdays_only") {
          if (day.dayOfWeek >= 1 && day.dayOfWeek <= 5) {
            datesToTurnAvailable.push(day.dateStr);
          } else {
            datesToTurnOff.push(day.dateStr);
          }
        } else if (action === "weekends_only") {
          if (day.dayOfWeek === 0 || day.dayOfWeek === 6) {
            datesToTurnAvailable.push(day.dateStr);
          } else {
            datesToTurnOff.push(day.dateStr);
          }
        }
      });

      if (datesToTurnOff.length > 0) {
        const rows = datesToTurnOff.map((dateStr) => ({
          guide_id: user.id,
          available_date: dateStr,
          status: "off",
        }));
        const { error } = await supabase.from("guide_availability").upsert(rows);
        if (error) throw error;
      }

      if (datesToTurnAvailable.length > 0) {
        const { error } = await supabase
          .from("guide_availability")
          .delete()
          .eq("guide_id", user.id)
          .in("available_date", datesToTurnAvailable);
        if (error) throw error;
      }

      await fetchAvailability();
      toast.success("Weekly schedule updated successfully!");
    } catch (err: any) {
      toast.error("Failed to update weekly schedule: " + (err.message || ""));
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const toggleRoutineDay = (dayIndex: number) => {
    setWeeklyRoutine((prev) => {
      const updated = prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex];
      try {
        localStorage.setItem(`guide_routine_${user?.id || "default"}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const applyRoutineToUpcomingWeeks = async () => {
    if (!user) return;
    if (weeklyRoutine.length === 0) {
      toast.error("Please select at least one active working day in your routine.");
      return;
    }
    setIsUpdatingAvailability(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const offBatch: string[] = [];
      const availBatch: string[] = [];

      for (let i = 0; i < 28; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = formatDateKey(d);
        const dayOfWeek = d.getDay();

        if (weeklyRoutine.includes(dayOfWeek)) {
          availBatch.push(dateStr);
        } else {
          offBatch.push(dateStr);
        }
      }

      if (offBatch.length > 0) {
        const rows = offBatch.map((dateStr) => ({
          guide_id: user.id,
          available_date: dateStr,
          status: "off",
        }));
        const { error } = await supabase.from("guide_availability").upsert(rows);
        if (error) throw error;
      }

      if (availBatch.length > 0) {
        const { error } = await supabase
          .from("guide_availability")
          .delete()
          .eq("guide_id", user.id)
          .in("available_date", availBatch);
        if (error) throw error;
      }

      await fetchAvailability();
      toast.success("Applied weekly routine to the next 4 weeks (28 days)!");
    } catch (err: any) {
      toast.error("Failed to apply weekly routine: " + (err.message || ""));
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          bio,
          experience_years: experience,
          certifications
        })
        .eq("id", user.id);

      if (error) throw error;
      await refreshProfile();
      setIsEditing(false);
    } catch (err) {
      alert("Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  // Pending requests: Bookings assigned to this guide (pending admin review OR approved but not yet accepted by guide)
  const pendingBookings = bookings.filter(b =>
    !b.declined_at &&
    !b.accepted_at &&
    (b.status === 'pending' || b.status === 'approved')
  );

  // Confirmed treks: Guide has accepted the booking
  const upcomingBookings = bookings.filter(b =>
    b.accepted_at &&
    !b.declined_at &&
    (b.status === 'approved' || b.status === 'confirmed' || b.status === 'completed')
  );

  // If application is still pending administrator review
  if (profile?.guide_application_status === "pending" || (profile?.role === "guide" && profile?.is_available === false && profile?.guide_application_status !== "approved")) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50/60 to-slate-100 py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-amber-200 overflow-hidden">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-8 text-white text-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
                <Clock size={32} className="text-white" />
              </div>
              <span className="px-3.5 py-1 bg-white/25 rounded-full text-xs font-black tracking-wider uppercase inline-block mb-2">
                Application Under Review
              </span>
              <h1 className="text-2xl font-black">Tour Guide Accreditation Pending</h1>
              <p className="text-amber-100 text-xs mt-2 max-w-md mx-auto">
                Thank you for applying to become an accredited Tour Guide for Northern Negros Natural Park (NNNP).
              </p>
            </div>

            {/* Content body */}
            <div className="p-8 space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900 leading-relaxed">
                <p className="font-bold text-sm text-amber-950 mb-1">📋 What happens next?</p>
                <p>
                  The DENR NNNP Protected Area Management Board / Park Administrator must manually inspect and verify your submitted Tour Guide ID or Mountaineering Accreditation Certificate before activating your guide assignments.
                </p>
              </div>

              {/* Submitted Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-500">Your Submitted Information</h3>
                <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-2xl p-4 text-xs">
                  <div>
                    <span className="text-gray-400 font-bold block text-[10px]">APPLICANT NAME</span>
                    <span className="font-bold text-gray-900">{profile?.full_name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold block text-[10px]">CONTACT PHONE</span>
                    <span className="font-bold text-gray-900">{profile?.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold block text-[10px]">EXPERIENCE</span>
                    <span className="font-bold text-gray-900">{profile?.experience_years || 0} years</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold block text-[10px]">STATUS</span>
                    <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                      <Clock size={12} /> Under Admin Review
                    </span>
                  </div>
                </div>
              </div>

              {/* Uploaded Certificate Preview */}
              {profile?.guide_id_url && (
                <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">
                    📎 Uploaded ID / Certificate
                  </span>
                  {/\.(jpg|jpeg|png|gif|webp)$/i.test(profile.guide_id_url) ? (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                      <img
                        src={profile.guide_id_url}
                        alt="Submitted Guide ID"
                        className="w-full max-h-56 object-contain"
                      />
                    </div>
                  ) : (
                    <a
                      href={profile.guide_id_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition"
                    >
                      <ExternalLink size={14} /> Open Uploaded Document
                    </a>
                  )}
                </div>
              )}

              {/* Refresh button */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={async () => {
                    await refreshProfile();
                    toast.info("Status refreshed. Checking with server...");
                  }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-2"
                >
                  <Activity size={14} /> Refresh Application Status
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If application was rejected
  if (profile?.guide_application_status === "rejected") {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl border border-red-200 p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
            <XCircle size={32} />
          </div>
          <h1 className="text-xl font-black text-gray-900">Application Not Approved</h1>
          <p className="text-xs text-gray-600 leading-relaxed">
            Your application for Tour Guide accreditation was reviewed by the DENR NNNP Park Administrator and could not be approved at this time.
          </p>
          <p className="text-xs text-gray-500">
            Please check your notifications for specific feedback from the administrator or contact the DENR NNNP Headquarters.
          </p>
          <a
            href="/"
            className="inline-block py-2.5 px-6 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition"
          >
            Return to Homepage
          </a>
        </div>
      </div>
    );
  }

  // Calculate review averages
  const avgGuideRating = guideReviews.length > 0
    ? guideReviews.reduce((sum, r) => sum + (r.guide_rating || r.overall_rating || 5), 0) / guideReviews.length
    : 0.0;

  const avgTrailRating = guideReviews.length > 0
    ? guideReviews.reduce((sum, r) => sum + (r.trail_rating || 5), 0) / guideReviews.length
    : 5.0;

  const avgOverallRating = guideReviews.length > 0
    ? guideReviews.reduce((sum, r) => sum + (r.overall_rating || 5), 0) / guideReviews.length
    : 5.0;

  const filteredGuideReviews = starFilter
    ? guideReviews.filter((r) => Math.round(r.guide_rating || r.overall_rating || 5) === starFilter)
    : guideReviews;

  const GUIDE_TABS = [
    {
      id: "pending" as const,
      label: `Pending Requests (${pendingBookings.length})`,
      shortLabel: "Pending Requests",
      description: "Review and accept incoming trek assignments from trekkers",
      icon: Clock,
      badge: pendingBookings.length,
      badgeColor: "bg-amber-500 text-white",
      category: "Expeditions & Treks",
    },
    {
      id: "upcoming" as const,
      label: `Confirmed Treks (${upcomingBookings.length})`,
      shortLabel: "Confirmed Treks",
      description: "Active trek schedules, participants, and emergency info",
      icon: CheckCircle,
      badge: upcomingBookings.length,
      badgeColor: "bg-emerald-600 text-white",
      category: "Expeditions & Treks",
    },
    {
      id: "incidents" as const,
      label: `Safety Incidents (${incidents.length})`,
      shortLabel: "Safety Incidents",
      description: "Report and track trail safety emergencies & hazards",
      icon: AlertTriangle,
      badge: incidents.length,
      badgeColor: "bg-rose-500 text-white",
      category: "Safety & Quality",
    },
    {
      id: "reviews" as const,
      label: `Trekker Reviews (${guideReviews.length})`,
      shortLabel: "Trekker Reviews",
      description: "Hiker ratings, testimonials, and trail reviews",
      icon: Star,
      badge: guideReviews.length,
      badgeColor: "bg-amber-500 text-white",
      category: "Safety & Quality",
    },
    {
      id: "availability" as const,
      label: "Weekly Availability & Schedule",
      shortLabel: "Weekly Availability",
      description: "Manage your weekly schedule, working days, and off-duty rest days",
      icon: Calendar,
      category: "Guide Management",
    },
    {
      id: "profile" as const,
      label: "Guide Profile",
      shortLabel: "Guide Profile",
      description: "Manage credentials, bio, and experience details",
      icon: Award,
      category: "Guide Management",
    },
  ];

  const currentTabObj = GUIDE_TABS.find((t) => t.id === activeTab) || GUIDE_TABS[0];
  const ActiveTabIcon = currentTabObj.icon;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsNavOpen(true)}
                className="p-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition lg:hidden border border-emerald-200/80 cursor-pointer"
                aria-label="Open Guide Menu"
                title="Open Guide Menu"
              >
                <Menu size={22} className="stroke-[2.5]" />
              </button>
              <div className="w-12 h-12 bg-emerald-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 shrink-0">
                <Briefcase size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Guide Dashboard</h1>
                <p className="text-sm text-slate-500 font-medium">Welcome back, {profile?.full_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (upcomingBookings.length > 0 && !incidentForm.trail_name) {
                    setIncidentForm(prev => ({
                      ...prev,
                      trail_name: upcomingBookings[0].trails?.name || "",
                      booking_id: upcomingBookings[0].id
                    }));
                  }
                  setShowIncidentModal(true);
                }}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-rose-200 transition"
              >
                <AlertTriangle size={16} /> Report Incident to Admin
              </button>

              <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-900">{profile?.full_name}</p>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Accredited Guide</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-white shadow-sm flex items-center justify-center text-emerald-800 font-bold">
                  {profile?.full_name?.charAt(0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <div
            className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all"
            onClick={() => setActiveTab("pending")}
            title="Click to view Pending Requests"
          >
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">New Requests</p>
              <p className="text-2xl font-black text-slate-900">{pendingBookings.length}</p>
            </div>
          </div>
          <div
            className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all"
            onClick={() => setActiveTab("upcoming")}
            title="Click to view Confirmed Treks"
          >
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Confirmed</p>
              <p className="text-2xl font-black text-slate-900">{upcomingBookings.length}</p>
            </div>
          </div>
          <div
            className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-rose-200 hover:shadow-md transition-all"
            onClick={() => setActiveTab("incidents")}
            title="Click to view Safety Incidents"
          >
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Incidents</p>
              <p className="text-2xl font-black text-rose-700">{incidents.length}</p>
            </div>
          </div>
          {/* Trekker Rating Stat Card */}
          <div
            className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all"
            onClick={() => setActiveTab("reviews")}
            title="Click to view Trekker Reviews"
          >
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
              <Star size={24} className="fill-amber-400" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trekker Rating</p>
              <p className="text-2xl font-black text-slate-900">
                {guideReviews.length > 0 ? avgGuideRating.toFixed(1) : "0.0"}{" "}
                <span className="text-xs font-bold text-amber-500">★</span>
              </p>
            </div>
          </div>
          <div
            className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
            onClick={() => setActiveTab("profile")}
            title="Click to view Guide Profile"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Award size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Experience</p>
              <p className="text-2xl font-black text-slate-900">{profile?.experience_years || 0} <span className="text-sm font-bold text-slate-400">Yrs</span></p>
            </div>
          </div>
        </div>

        {/* HAMBURGER MENU NAVIGATION */}
        <div className="flex items-center justify-between mb-8 bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center gap-3.5 sm:gap-4 flex-wrap w-full">
            <Sheet open={isNavOpen} onOpenChange={setIsNavOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="group relative flex items-center gap-2.5 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md hover:shadow-lg hover:shadow-emerald-900/25 transition-all duration-200 active:scale-95 cursor-pointer ring-2 ring-emerald-500/40 shrink-0"
                  aria-label={`Current Section: ${currentTabObj.shortLabel}. Click to open menu.`}
                >
                  <Menu className="w-5 h-5 text-white stroke-[2.5] transition-transform duration-200 group-hover:scale-110" />
                  <span className="tracking-wide flex items-center gap-2">
                    {currentTabObj.shortLabel}
                    {currentTabObj.badge !== undefined && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white border border-white/30">
                        {currentTabObj.badge}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="w-4 h-4 text-emerald-100 transition-transform duration-200 group-hover:translate-y-0.5" />
                </button>
              </SheetTrigger>

              <SheetContent side="left" className="w-[90vw] sm:w-[420px] p-0 flex flex-col bg-white">
                <SheetHeader className="p-5 pb-4 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white text-left">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full w-fit mb-1">
                    <Compass className="w-3.5 h-3.5" /> DENR Mount Northern Negros
                  </div>
                  <SheetTitle className="text-xl font-extrabold text-gray-900">
                    Guide Navigation
                  </SheetTitle>
                  <SheetDescription className="text-xs text-gray-500">
                    Switch between booking requests, trek rosters, incident logs, and profile
                  </SheetDescription>
                </SheetHeader>

                {/* Scrollable Tab List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {["Expeditions & Treks", "Safety & Quality", "Guide Management"].map((category) => {
                    const categoryTabs = GUIDE_TABS.filter((t) => t.category === category);
                    if (categoryTabs.length === 0) return null;

                    return (
                      <div key={category} className="space-y-1.5">
                        <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 px-2">
                          {category}
                        </div>

                        <div className="space-y-1">
                          {categoryTabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;

                            return (
                              <button
                                key={tab.id}
                                onClick={() => {
                                  setActiveTab(tab.id);
                                  setIsNavOpen(false);
                                }}
                                className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all cursor-pointer ${
                                  isActive
                                    ? "bg-emerald-50 border border-emerald-200/80 shadow-xs"
                                    : "hover:bg-gray-100/80 border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                      isActive
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`text-xs font-bold truncate ${
                                          isActive ? "text-emerald-950 font-black" : "text-gray-900"
                                        }`}
                                      >
                                        {tab.shortLabel}
                                      </span>
                                      {tab.badge !== undefined && tab.badge > 0 ? (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${tab.badgeColor || 'bg-amber-500 text-white'}`}>
                                          {tab.badge}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                      {tab.description}
                                    </p>
                                  </div>
                                </div>

                                {isActive ? (
                                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ml-2">
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 ml-2" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/60 text-xs text-gray-500 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Accredited Guide Portal
                  </span>
                  <span className="text-[11px] text-gray-400">DENR NNNP</span>
                </div>
              </SheetContent>
            </Sheet>

            {/* Selected Section Details */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold border border-emerald-100 shadow-xs shrink-0">
                <ActiveTabIcon className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">
                    {currentTabObj.shortLabel}
                  </h2>
                  {currentTabObj.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      {currentTabObj.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  {currentTabObj.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* TAB CONTENT */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <Loader2 className="animate-spin text-emerald-600 mb-4" size={48} />
            <p className="text-slate-500 font-bold text-lg">Synchronizing your treks...</p>
          </div>
        ) : activeTab === "pending" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pendingBookings.length === 0 ? (
              <div className="lg:col-span-2 flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                  <Calendar size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">No pending requests</h3>
                <p className="text-slate-500 mt-2 text-sm">New guide assignments from trekkers or park admin will appear here.</p>
              </div>
            ) : (
              pendingBookings.map(booking => {
                const meta = getTrailMetadata(booking.trails?.name);
                const isAdminApproved = booking.status === 'approved';
                return (
                  <div key={booking.id} className={`bg-white p-6 rounded-3xl shadow-sm border transition-all group ${isAdminApproved ? 'border-emerald-200 hover:shadow-xl hover:shadow-emerald-100/50' : 'border-amber-200 hover:shadow-xl hover:shadow-amber-100/50'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {isAdminApproved ? (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                              <CheckCircle size={10} /> Admin Approved — Awaiting Your Response
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                              <Clock size={10} /> Pending Admin Approval
                            </span>
                          )}
                          <span className="text-slate-500 text-xs font-bold">{booking.climb_date}</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {booking.trails?.name || 'Unknown Trail'}
                        </h3>
                      </div>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isAdminApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        <MapPin size={24} />
                      </div>
                    </div>

                    <div className="space-y-3 mb-6 text-sm">
                      <div className="flex items-center gap-3">
                        <Users size={18} className="text-emerald-600" />
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Group Size</p>
                          <p className="font-bold text-slate-900">{booking.group_size} Person(s)</p>
                        </div>
                      </div>

                      {booking.emergency_contact_name && (
                        <div className="flex items-center gap-3">
                          <Phone size={18} className="text-emerald-600" />
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Emergency Contact</p>
                            <p className="font-bold text-slate-900">
                              {booking.emergency_contact_name} ({booking.emergency_contact_phone || "N/A"})
                            </p>
                          </div>
                        </div>
                      )}

                      {!isAdminApproved && (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 font-semibold flex items-start gap-2">
                          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                          This booking is still waiting for Park Admin approval. You will be able to accept or decline once the admin approves it.
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => isAdminApproved && handleDecision(booking.id, 'accept')}
                        disabled={!isAdminApproved}
                        className={`flex items-center justify-center gap-2 font-bold py-3 rounded-2xl transition-all ${isAdminApproved ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md shadow-emerald-100 cursor-pointer' : 'bg-emerald-100 text-emerald-400 cursor-not-allowed'}`}
                      >
                        <Check size={18} /> Accept Trek
                      </button>
                      <button
                        onClick={() => isAdminApproved && handleDecision(booking.id, 'decline')}
                        disabled={!isAdminApproved}
                        className={`flex items-center justify-center gap-2 font-bold py-3 rounded-2xl transition-all ${isAdminApproved ? 'bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 cursor-pointer' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                      >
                        <X size={18} /> Decline
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab === "upcoming" ? (
          <div className="space-y-4">
            {upcomingBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <CheckCircle className="text-slate-200 mb-4" size={60} />
                <h3 className="text-xl font-bold text-slate-900">No confirmed treks</h3>
                <p className="text-slate-500 mt-2 text-sm">Accepted bookings will appear here.</p>
              </div>
            ) : (
              upcomingBookings.map(booking => {
                const meta = getTrailMetadata(booking.trails?.name);
                return (
                  <div key={booking.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex flex-col items-center justify-center text-emerald-700 border border-emerald-100">
                        <span className="text-[10px] font-black uppercase">{new Date(booking.climb_date).toLocaleString('default', { month: 'short' })}</span>
                        <span className="text-xl font-black leading-tight">{new Date(booking.climb_date).getDate()}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-700 font-mono">
                            {booking.permit_number || `REF-${booking.id.substring(0, 6).toUpperCase()}`}
                          </span>
                        </div>
                        <h4 className="text-lg font-black text-slate-900">{booking.trails?.name || 'Unknown Trail'}</h4>
                        <div className="flex items-center gap-3 text-slate-500 text-xs font-semibold mt-1">
                          <span className="flex items-center gap-1"><Users size={14} /> {booking.group_size} Trekkers</span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          <span className="text-emerald-700">{meta.meetingPoint.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* View Roster Button */}
                      <button
                        onClick={() => setSelectedBookingRoster(booking)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl transition"
                      >
                        <Eye size={16} /> Roster & Notes
                      </button>

                      {/* Meeting Point Link */}
                      <a
                        href={meta.navigationUrls.googleMaps}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-2.5 rounded-xl transition border border-emerald-200"
                      >
                        <MapPin size={14} /> Trailhead <ExternalLink size={12} />
                      </a>

                      {/* Status Dropdown / Action */}
                      {booking.status !== "completed" ? (
                        <button
                          onClick={() => handleStatusChange(booking.id, "completed")}
                          className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                        >
                          Mark Completed
                        </button>
                      ) : (
                        <span className="px-3.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab === "incidents" ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="text-rose-600" size={22} /> Incident Reports Filed
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Keep track of all emergency or hazard reports filed directly with DENR NNNP Admin.
                </p>
              </div>
              <button
                onClick={() => setShowIncidentModal(true)}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition"
              >
                <AlertTriangle size={15} /> + Report New Incident
              </button>
            </div>

            {incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center px-4">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                  <Shield size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900">No Incidents Reported</h4>
                <p className="text-slate-500 text-xs max-w-md mt-1">
                  All treks under your supervision are running safely. If an emergency, trail hazard, or injury occurs, report it immediately.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {incidents.map((inc) => {
                  const severityBadge =
                    inc.severity === "critical"
                      ? "bg-red-100 text-red-800 border-red-200"
                      : inc.severity === "high"
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : inc.severity === "medium"
                      ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                      : "bg-blue-50 text-blue-800 border-blue-200";

                  const statusBadge =
                    inc.status === "resolved"
                      ? "bg-emerald-100 text-emerald-800"
                      : inc.status === "investigating"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-blue-100 text-blue-800";

                  return (
                    <div
                      key={inc.id}
                      className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${severityBadge}`}
                          >
                            {inc.severity} Severity
                          </span>
                          <span className="text-xs font-bold uppercase text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                            {inc.category.replace("_", " ")}
                          </span>
                          {inc.requires_assistance && (
                            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase bg-rose-600 text-white animate-pulse">
                              Assistance Requested
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-2.5 py-1 rounded-md font-bold uppercase ${statusBadge}`}>
                            {inc.status === "investigating" ? "Rangers Responding / Investigating" : inc.status}
                          </span>
                          <span className="text-slate-400">
                            {new Date(inc.created_at).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold mb-1">
                          <MapPin size={14} className="text-rose-500" />
                          <span>{inc.trail_name || "Trail Section"}</span>
                          {inc.location_details && <span>• Landmark: {inc.location_details}</span>}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 whitespace-pre-line">
                          {inc.description}
                        </p>
                      </div>

                      {inc.action_taken && (
                        <div className="bg-slate-50 p-3 rounded-2xl text-xs text-slate-700">
                          <span className="font-bold text-slate-900 block mb-0.5">Actions Taken on Site:</span>
                          {inc.action_taken}
                        </div>
                      )}

                      {inc.admin_notes && (
                        <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl text-xs">
                          <span className="font-bold text-emerald-900 flex items-center gap-1 mb-0.5">
                            <Shield size={14} /> Admin / Park Headquarters Update:
                          </span>
                          <p className="text-emerald-800">{inc.admin_notes}</p>
                          {inc.resolved_at && (
                            <p className="text-[10px] text-emerald-600 mt-1">
                              Resolved on: {new Date(inc.resolved_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === "availability" ? (
          <div className="space-y-8 max-w-6xl">
            {/* WEEKLY AVAILABILITY MAIN CARD */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
              {/* Header & Overview Stats */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                    <CalendarDays size={13} /> Weekly Roster System
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Weekly Availability & Schedule</h3>
                  <p className="text-slate-500 font-medium text-sm mt-1">
                    Manage your schedule week-by-week. Trek assignments and visitor bookings automatically follow your open days.
                  </p>
                </div>

                {/* Quick Week Stats */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Available</div>
                      <div className="text-sm font-black text-emerald-900">{weekAvailableCount} / 7 Days</div>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-2xl flex items-center gap-2.5">
                    <Coffee size={14} className="text-slate-500" />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">Off-Duty</div>
                      <div className="text-sm font-black text-slate-800">{weekOffCount} Days</div>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5">
                    <Compass size={14} className="text-amber-600" />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-amber-700">Scheduled Treks</div>
                      <div className="text-sm font-black text-amber-900">{weekTreksCount} Trek{weekTreksCount === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Week Navigation Control Bar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 py-6">
                {/* Navigation Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPreviousWeek}
                    disabled={isUpdatingAvailability}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition disabled:opacity-50 flex items-center gap-1.5 text-xs"
                    title="Previous Week"
                  >
                    <ChevronLeft size={16} /> Prev Week
                  </button>

                  <button
                    onClick={goToThisWeek}
                    disabled={isUpdatingAvailability}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition text-xs shadow-sm shadow-emerald-600/20"
                  >
                    This Week
                  </button>

                  <button
                    onClick={goToNextWeek}
                    disabled={isUpdatingAvailability}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition disabled:opacity-50 flex items-center gap-1.5 text-xs"
                    title="Next Week"
                  >
                    Next Week <ChevronRight size={16} />
                  </button>
                </div>

                {/* Week Label */}
                <div className="text-center font-black text-slate-800 text-base sm:text-lg flex items-center justify-center gap-2">
                  <Calendar size={18} className="text-emerald-600" />
                  <span>Week: {currentWeekLabel}</span>
                </div>

                {/* Jump to specific date */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Jump:</span>
                  <input
                    type="date"
                    onChange={(e) => jumpToDateWeek(e.target.value)}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                    title="Jump to the week of this date"
                  />
                </div>
              </div>

              {/* Weekly Quick Batch Actions Bar */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 sm:p-4 mb-6 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-600 uppercase tracking-wider">
                  <Sparkles size={14} className="text-emerald-600" /> Week Presets:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => applyWeekAction("all_available")}
                    disabled={isUpdatingAvailability}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCheck size={13} /> Mark All Available
                  </button>
                  <button
                    onClick={() => applyWeekAction("all_off")}
                    disabled={isUpdatingAvailability}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Coffee size={13} /> Mark Whole Week Off
                  </button>
                  <button
                    onClick={() => applyWeekAction("weekdays_only")}
                    disabled={isUpdatingAvailability}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition disabled:opacity-50"
                  >
                    Mon–Fri Available Only
                  </button>
                  <button
                    onClick={() => applyWeekAction("weekends_only")}
                    disabled={isUpdatingAvailability}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition disabled:opacity-50"
                  >
                    Sat–Sun Available Only
                  </button>
                </div>
              </div>

              {/* 7-Day Calendar Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                {currentWeekDays.map((day) => {
                  const isAvailable = !day.isOff;
                  return (
                    <div
                      key={day.dateStr}
                      className={`relative p-4 rounded-2xl border-2 flex flex-col justify-between transition-all ${
                        day.isToday
                          ? "ring-2 ring-emerald-500 shadow-md "
                          : ""
                      } ${
                        isAvailable
                          ? "bg-emerald-50/40 border-emerald-200 hover:border-emerald-300"
                          : "bg-slate-50 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {/* Top Header of Card */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-black tracking-wider uppercase ${isAvailable ? "text-emerald-800" : "text-slate-500"}`}>
                            {day.dayName}
                          </span>
                          {day.isToday && (
                            <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-black uppercase tracking-wider">
                              Today
                            </span>
                          )}
                        </div>

                        {/* Date Number */}
                        <div className="mb-3">
                          <div className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                            {day.date.getDate()}
                          </div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase mt-0.5">
                            {day.date.toLocaleDateString("en-US", { month: "short" })}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="mb-3">
                          {isAvailable ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[11px] font-bold">
                              <CheckCircle size={12} className="text-emerald-600" /> Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 text-slate-700 border border-slate-300 rounded-full text-[11px] font-bold">
                              <Coffee size={12} className="text-slate-500" /> Off-Duty
                            </span>
                          )}
                        </div>

                        {/* Treks on this day */}
                        {day.dayBookings.length > 0 && (
                          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-semibold space-y-1">
                            <div className="flex items-center gap-1 text-amber-700 font-bold">
                              <Compass size={12} /> {day.dayBookings.length} Trek Scheduled
                            </div>
                            {day.dayBookings.map((b) => (
                              <div key={b.id} className="truncate text-[10px] text-amber-800">
                                • {b.trails?.name || "Trail"} ({b.group_size} pax)
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Interactive Toggle Button */}
                      <button
                        onClick={() => toggleAvailability(day.dateStr, isAvailable ? "available" : "off")}
                        disabled={isUpdatingAvailability}
                        className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-all disabled:opacity-50 mt-2 ${
                          isAvailable
                            ? "bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        }`}
                      >
                        {isAvailable ? "Set Off-Duty" : "Set Available"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RECURRING WEEKLY ROUTINE TEMPLATE */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                    <Sparkles size={13} /> Recurring Routine
                  </div>
                  <h4 className="text-xl font-black text-slate-900">Standard Weekly Working Routine</h4>
                  <p className="text-slate-500 text-sm font-medium mt-1">
                    Select the regular days of the week you are willing to guide. You can apply this weekly routine to future weeks anytime.
                  </p>
                </div>

                <button
                  onClick={applyRoutineToUpcomingWeeks}
                  disabled={isUpdatingAvailability}
                  className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                >
                  {isUpdatingAvailability ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RotateCcw size={16} />
                  )}
                  Apply Routine to Next 4 Weeks
                </button>
              </div>

              {/* Day-of-week Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-6">
                {[
                  { index: 1, name: "Monday", short: "Mon" },
                  { index: 2, name: "Tuesday", short: "Tue" },
                  { index: 3, name: "Wednesday", short: "Wed" },
                  { index: 4, name: "Thursday", short: "Thu" },
                  { index: 5, name: "Friday", short: "Fri" },
                  { index: 6, name: "Saturday", short: "Sat" },
                  { index: 0, name: "Sunday", short: "Sun" },
                ].map((item) => {
                  const isActive = weeklyRoutine.includes(item.index);
                  return (
                    <button
                      key={item.index}
                      type="button"
                      onClick={() => toggleRoutineDay(item.index)}
                      className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                        isActive
                          ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-black shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-400 font-bold"
                      }`}
                    >
                      <span className="text-xs uppercase tracking-wider">{item.short}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${isActive ? "bg-emerald-200 text-emerald-900" : "bg-slate-200 text-slate-600"}`}>
                        {isActive ? "Working" : "Rest"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 italic">
                * Note: Applying this routine applies your active working days and off-duty rest days across the next 28 days.
              </p>
            </div>

            {/* UPCOMING OFF-DUTY DATES SUMMARY */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-black text-slate-900">All Scheduled Off-Duty Dates ({offDates.length})</h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">List of all dates currently registered as rest days or unavailable.</p>
                </div>
              </div>

              {offDates.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-slate-400 italic text-sm">You currently have no off-duty dates registered. You are available for all treks!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                  {offDates
                    .slice()
                    .sort()
                    .map((date) => (
                      <div
                        key={date}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition"
                      >
                        <div className="truncate pr-2">
                          <div className="font-bold text-slate-800 text-xs">
                            {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">Off-Duty</span>
                        </div>
                        <button
                          onClick={() => toggleAvailability(date, "off")}
                          disabled={isUpdatingAvailability}
                          className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 rounded-lg hover:bg-red-50 transition"
                          title="Restore availability for this date"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "reviews" ? (
          <div className="space-y-6">
            {/* HERO STATS BANNER */}
            <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-800/40">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                {/* Overall Score */}
                <div className="flex flex-col items-center lg:items-start text-center lg:text-left border-b lg:border-b-0 lg:border-r border-white/10 pb-6 lg:pb-0 lg:pr-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Star size={12} className="fill-amber-400 text-amber-400" /> Guide Performance Score
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 my-2">
                    <span className="text-5xl sm:text-6xl font-black text-amber-400">
                      {guideReviews.length > 0 ? avgGuideRating.toFixed(1) : "5.0"}
                    </span>
                    <span className="text-slate-400 text-lg font-bold">/ 5.0</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={18}
                        className={star <= Math.round(avgGuideRating) ? "fill-amber-400 text-amber-400" : "text-slate-600"}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    Based on <span className="font-bold text-white">{guideReviews.length}</span> trekker rating{guideReviews.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Detailed Ratings */}
                <div className="space-y-4 border-b lg:border-b-0 lg:border-r border-white/10 pb-6 lg:pb-0 lg:pr-6">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Category Breakdown</h4>
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-slate-300">Guide Service & Courtesy</span>
                        <span className="text-amber-400">{avgGuideRating.toFixed(1)} / 5</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${(avgGuideRating / 5) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-slate-300">Trail Safety & Route Knowledge</span>
                        <span className="text-emerald-400">{avgTrailRating.toFixed(1)} / 5</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${(avgTrailRating / 5) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-slate-300">Overall Adventure Satisfaction</span>
                        <span className="text-cyan-400">{avgOverallRating.toFixed(1)} / 5</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${(avgOverallRating / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* DENR Accreditation Badge */}
                <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-3">
                  <div className="w-12 h-12 bg-emerald-500/20 text-emerald-300 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-sm">DENR Accredited Eco-Tour Guide</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Trekker ratings reflect your field leadership, emergency preparedness, and environmental stewardship in Northern Negros Natural Park.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* FILTER & HEADER ROW */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs">
              <div>
                <h3 className="text-lg font-black text-slate-900">Trekker Reviews & Testimonials</h3>
                <p className="text-xs text-slate-500">Direct feedback left by climbers you guided on NNNP trails</p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setStarFilter(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    starFilter === null ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({guideReviews.length})
                </button>
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = guideReviews.filter((r) => Math.round(r.guide_rating || r.overall_rating || 5) === stars).length;
                  return (
                    <button
                      key={stars}
                      onClick={() => setStarFilter(stars)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                        starFilter === stars ? "bg-white text-amber-600 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span>{stars}</span>
                      <Star size={12} className="fill-current" />
                      {count > 0 && <span className="text-[10px] opacity-70">({count})</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* REVIEWS LIST */}
            {loadingReviews ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-xs">
                <Loader2 className="animate-spin text-emerald-600 mb-3" size={36} />
                <p className="text-xs font-bold text-slate-500">Loading your trekker reviews...</p>
              </div>
            ) : filteredGuideReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200 p-6 text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4">
                  <Star size={32} className="fill-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {starFilter ? `No ${starFilter}-Star Reviews Found` : "No Trekker Reviews Yet"}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                  {starFilter
                    ? `There are currently no reviews with a ${starFilter}-star rating.`
                    : "When trekkers complete their guided tours and submit feedback via their bookings dashboard, their ratings and personal comments will be shown here."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredGuideReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Header: User & Date */}
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                            {(rev.user_name || "T").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-xs text-slate-900">{rev.user_name || "Verified Trekker"}</span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                Verified
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {new Date(rev.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Trail destination */}
                        {rev.trail_name && (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl truncate max-w-[160px]">
                            📍 {rev.trail_name}
                          </span>
                        )}
                      </div>

                      {/* Badges: Guide rating, Trail rating, Overall */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-black text-xs">
                          <Star size={13} className="fill-amber-400 text-amber-500" />
                          Guide Rating: {rev.guide_rating || rev.overall_rating} / 5
                        </div>

                        <div className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                          Trail: <strong>{rev.trail_rating}/5</strong>
                        </div>

                        <div className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                          Overall: <strong>{rev.overall_rating}/5</strong>
                        </div>
                      </div>

                      {/* Feedback Comment */}
                      <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/70 text-xs text-slate-700 italic leading-relaxed">
                        "{rev.feedback_text}"
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="h-32 bg-gradient-to-r from-emerald-800 to-emerald-600 relative">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="absolute bottom-4 right-6 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-black rounded-xl transition-all border border-white/30"
                >
                  {isEditing ? "Cancel Editing" : "Edit Profile"}
                </button>
              </div>
              <div className="px-8 pb-8 -mt-12">
                <div className="relative inline-block">
                  <div className="w-24 h-24 rounded-3xl bg-white p-1.5 shadow-xl">
                    <div className="w-full h-full rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 text-3xl font-black border-2 border-white shadow-inner">
                      {profile?.full_name?.charAt(0)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 mb-8">
                  <h2 className="text-3xl font-black text-slate-900">{profile?.full_name}</h2>
                  <p className="text-slate-500 font-bold flex items-center gap-2 mt-1 text-sm">
                    <Shield size={16} className="text-emerald-600" /> Accredited NNNP Tour Guide
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Professional Bio</label>
                    {isEditing ? (
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 min-h-[120px] text-sm"
                        placeholder="Tell trekkers about your experience, peak specialties, and emergency training..."
                      />
                    ) : (
                      <p className="text-slate-700 leading-relaxed font-medium bg-slate-50/50 p-4 rounded-2xl border border-slate-100 italic text-sm">
                        {profile?.bio || "No bio added yet. Tell your trekkers about yourself!"}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Years of Experience</label>
                      {isEditing ? (
                        <input
                          type="number"
                          value={experience}
                          onChange={(e) => setExperience(Number(e.target.value))}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 font-bold text-sm"
                        />
                      ) : (
                        <div className="flex items-center gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                          <Award size={20} className="text-amber-500" />
                          <span className="text-slate-900 font-black">{profile?.experience_years || 0} Years</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Certifications</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={certifications}
                          onChange={(e) => setCertifications(e.target.value)}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 text-sm"
                          placeholder="E.g. Certified First Aider, Wildlife Spotter"
                        />
                      ) : (
                        <div className="flex items-center gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                          <CheckCircle size={20} className="text-emerald-600" />
                          <span className="text-slate-900 font-black">{profile?.certifications || "General Guide"}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="w-full mt-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 text-sm"
                    >
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                      {saving ? "Updating your profile..." : "Save Profile Changes"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PARTICIPANT ROSTER & MEDICAL NOTES MODAL */}
      <Dialog open={!!selectedBookingRoster} onOpenChange={(o) => !o && setSelectedBookingRoster(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          {selectedBookingRoster && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Trekker Participant Roster
                </DialogTitle>
              </DialogHeader>

              <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100 text-xs">
                <p className="font-bold text-emerald-900">{selectedBookingRoster.trails?.name}</p>
                <p className="text-emerald-700">Date: {selectedBookingRoster.climb_date} • Group: {selectedBookingRoster.group_size} Pax</p>
              </div>

              {/* Emergency Contact */}
              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider block mb-1">Emergency Contact</span>
                <p className="font-bold text-gray-900">{selectedBookingRoster.emergency_contact_name || "N/A"}</p>
                <p className="text-gray-600">{selectedBookingRoster.emergency_contact_phone || "N/A"}</p>
              </div>

              {/* Participants */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Trekkers Roster</h4>
                {getBookingParticipants(selectedBookingRoster) ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {getBookingParticipants(selectedBookingRoster)?.map((p, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                        <div className="flex justify-between font-bold text-gray-900">
                          <span>{idx + 1}. {p.fullName}</span>
                          <span>{p.age} yrs</span>
                        </div>
                        {p.medicalConditions && p.medicalConditions !== "None" && (
                          <div className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                            <AlertTriangle size={12} /> Medical Note: {p.medicalConditions}
                          </div>
                        )}
                        {p.contactNumber && (
                          <p className="text-gray-500 text-[11px] mt-0.5">Phone: {p.contactNumber}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic bg-gray-50 p-4 rounded-xl text-center">
                    Detailed participant roster provided at ranger checkpoint.
                  </p>
                )}
              </div>

              <button
                onClick={() => setSelectedBookingRoster(null)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 rounded-xl text-xs transition"
              >
                Close Roster
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* REPORT INCIDENT MODAL (Guides to Admin) */}
      <Dialog open={showIncidentModal} onOpenChange={setShowIncidentModal}>
        <DialogContent className="max-w-lg bg-white rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600 font-black text-xs uppercase tracking-wider mb-1">
              <AlertTriangle size={16} /> DENR NNNP Emergency & Incident Dispatch
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900">
              Report Safety Incident to Admin
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitIncident} className="space-y-4 mt-2">
            {/* Direct hotline notice */}
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
              <Phone size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Life-Threatening Emergency?</p>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Immediately call DENR NNNP Operations Hotline: <span className="font-bold underline">0917-800-6667</span> or Philippine National Emergency: <span className="font-bold underline">911</span>.
                </p>
              </div>
            </div>

            {/* Trail / Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Trail Destination *</label>
                <input
                  type="text"
                  placeholder="e.g. Mt. Mandalagan / Tinagong Dagat"
                  value={incidentForm.trail_name}
                  onChange={(e) => setIncidentForm({ ...incidentForm, trail_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Specific Landmark / Station</label>
                <input
                  type="text"
                  placeholder="e.g. Camp 2, River Crossing 3"
                  value={incidentForm.location_details}
                  onChange={(e) => setIncidentForm({ ...incidentForm, location_details: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            </div>

            {/* Category & Severity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Incident Category *</label>
                <select
                  value={incidentForm.category}
                  onChange={(e) => setIncidentForm({ ...incidentForm, category: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none bg-white font-medium"
                >
                  <option value="medical">🩺 Medical / Physical Injury</option>
                  <option value="hazard">⚠️ Trail Hazard / Landslide</option>
                  <option value="lost_trekker">🧭 Lost / Separated Trekker</option>
                  <option value="weather">⛈️ Severe Weather / Flash Flood</option>
                  <option value="violation">🚫 Rule / Wildlife Violation</option>
                  <option value="other">📌 Other Concern</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Severity Level *</label>
                <select
                  value={incidentForm.severity}
                  onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value as any })}
                  className={`w-full border rounded-xl p-2.5 text-xs font-bold outline-none ${
                    incidentForm.severity === "critical"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : incidentForm.severity === "high"
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-gray-300 bg-white text-gray-700"
                  }`}
                >
                  <option value="low">Low (Minor issue / inform admin)</option>
                  <option value="medium">Medium (Requires attention)</option>
                  <option value="high">High (Urgent ranger support)</option>
                  <option value="critical">CRITICAL (Immediate Evacuation)</option>
                </select>
              </div>
            </div>

            {/* Requires Assistance Checkbox */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <input
                type="checkbox"
                id="reqAssist"
                checked={incidentForm.requires_assistance}
                onChange={(e) => setIncidentForm({ ...incidentForm, requires_assistance: e.target.checked })}
                className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 border-gray-300"
              />
              <label htmlFor="reqAssist" className="text-xs font-bold text-gray-800 cursor-pointer">
                Immediate Park Ranger / Medical Assistance Required on Site
              </label>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Incident Description *</label>
              <textarea
                rows={3}
                placeholder="Describe what occurred, number of individuals affected, physical conditions, and current status..."
                value={incidentForm.description}
                onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                required
              />
            </div>

            {/* Action Taken */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Actions Taken By Guide</label>
              <textarea
                rows={2}
                placeholder="e.g. Applied first aid, halted group ascent, sheltered at Station 2..."
                value={incidentForm.action_taken}
                onChange={(e) => setIncidentForm({ ...incidentForm, action_taken: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowIncidentModal(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingIncident}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submittingIncident ? (
                  <>
                    <Loader2 className="animate-spin" size={14} /> Transmitting...
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} /> Transmit Report
                  </>
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
