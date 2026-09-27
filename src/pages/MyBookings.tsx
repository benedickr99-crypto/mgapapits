import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText, Download, Eye, AlertCircle, CheckCircle2,
  Calendar, Users, Phone, Info, MapPin, Printer, Star,
  Compass, ExternalLink, Filter, XCircle, Clock, RefreshCw
} from "lucide-react";
import { BookingVoucherModal } from "@/components/BookingVoucherModal";
import { ReviewModal } from "@/components/ReviewModal";
import { 
  getLocalParticipants, 
  getBookingParticipants, 
  getBookingTimeSlot, 
  getBookingReferenceNumber 
} from "@/lib/bookingService";
import { getTrailMetadata } from "@/lib/trailData";

type BookingWithTrail = {
  id: string;
  climb_date: string;
  group_size: number;
  foreign_count: number;
  organization: string | null;
  status: string;
  notes: string | null;
  valid_id_url: string | null;
  waiver_url: string | null;
  medical_cert_url: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  created_at: string;
  trail_id: string;
  permit_number?: string | null;
  trails: { name: string } | null;
  guides: { name: string; full_name?: string } | null;
};

const DocumentItem = ({ title, url }: { title: string, url: string | null }) => {
  return (
    <div className="group flex items-center justify-between p-3.5 bg-white border border-gray-100 rounded-2xl hover:border-emerald-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center gap-4 overflow-hidden">
        <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${url ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' : 'bg-gray-50 text-gray-400'}`}>
          <FileText size={22} strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-800 truncate">{title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {url ? (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                <CheckCircle2 size={12} /> Uploaded
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-md">
                <AlertCircle size={12} /> Missing
              </span>
            )}
          </div>
        </div>
      </div>
      {url && (
        <div className="flex gap-2 shrink-0 ml-3">
          <a href={url} target="_blank" rel="noreferrer" className="flex items-center justify-center w-9 h-9 text-emerald-600 hover:text-white hover:bg-emerald-600 bg-emerald-50 rounded-xl transition-all duration-300" title="View Document">
            <Eye size={18} strokeWidth={2} />
          </a>
          <a href={url} download target="_blank" rel="noreferrer" className="flex items-center justify-center w-9 h-9 text-gray-600 hover:text-white hover:bg-gray-800 bg-gray-100 rounded-xl transition-all duration-300" title="Download Document">
            <Download size={18} strokeWidth={2} />
          </a>
        </div>
      )}
    </div>
  );
};

