import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  Loader2, Check, X, Calendar, User, Users,
  MapPin, Clock, MessageSquare, Shield,
  Award, Briefcase, Bell, CheckCircle, XCircle,
  AlertTriangle, Phone, Activity, ExternalLink, Eye
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLocalParticipants, getBookingParticipants } from "@/lib/bookingService";
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
  const [activeTab, setActiveTab] = useState<"pending" | "upcoming" | "incidents" | "availability" | "profile">("pending");

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

  // Availability states
  const [offDates, setOffDates] = useState<string[]>([]);
  const [newOffDate, setNewOffDate] = useState("");
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);

  // Profile edit states
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(profile?.bio || "");
  const [experience, setExperience] = useState(profile?.experience_years || 0);
  const [certifications, setCertifications] = useState(profile?.certifications || "");
  const [saving, setSaving] = useState(false);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
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
      setBookings((data as unknown as Booking[]) || []);
    } catch (err) {
      console.error("Error fetching guide bookings:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

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
  }, [user]);

  const fetchIncidents = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getIncidentReports(user.id);
      setIncidents(data);
    } catch (err) {
      console.error("Error fetching incidents:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchBookings();
    fetchAvailability();
    fetchIncidents();
  }, [fetchBookings, fetchAvailability, fetchIncidents]);

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

  const toggleAvailability = async (date: string, currentStatus: 'off' | 'available') => {
    if (!user) return;
    setIsUpdatingAvailability(true);
    try {
      if (currentStatus === 'available') {
        const { error } = await supabase
          .from("guide_availability")
          .upsert({ guide_id: user.id, available_date: date, status: 'off' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("guide_availability")
          .delete()
          .eq("guide_id", user.id)
          .eq("available_date", date);
        if (error) throw error;
      }
      fetchAvailability();
    } catch (err) {
      alert("Error updating availability");
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const addOffDate = () => {
    if (!newOffDate) return;
    toggleAvailability(newOffDate, 'available');
    setNewOffDate("");
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

  // Pending requests: Admin has approved, guide hasn't accepted yet
  const pendingBookings = bookings.filter(b => b.status === 'approved' && !b.accepted_at && !b.declined_at);

  // Confirmed treks: Guide has accepted, status is approved or completed
  const upcomingBookings = bookings.filter(b =>
    b.accepted_at &&
    !b.declined_at &&
    (b.status === 'approved' || b.status === 'confirmed' || b.status === 'completed')
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">New Requests</p>
              <p className="text-2xl font-black text-slate-900">{pendingBookings.length}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Confirmed</p>
              <p className="text-2xl font-black text-slate-900">{upcomingBookings.length}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-rose-200 transition" onClick={() => setActiveTab("incidents")}>
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Incidents</p>
              <p className="text-2xl font-black text-rose-700">{incidents.length}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Award size={24} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Experience</p>
              <p className="text-2xl font-black text-slate-900">{profile?.experience_years || 0} <span className="text-sm font-bold text-slate-400">Yrs</span></p>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit overflow-x-auto">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'pending' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Pending Requests ({pendingBookings.length})
          </button>
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'upcoming' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Confirmed Treks ({upcomingBookings.length})
          </button>
          <button
            onClick={() => setActiveTab("incidents")}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'incidents' ? 'bg-white shadow-md text-rose-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Safety Incidents ({incidents.length})
          </button>
          <button
            onClick={() => setActiveTab("availability")}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'availability' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            My Schedule & Availability
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${activeTab === 'profile' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Guide Profile
          </button>
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
                return (
                  <div key={booking.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                            New Trek Request
                          </span>
                          <span className="text-slate-300 text-xs">•</span>
                          <span className="text-slate-500 text-xs font-bold">{booking.climb_date}</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {booking.trails?.name || 'Unknown Trail'}
                        </h3>
                      </div>
                      <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-700">
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

                      {booking.notes && (
                        <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600">
                          {booking.notes}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleDecision(booking.id, 'accept')}
                        className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-2xl transition-all shadow-md shadow-emerald-100"
                      >
                        <Check size={18} /> Accept Trek
                      </button>
                      <button
                        onClick={() => handleDecision(booking.id, 'decline')}
                        className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 font-bold py-3 rounded-2xl transition-all"
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
          <div className="max-w-3xl">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-2xl font-black text-slate-900 mb-2">My Availability</h3>
              <p className="text-slate-500 font-medium mb-8 text-sm">Mark dates when you are off-duty or unavailable to guide treks.</p>

              <div className="flex gap-3 mb-8">
                <input
                  type="date"
                  value={newOffDate}
                  onChange={(e) => setNewOffDate(e.target.value)}
                  className="flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 font-bold text-sm"
                />
                <button
                  onClick={addOffDate}
                  disabled={!newOffDate || isUpdatingAvailability}
                  className="px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all disabled:opacity-50 text-sm"
                >
                  Mark Unavailable
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Unavailable Dates</label>
                {offDates.length === 0 ? (
                  <p className="text-slate-400 italic text-sm py-4">You are currently available for all dates.</p>
                ) : (
                  offDates.sort().map(date => (
                    <div key={date} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="font-bold text-slate-700 text-sm">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      <button
                        onClick={() => toggleAvailability(date, 'off')}
                        className="text-red-500 hover:text-red-700 font-bold text-xs uppercase tracking-wider p-2"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
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
