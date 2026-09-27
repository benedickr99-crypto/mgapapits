import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, Check, X, Users, CheckCircle, Clock, XCircle, FileText, 
  Flame, Calendar as CalendarIcon, Bell, TrendingUp, Star, UserCheck, 
  MapPin, ShieldAlert, Eye, Phone, Compass, AlertTriangle
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import AdminGuides from "./AdminGuides";
import AdminIncidents from "./AdminIncidents";
import { TrekkingHeatMap } from "@/components/admin/TrekkingHeatMap";
import { ScheduleManagement } from "@/components/admin/ScheduleManagement";
import { AnnouncementManager } from "@/components/admin/AnnouncementManager";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { ReviewsManager } from "@/components/admin/ReviewsManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  getLocalParticipants, 
  getBookingParticipants, 
  getBookingTimeSlot, 
  getBookingReferenceNumber 
} from "@/lib/bookingService";

import type { Database } from "@/integrations/supabase/types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

type Booking = {
  id: string;
  climb_date: string;
  status: BookingStatus;
  group_size?: number;
  foreign_count?: number;
  notes?: string | null;
  permit_number?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  trail_id: string;
  guide_id?: string | null;
  valid_id_url: string | null;
  waiver_url: string | null;
  medical_cert_url: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    phone: string | null;
  } | null;
  trails: {
    id?: string;
    name: string;
  } | null;
  guides: {
    id?: string;
    name: string;
  } | null;
};