// Sleek Skeleton Loader for initial cold loads
function MyBookingsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto py-8 md:py-16 px-4 md:px-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="h-6 w-44 bg-emerald-100/70 rounded-full mb-3" />
          <div className="h-10 w-72 bg-gray-200 rounded-xl mb-2" />
          <div className="h-4 w-96 max-w-full bg-gray-100 rounded" />
        </div>
        <div className="h-11 w-40 bg-emerald-100 rounded-xl shrink-0" />
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6">
        {[80, 60, 120, 80, 80, 70].map((w, idx) => (
          <div key={idx} className="h-8 rounded-full bg-gray-200 shrink-0" style={{ width: `${w}px` }} />
        ))}
      </div>

      {/* Booking Cards Skeleton */}
      <div className="space-y-5">
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 shadow-xs">
            <div className="flex-1 space-y-3 w-full">
              <div className="flex items-center gap-2">
                <div className="h-6 w-28 bg-gray-100 rounded-md" />
                <div className="h-6 w-20 bg-gray-100 rounded-full" />
              </div>
              <div className="h-7 w-60 bg-gray-200 rounded-lg" />
              <div className="flex flex-wrap gap-4 pt-1">
                <div className="h-4 w-32 bg-gray-100 rounded" />
                <div className="h-4 w-24 bg-gray-100 rounded" />
                <div className="h-4 w-36 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="flex gap-2 w-full lg:w-auto pt-3 lg:pt-0">
              <div className="h-9 w-24 bg-gray-100 rounded-xl" />
              <div className="h-9 w-24 bg-gray-100 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MyBookings() {
  const { user } = useAuth();

  // ⚡ SWR CACHING: Read existing bookings from cache immediately for 0ms page load
  const [data, setData] = useState<BookingWithTrail[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedUser = localStorage.getItem("nnnp_auth_user");
        const userId = user?.id || (cachedUser ? JSON.parse(cachedUser)?.id : null);
        if (userId) {
          const cached = localStorage.getItem(`nnnp_bookings_${userId}`);
          if (cached) return JSON.parse(cached);
        }
      } catch {}
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedUser = localStorage.getItem("nnnp_auth_user");
        const userId = user?.id || (cachedUser ? JSON.parse(cachedUser)?.id : null);
        if (userId) {
          const cached = localStorage.getItem(`nnnp_bookings_${userId}`);
          if (cached) return false;
        }
      } catch {}
    }
    return true;
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("bookingId");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  
  // Modals
  const [selectedBooking, setSelectedBooking] = useState<BookingWithTrail | null>(null);
  const [voucherData, setVoucherData] = useState<any | null>(null);
  const [reviewBooking, setReviewBooking] = useState<BookingWithTrail | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadBookings = async (showRefreshing = false) => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (showRefreshing) setIsRefreshing(true);

    try {
      const { data: bookingsData, error } = await supabase
        .from("bookings")
        .select("*, trails(name), guides:profiles!bookings_guide_id_fkey(name:full_name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && bookingsData) {
        setData(bookingsData as unknown as BookingWithTrail[]);
        try {
          localStorage.setItem(`nnnp_bookings_${user.id}`, JSON.stringify(bookingsData));
        } catch {}
      }
    } catch (err) {
      console.warn("Failed to refresh bookings:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      // Check cache again in case user just loaded
      const cached = localStorage.getItem(`nnnp_bookings_${user.id}`);
      if (cached) {
        try {
          setData(JSON.parse(cached));
          setLoading(false);
        } catch {}
      }
      loadBookings(data.length > 0);
    } else {
      // Safety timeout if user state is empty
      const t = setTimeout(() => setLoading(false), 800);
      return () => clearTimeout(t);
    }
  }, [user?.id]);

  const handleCancelBooking = async (bookingId: string) => {
    setCancellingId(bookingId);
    try {
      // 1. Try cancel_booking RPC
      const { error: rpcError } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId });
      
      if (rpcError) {
        // Direct update fallback
        await supabase
          .from("bookings")
          .update({ 
            status: "cancelled",
            notes: cancelReason ? `Cancelled by trekker: ${cancelReason}` : "Cancelled by trekker"
          } as any)
          .eq("id", bookingId);
      }

      setData(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b));
      alert("Your booking has been cancelled.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel booking.";
      alert(message);
    } finally {
      setCancellingId(null);
      setCancelReason("");
    }
  };

  const isCancelable = (status: string, climbDate: string) => {
    const s = status.toLowerCase();
    if (s !== 'pending' && s !== 'approved' && s !== 'confirmed') return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const climb = new Date(climbDate);
    climb.setHours(0, 0, 0, 0);

    const diffTime = climb.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 1;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
      case "confirmed":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "rejected":
        return "bg-red-100 text-red-700 border-red-200";
      case "cancelled":
        return "bg-gray-100 text-gray-600 border-gray-200";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const openVoucher = (booking: BookingWithTrail) => {
    const localParts = getBookingParticipants(booking);
    const refNum = getBookingReferenceNumber(booking);
    const timeSlot = getBookingTimeSlot(booking);

    setVoucherData({
      referenceNumber: refNum,
      trailName: booking.trails?.name || "NNNP Mountain Trail",
      climbDate: booking.climb_date,
      timeSlot,
      groupSize: booking.group_size,
      guideName: booking.guides?.name || "DENR Designated Guide",
      emergencyContactName: booking.emergency_contact_name,
      emergencyContactPhone: booking.emergency_contact_phone,
      participants: localParts || undefined,
    });
  };

  const filteredBookings = data.filter((b) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "approved" && (b.status === "approved" || b.status === "confirmed")) return true;
    return b.status.toLowerCase() === statusFilter.toLowerCase();
  });

  if (loading && data.length === 0) {
    return <MyBookingsSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto py-8 md:py-16 px-4 md:px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/70 px-3 py-1 rounded-full">
              <Compass className="w-3.5 h-3.5" /> NNNP Trekker Portal
            </div>
            {isRefreshing && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                Syncing reservations...
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
            My Trekking Bookings
          </h1>
          <p className="text-gray-500 text-sm md:text-base mt-1">
            Monitor reservation status, print official vouchers, and manage participants.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
          <button
            onClick={() => loadBookings(true)}
            disabled={isRefreshing}
            className="p-3 bg-white border border-gray-200 hover:border-emerald-300 text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition shadow-xs"
            title="Refresh bookings"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
          </button>
          <Link
            to="/booking"
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-3 rounded-xl transition shadow-xs inline-flex items-center gap-2 text-sm shrink-0"
          >
            <Calendar className="w-4 h-4" /> Book New Trail
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 mr-1">
          <Filter className="w-3.5 h-3.5" /> Filter:
        </span>
        {[
          { id: "all", label: "All Bookings" },
          { id: "pending", label: "Pending" },
          { id: "approved", label: "Approved / Confirmed" },
          { id: "completed", label: "Completed" },
          { id: "cancelled", label: "Cancelled" },
          { id: "rejected", label: "Rejected" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition shrink-0 ${
              statusFilter === tab.id
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-xs border border-gray-200 p-12 text-center max-w-xl mx-auto">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800 mb-1">No bookings found</h3>
          <p className="text-gray-500 text-sm mb-6">
            {statusFilter === "all"
              ? "You haven't made any trekking bookings yet. Explore Northern Negros peaks and reserve your permit!"
              : `You have no bookings matching the "${statusFilter}" status filter.`}
          </p>
          <Link
            to="/booking"
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-2.5 rounded-xl transition inline-block text-sm"
          >
            Explore Trails & Book Now
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredBookings.map((b) => {
            const isHighlighted = b.id === highlightId;
            const refNum = getBookingReferenceNumber(b);
            const meta = getTrailMetadata(b.trails?.name);

            return (
              <div
                key={b.id}
                onClick={() => setSelectedBooking(b)}
                className={`bg-white rounded-2xl shadow-xs p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 transition-all duration-300 cursor-pointer border ${
                  isHighlighted
                    ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/30"
                    : "border-gray-200 hover:border-emerald-300 hover:shadow-md"
                }`}
              >
                {/* Left: Info */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-bold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-md border border-gray-200">
                      {refNum}
                    </span>
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(
                        b.status
                      )}`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                    {b.trails?.name || "Protected Trail"}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-xs text-gray-600 mt-2.5">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Date: <strong>{b.climb_date}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        Group: <strong>{b.group_size} Pax</strong>
                        {b.foreign_count > 0 && ` (${b.foreign_count} foreign)`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        Guide: <strong>{b.guides?.name || "DENR Designated"}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Voucher button */}
                  <button
                    onClick={() => openVoucher(b)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition shadow-xs"
                    title="View Official Booking Voucher"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Voucher
                  </button>

                  {/* Leave review for completed bookings */}
                  {(b.status === "completed" || b.status === "approved") && (
                    <button
                      onClick={() => setReviewBooking(b)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 px-3.5 py-2 rounded-xl transition shadow-xs"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      Rate Trek
                    </button>
                  )}

                  {/* Navigation link */}
                  <a
                    href={meta.navigationUrls.googleMaps}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 px-3 py-2 rounded-xl transition"
                    title="Open Trailhead in Google Maps"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    Trailhead
                  </a>

                  {/* Cancellation */}
                  {isCancelable(b.status, b.climb_date) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          disabled={cancellingId === b.id}
                          className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 px-3 py-2 rounded-xl transition"
                        >
                          {cancellingId === b.id ? "Cancelling..." : "Cancel"}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Trekking Booking</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to cancel your reservation for <strong>{b.trails?.name}</strong> on {b.climb_date}? This slot will be released back to the park capacity pool.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-2">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Reason for cancellation (required):
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Health emergency, schedule change"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancelBooking(b.id)}
                            className="bg-red-600 text-white hover:bg-red-700 rounded-xl"
                          >
                            Yes, Confirm Cancellation
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Details Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="max-w-[560px] w-[95vw] max-h-[85vh] overflow-hidden bg-white rounded-3xl border border-gray-100 shadow-2xl p-0 flex flex-col">
          {selectedBooking && (
            <>
              {/* Header */}
              <div className="p-6 bg-gradient-to-b from-gray-50 to-white border-b border-gray-100 shrink-0">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-md border">
                      {selectedBooking.permit_number || `REF-${selectedBooking.id.substring(0, 8).toUpperCase()}`}
                    </span>
                    <DialogTitle className="text-2xl font-extrabold text-gray-900 mt-1">
                      {selectedBooking.trails?.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                      Protected mountain trek reservation
                    </DialogDescription>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(
                      selectedBooking.status
                    )}`}
                  >
                    {selectedBooking.status}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                    <span className="text-gray-500 flex items-center gap-1 font-semibold mb-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Date of Trek
                    </span>
                    <p className="font-bold text-gray-900 text-sm">{selectedBooking.climb_date}</p>
                  </div>

                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                    <span className="text-gray-500 flex items-center gap-1 font-semibold mb-1">
                      <Users className="w-3.5 h-3.5 text-emerald-600" /> Group Size
                    </span>
                    <p className="font-bold text-gray-900 text-sm">{selectedBooking.group_size} Pax</p>
                  </div>

                  <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 sm:col-span-2">
                    <span className="text-gray-500 flex items-center gap-1 font-semibold mb-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" /> Emergency Contact
                    </span>
                    <p className="font-bold text-gray-900">{selectedBooking.emergency_contact_name || "N/A"}</p>
                    <p className="text-gray-500">{selectedBooking.emergency_contact_phone || "N/A"}</p>
                  </div>
                </div>

                {/* Group Participant Roster */}
                {getBookingParticipants(selectedBooking) && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Registered Group Participants
                    </h4>
                    <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 text-xs overflow-hidden">
                      {getBookingParticipants(selectedBooking)?.map((p, i) => (
                        <div key={i} className="p-2.5 flex items-center justify-between">
                          <span className="font-semibold text-gray-900">
                            {i + 1}. {p.fullName} {p.age ? `(${p.age} yrs)` : ""}
                          </span>
                          <span className="text-gray-500 text-[11px]">{p.contactNumber || p.medicalConditions || ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Submitted Documents
                  </h4>
                  <div className="space-y-2.5">
                    <DocumentItem title="Valid ID" url={selectedBooking.valid_id_url} />
                    <DocumentItem title="Signed Waiver" url={selectedBooking.waiver_url} />
                    <DocumentItem title="Fit-to-Climb Medical Cert" url={selectedBooking.medical_cert_url} />
                  </div>
                  <div className="pt-2 text-right">
                    <a
                      href="/DENR_NNNP_Trekking_Waiver.docx"
                      download="DENR_NNNP_Trekking_Waiver.docx"
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Blank Waiver Form (.docx)
                    </a>
                  </div>
                </div>

                {/* Notes */}
                {selectedBooking.notes && (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 text-xs">
                    <span className="font-bold text-emerald-900 block mb-1">Booking Notes & Staggered Slot</span>
                    <p className="text-gray-700">{selectedBooking.notes}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <button
                  onClick={() => {
                    const b = selectedBooking;
                    setSelectedBooking(null);
                    openVoucher(b);
                  }}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" /> View / Print Voucher
                </button>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 px-4 py-2 rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Voucher Modal */}
      {voucherData && (
        <BookingVoucherModal
          isOpen={!!voucherData}
          onClose={() => setVoucherData(null)}
          booking={voucherData}
        />
      )}

      {/* Review Modal */}
      {reviewBooking && (
        <ReviewModal
          isOpen={!!reviewBooking}
          onClose={() => setReviewBooking(null)}
          booking={{
            id: reviewBooking.id,
            userId: user!.id,
            guideId: (reviewBooking as any).guide_id,
            guideName: reviewBooking.guides?.name,
            trailId: reviewBooking.trail_id,
            trailName: reviewBooking.trails?.name,
          }}
          onSuccess={loadBookings}
        />
      )}
    </div>
  );
}