// Reusable Status Badge
const StatusBadge = ({ status }: { status: string }) => {
  let color = "bg-gray-100 text-gray-800 border-gray-200";
  if (status === "pending") color = "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "approved" || status === "completed") color = "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "rejected" || status === "cancelled") color = "bg-red-100 text-red-800 border-red-200";

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold border ${color}`}>
      {status}
    </span>
  );
};

export default function Admin() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trails, setTrails] = useState<any[]>([]);
  const [guidesList, setGuidesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("bookingId");
  
  const [activeTab, setActiveTab] = useState<
    "bookings" | "guides" | "incidents" | "schedules" | "heatmap" | "analytics" | "announcements" | "reviews"
  >("bookings");

  // Roster detail view modal
  const [selectedRosterBooking, setSelectedRosterBooking] = useState<Booking | null>(null);

  // Manual Guide Assignment modal
  const [assigningBooking, setAssigningBooking] = useState<Booking | null>(null);
  const [selectedGuideId, setSelectedGuideId] = useState<string>("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(null);

      // 1. Fetch Bookings
      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select(`
          id,
          climb_date,
          status,
          group_size,
          foreign_count,
          notes,
          permit_number,
          emergency_contact_name,
          emergency_contact_phone,
          trail_id,
          guide_id,
          valid_id_url,
          waiver_url,
          medical_cert_url,
          created_at,
          profiles (full_name, phone),
          guides:profiles!bookings_guide_id_fkey (name:full_name),
          trails (id, name)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        setFetchError(error.message || JSON.stringify(error));
        throw error;
      }
      
      setBookings((bookingsData as unknown as Booking[]) || []);

      // 2. Fetch Trails
      const { data: trailsData } = await supabase
        .from("trails")
        .select("*")
        .eq("active", true)
        .order("name");
      if (trailsData) setTrails(trailsData);

      // 3. Fetch Tour Guides
      const { data: guidesData } = await supabase
        .from("profiles")
        .select("id, full_name, experience_years, is_available")
        .eq("role", "guide")
        .order("full_name");
      if (guidesData) setGuidesList(guidesData);

    } catch (err: unknown) {
      console.error("Supabase Error:", err);
      const message = err instanceof Error ? err.message : "Failed to fetch bookings. See console for details.";
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("booking-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: string, status: BookingStatus) => {
    try {
      const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
      if (error) {
        alert("Database error: " + error.message);
        return;
      }
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b))
      );
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleManualGuideAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningBooking || !selectedGuideId) return;

    try {
      const { error } = await supabase
        .from("bookings")
        .update({ guide_id: selectedGuideId })
        .eq("id", assigningBooking.id);

      if (error) throw error;

      alert("Tour guide assigned successfully!");
      setAssigningBooking(null);
      setSelectedGuideId("");
      fetchData();
    } catch (err: any) {
      alert("Failed to assign guide: " + err.message);
    }
  };

  // Stats Calculations
  const total = bookings.length;
  const pending = bookings.filter((b) => b.status === "pending").length;
  const approved = bookings.filter((b) => b.status === "approved").length;
  const cancelled = bookings.filter((b) => b.status === "cancelled" || b.status === "rejected").length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-gray-50/30 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full mb-1">
            <Compass className="w-3.5 h-3.5" /> DENR Regional Park Headquarters
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Admin Management Console</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Northern Negros Natural Park (NNNP) Online Trekking Booking & Safety Supervision
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-200/80 p-1 rounded-2xl overflow-x-auto max-w-full scrollbar-none">
          {[
            { id: "bookings", label: "Permits & Bookings" },
            { id: "guides", label: "Tour Guides" },
            { id: "incidents", label: "Safety Incidents" },
            { id: "schedules", label: "Schedules & Capacity" },
            { id: "heatmap", label: "Trail Heat Map" },
            { id: "analytics", label: "Analytics & CSV" },
            { id: "announcements", label: "Advisories" },
            { id: "reviews", label: "Ratings & Reviews" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-white shadow-xs text-emerald-900"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= TABS CONTENT ================= */}

      {activeTab === "bookings" && (
        <>
          {/* STATS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Users size={24} /></div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Bookings</p>
                <p className="text-2xl font-black text-gray-900">{total}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center gap-4">
              <div className="bg-amber-50 p-3 rounded-xl text-amber-600"><Clock size={24} /></div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Pending Review</p>
                <p className="text-2xl font-black text-amber-700">{pending}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center gap-4">
              <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600"><CheckCircle size={24} /></div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Approved Permits</p>
                <p className="text-2xl font-black text-emerald-700">{approved}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center gap-4">
              <div className="bg-red-50 p-3 rounded-xl text-red-600"><XCircle size={24} /></div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Cancelled / Rejected</p>
                <p className="text-2xl font-black text-red-700">{cancelled}</p>
              </div>
            </div>
          </div>

          {/* TABLE */}
          {fetchError ? (
            <div className="flex flex-col items-center justify-center py-20 bg-red-50 rounded-2xl shadow-sm border border-red-100">
              <XCircle className="text-red-500 mb-4" size={40} />
              <h3 className="text-lg font-semibold text-red-900">Error Loading Bookings</h3>
              <p className="text-red-600 mt-1 max-w-md text-center text-xs">{fetchError}</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
              <Loader2 className="animate-spin text-emerald-600 mb-4" size={40} />
              <p className="text-gray-500 font-bold text-sm">Loading bookings and verification rosters...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="bg-gray-50 p-4 rounded-full mb-4">
                <Users className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No bookings found</h3>
              <p className="text-gray-500 mt-1 text-xs">There are currently no trekking permits to review.</p>
            </div>
          ) : (
            <div className="bg-white shadow-xs border border-gray-200 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-5 py-4 font-bold">Reference / User</th>
                      <th className="px-5 py-4 font-bold">Trail Destination</th>
                      <th className="px-5 py-4 font-bold">Tour Guide Assignment</th>
                      <th className="px-5 py-4 font-bold">Climb Date & Pax</th>
                      <th className="px-5 py-4 font-bold">Requirements</th>
                      <th className="px-5 py-4 font-bold">Status</th>
                      <th className="px-5 py-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {bookings.map((b) => {
                      const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
                      const trail = Array.isArray(b.trails) ? b.trails[0] : b.trails;
                      const guide = Array.isArray(b.guides) ? b.guides[0] : b.guides;
                      const userName = profile?.full_name || "Trekker";
                      const userPhone = profile?.phone || "No phone";
                      const trailName = trail?.name || "Unknown Trail";
                      const guideName = guide?.name || "No Guide";
                      const isResolved = b.status !== "pending";
                      const isHighlighted = b.id === highlightId;
                      const refCode = getBookingReferenceNumber(b);
                      const timeSlot = getBookingTimeSlot(b);

                      return (
                        <tr
                          key={b.id}
                          className={`transition-all ${
                            isHighlighted ? "bg-emerald-50/80 ring-2 ring-emerald-400" : "hover:bg-gray-50/80"
                          }`}
                        >
                          {/* Reference / User */}
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border mb-1 inline-block">
                              {refCode}
                            </span>
                            <div className="font-bold text-gray-900">{userName}</div>
                            <div className="text-gray-500 text-[11px]">{userPhone}</div>
                          </td>

                          {/* Trail & Slot */}
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-gray-800">{trailName}</div>
                            <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                              {timeSlot}
                            </div>
                          </td>

                          {/* Guide Assignment */}
                          <td className="px-5 py-3.5">
                            {b.guide_id ? (
                              <span className="font-semibold text-gray-800">{guideName}</span>
                            ) : (
                              <button
                                onClick={() => {
                                  setAssigningBooking(b);
                                  setSelectedGuideId("");
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition"
                              >
                                <UserCheck size={12} /> Assign Guide
                              </button>
                            )}
                          </td>

                          {/* Date & Group Size */}
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-gray-800">
                              {new Date(b.climb_date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </div>
                            <button
                              onClick={() => setSelectedRosterBooking(b)}
                              className="text-emerald-700 hover:underline font-bold text-[11px] flex items-center gap-1 mt-0.5"
                            >
                              <Users size={12} /> {b.group_size || 1} Pax Roster
                            </button>
                          </td>

                          {/* Documents */}
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col gap-1 text-[11px]">
                              {b.valid_id_url ? (
                                <a
                                  href={b.valid_id_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <FileText size={12} /> ID Uploaded
                                </a>
                              ) : (
                                <span className="text-gray-400">No ID</span>
                              )}
                              {b.waiver_url ? (
                                <a
                                  href={b.waiver_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <FileText size={12} /> Waiver
                                </a>
                              ) : (
                                <span className="text-gray-400">No Waiver</span>
                              )}
                              {b.medical_cert_url ? (
                                <a
                                  href={b.medical_cert_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                                >
                                  <FileText size={12} /> Med Cert
                                </a>
                              ) : (
                                <span className="text-gray-400">No Med Cert</span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3.5">
                            <StatusBadge status={b.status} />
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => updateStatus(b.id, "approved")}
                                disabled={isResolved}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  isResolved
                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-700 hover:text-white border border-emerald-200"
                                }`}
                              >
                                Approve
                              </button>

                              <button
                                onClick={() => updateStatus(b.id, "rejected")}
                                disabled={isResolved}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  isResolved
                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                    : "bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200"
                                }`}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* TOUR GUIDES TAB */}
      {activeTab === "guides" && <AdminGuides />}

      {/* SAFETY INCIDENTS TAB */}
      {activeTab === "incidents" && <AdminIncidents />}

      {/* SCHEDULES TAB */}
      {activeTab === "schedules" && <ScheduleManagement bookings={bookings} trails={trails} />}

      {/* HEAT MAP TAB */}
      {activeTab === "heatmap" && <TrekkingHeatMap bookings={bookings} />}

      {/* ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <AdminAnalytics bookings={bookings} guides={guidesList} trails={trails} />
      )}

      {/* ANNOUNCEMENTS TAB */}
      {activeTab === "announcements" && <AnnouncementManager />}

      {/* REVIEWS TAB */}
      {activeTab === "reviews" && <ReviewsManager />}

      {/* PARTICIPANT ROSTER MODAL */}
      <Dialog open={!!selectedRosterBooking} onOpenChange={(o) => !o && setSelectedRosterBooking(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          {selectedRosterBooking && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Registered Trekkers Roster
                </DialogTitle>
              </DialogHeader>

              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs">
                <p className="font-bold text-emerald-900">{selectedRosterBooking.trails?.name}</p>
                <p className="text-emerald-700">
                  Date: {selectedRosterBooking.climb_date} • Group Size: {selectedRosterBooking.group_size || 1} Pax
                </p>
              </div>

              {/* Primary emergency contact */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider block mb-0.5">Emergency Contact</span>
                <p className="font-bold text-gray-900">{selectedRosterBooking.emergency_contact_name || "N/A"}</p>
                <p className="text-gray-600">{selectedRosterBooking.emergency_contact_phone || "N/A"}</p>
              </div>

              {/* Roster list */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Participant List</h4>
                {getBookingParticipants(selectedRosterBooking) ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {getBookingParticipants(selectedRosterBooking)?.map((p, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                        <div className="flex justify-between font-bold text-gray-900">
                          <span>{idx + 1}. {p.fullName}</span>
                          <span>{p.age} yrs</span>
                        </div>
                        {p.medicalConditions && p.medicalConditions !== "None" && (
                          <div className="mt-1 text-red-600 font-medium">
                            Medical Notes: {p.medicalConditions}
                          </div>
                        )}
                        {p.contactNumber && (
                          <div className="text-gray-500 text-[11px]">Phone: {p.contactNumber}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic bg-gray-50 p-4 rounded-xl text-center">
                    Lead trekker: {selectedRosterBooking.profiles?.full_name || "User"} ({selectedRosterBooking.group_size || 1} Pax registered)
                  </p>
                )}
              </div>

              <button
                onClick={() => setSelectedRosterBooking(null)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MANUAL GUIDE ASSIGNMENT MODAL */}
      <Dialog open={!!assigningBooking} onOpenChange={(o) => !o && setAssigningBooking(null)}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          {assigningBooking && (
            <form onSubmit={handleManualGuideAssign} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Assign Tour Guide
                </DialogTitle>
              </DialogHeader>

              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs">
                <p className="font-bold text-emerald-900">{assigningBooking.trails?.name}</p>
                <p className="text-emerald-700">Date: {assigningBooking.climb_date} • Group: {assigningBooking.group_size || 1} Pax</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Select Accredited Guide *
                </label>
                <select
                  value={selectedGuideId}
                  onChange={(e) => setSelectedGuideId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                >
                  <option value="">-- Choose an accredited guide --</option>
                  {guidesList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.full_name} ({g.experience_years || 2} yrs exp) {g.is_available ? "" : "— [Unavailable]"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningBooking(null)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition shadow-sm"
                >
                  Confirm Guide
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}