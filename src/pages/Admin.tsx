import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  Mountain,
  CalendarCheck,
  FileCheck,
  Compass,
  MapPin,
  Megaphone,
  HelpCircle,
  BellRing,
  BarChart3,
  Settings,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  LogOut,
  Printer,
  Eye,
  Download,
  RefreshCw,
  Flame,
  Star,
  ShieldCheck,
  FileText,
  ChevronRight,
  Menu,
  X,
  ChevronDown,
  Check,
  Plus,
  Trash2,
  Edit,
  Phone,
  ShieldAlert,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Mail,
  Building2,
  Globe,
  Radio,
  FileSpreadsheet
} from "lucide-react";

import AdminGuides from "./AdminGuides";
import AdminIncidents from "./AdminIncidents";
import { TrekkingHeatMap } from "@/components/admin/TrekkingHeatMap";
import { ScheduleManagement } from "@/components/admin/ScheduleManagement";
import { AnnouncementManager } from "@/components/admin/AnnouncementManager";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { ReviewsManager } from "@/components/admin/ReviewsManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { NNNP_TRAILS_METADATA } from "@/lib/trailData";
import {
  getBookingParticipants,
  getBookingTimeSlot,
  getBookingReferenceNumber
} from "@/lib/bookingService";

import type { Database } from "@/integrations/supabase/types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

type Booking = {
  id: string;
  user_id?: string;
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
    email?: string | null;
  } | null;
  trails: {
    id?: string;
    name: string;
    weekly_slots?: number | null;
  } | null;
  guides: {
    id?: string;
    name: string;
  } | null;
};

type UserProfile = {
  id: string;
  full_name: string | null;
  email?: string | null;
  phone: string | null;
  role: string;
  nationality: string | null;
  created_at?: string;
  is_available?: boolean;
  guide_application_status?: string | null;
};

type TrailRecord = {
  id: string;
  name: string;
  description: string | null;
  barangay: string | null;
  city: string | null;
  weekly_slots?: number | null;
  active: boolean | null;
  created_at: string;
};

type NotificationItem = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  link?: string | null;
};

export type TabType =
  | "dashboard"
  | "users"
  | "trails"
  | "bookings"
  | "permits"
  | "guides"
  | "navigation"
  | "advisories"
  | "faq"
  | "notifications"
  | "reports"
  | "settings";

// Reusable Status Badge
const StatusBadge = ({ status }: { status: string }) => {
  const s = status.toLowerCase();
  let color = "bg-gray-100 text-gray-800 border-gray-200";
  if (s === "pending") color = "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "approved" || s === "completed") color = "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "rejected" || s === "cancelled") color = "bg-red-100 text-red-800 border-red-200";

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold border ${color}`}>
      {status}
    </span>
  );
};

export default function Admin() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab state
  const tabParam = searchParams.get("tab") as TabType | null;
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (tabParam && [
      "dashboard", "users", "trails", "bookings", "permits",
      "guides", "navigation", "advisories", "faq", "notifications",
      "reports", "settings"
    ].includes(tabParam)) {
      return tabParam;
    }
    // Backward compatibility for legacy subtabs
    if (["incidents", "heatmap", "analytics", "schedules", "reviews"].includes(tabParam as any)) {
      return "reports";
    }
    return "dashboard";
  });

  const [reportsSubTab, setReportsSubTab] = useState<"analytics" | "heatmap" | "incidents" | "schedules" | "reviews">(() => {
    if (["incidents", "heatmap", "analytics", "schedules", "reviews"].includes(tabParam as any)) {
      return tabParam as any;
    }
    return "analytics";
  });

  // Mobile sidebar drawer
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Global search input in top navbar
  const [navbarSearch, setNavbarSearch] = useState("");

  // Data states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [trailsList, setTrailsList] = useState<TrailRecord[]>([]);
  const [guidesList, setGuidesList] = useState<any[]>([]);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [emailsAvailable, setEmailsAvailable] = useState(false);

  // Modals & sub-actions
  const [selectedRosterBooking, setSelectedRosterBooking] = useState<Booking | null>(null);
  const [assigningBooking, setAssigningBooking] = useState<Booking | null>(null);
  const [selectedGuideId, setSelectedGuideId] = useState<string>("");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newUserRole, setNewUserRole] = useState<string>("trekker");
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [editingTrail, setEditingTrail] = useState<TrailRecord | null>(null);
  const [newTrailLimit, setNewTrailLimit] = useState<number>(50);

  // Bookings tab filters & search
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("all");
  const [bookingTrailFilter, setBookingTrailFilter] = useState<string>("all");

  // Users tab filters & search
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");

  // FAQs state
  const [faqs, setFaqs] = useState([
    { id: 1, question: "How early should trekkers book their permit?", answer: "Trekkers must register and book at least 2 weeks before their intended trek date to allow document verification.", category: "Booking" },
    { id: 2, question: "What is the mandatory guide-to-trekker ratio?", answer: "Under DENR NNNP protected area guidelines, exactly 1 accredited tour guide is required for every 5 trekkers (1:5 ratio).", category: "Safety" },
    { id: 3, question: "What documents must be uploaded for verification?", answer: "Each lead climber must submit a Government-issued Valid ID, a Signed NNNP Trekking Waiver Form, and a valid Fit-to-Climb Medical Certificate.", category: "Requirements" },
    { id: 4, question: "Where do approved climbers pay and claim paper permits?", answer: "Climbers whose status is Approved must proceed to the official DENR NNNP Office in Bacolod City / Silay Outpost to settle fee payments and claim physical permit forms.", category: "Permits" }
  ]);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [newFaqQ, setNewFaqQ] = useState("");
  const [newFaqA, setNewFaqA] = useState("");
  const [newFaqCat, setNewFaqCat] = useState("Booking");

  // Sync activeTab with URL param
  const handleTabChange = (newTab: TabType) => {
    setActiveTab(newTab);
    setIsSidebarOpen(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", newTab);
      return next;
    });
  };

  // Primary data fetcher
  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(null);

      // 1. Fetch Bookings with join on trails & profiles
      try {
        const { data: bookingsData, error: bErr } = await supabase
          .from("bookings")
          .select(`
            id,
            user_id,
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
            trails (id, name, weekly_slots)
          `)
          .order("created_at", { ascending: false });

        if (bErr) {
          console.warn("Bookings query with guide join failed, falling back:", bErr);
          const { data: fbData, error: fbErr } = await supabase
            .from("bookings")
            .select(`
              id,
              user_id,
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
              trails (id, name, weekly_slots)
            `)
            .order("created_at", { ascending: false });

          if (!fbErr && fbData) {
            setBookings((fbData as unknown as Booking[]) || []);
          }
        } else if (bookingsData) {
          setBookings((bookingsData as unknown as Booking[]) || []);
        }
      } catch (err) {
        console.warn("Failed to fetch bookings:", err);
      }

      // 2. Fetch Profiles (Users) — use RPC to get real auth emails
      try {
        // Try the RPC that joins auth.users for real emails
        const { data: rpcData, error: rpcErr } = await (supabase as any)
          .rpc("get_profiles_with_email");

        if (!rpcErr && rpcData && rpcData.length > 0) {
          setUsersList(rpcData as UserProfile[]);
          setEmailsAvailable(true);
        } else {
          setEmailsAvailable(false);
          // Fallback: direct profiles query — explicitly select email column
          const { data: profilesData, error: pErr } = await supabase
            .from("profiles")
            .select("id, full_name, phone, role, nationality, bio, experience_years, certifications, is_available, guide_application_status, created_at, email")
            .order("created_at", { ascending: false });
          if (pErr) {
            console.warn("Profiles query order error, falling back:", pErr);
            const { data: fallbackProfiles } = await (supabase as any).from("profiles").select("id, full_name, phone, role, nationality, guide_application_status, email");
            if (fallbackProfiles) setUsersList(fallbackProfiles as UserProfile[]);
          } else if (profilesData) {
            // Check if emails are available from the profiles table directly
            const hasEmails = (profilesData as any[]).some((p) => p.email);
            if (hasEmails) setEmailsAvailable(true);
            setUsersList(profilesData as unknown as UserProfile[]);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch profiles:", err);
        setEmailsAvailable(false);
      }

      // 3. Fetch Trails
      try {
        const { data: trailsData, error: tErr } = await supabase
          .from("trails")
          .select("*")
          .order("name");
        if (tErr) console.warn("Trails query error:", tErr);
        if (trailsData) setTrailsList(trailsData as unknown as TrailRecord[]);
      } catch (err) {
        console.warn("Failed to fetch trails:", err);
      }

      // 4. Fetch Guides
      try {
        const { data: guidesData, error: gErr } = await supabase
          .from("profiles")
          .select("id, full_name, experience_years, is_available, guide_application_status, phone")
          .eq("role", "guide")
          .order("full_name");
        if (gErr) console.warn("Guides query error:", gErr);
        if (guidesData) setGuidesList(guidesData);
      } catch (err) {
        console.warn("Failed to fetch guides:", err);
      }

      // 5. Fetch Notifications
      try {
        const { data: notifsData, error: nErr } = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);
        if (nErr) console.warn("Notifications query error:", nErr);
        if (notifsData) setNotificationsList(notifsData as NotificationItem[]);
      } catch (err) {
        console.warn("Failed to fetch notifications:", err);
      }

    } catch (err: unknown) {
      console.error("Dashboard Fetch Error:", err);
      const message = err instanceof Error ? err.message : "Failed to load dashboard data.";
      setFetchError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Realtime listener for incoming bookings & updates
    const channel = supabase
      .channel("admin-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Summary Metrics calculations
  const totalUsers = usersList.length;
  const totalTrails = trailsList.length;
  const pendingBookings = bookings.filter((b) => b.status === "pending").length;
  const approvedBookings = bookings.filter((b) => b.status === "approved").length;
  const pendingPermits = bookings.filter((b) => b.status === "pending" || (!b.permit_number && b.status === "approved")).length;
  const availableGuides = guidesList.filter((g) => g.is_available !== false).length;
  const pendingGuideApps = usersList.filter((u) => u.guide_application_status === "pending").length;

  // Booking status updater
  const updateBookingStatus = async (id: string, status: BookingStatus) => {
    try {
      const target = bookings.find((b) => b.id === id);
      const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
      if (error) throw error;

      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));

      if (status === "approved" && target?.user_id) {
        const refNo = target.permit_number || `NNNP-${new Date().getFullYear()}-${id.slice(0, 6).toUpperCase()}`;
        // Auto issue permit number if not present
        if (!target.permit_number) {
          await supabase.from("bookings").update({ permit_number: refNo }).eq("id", id);
          setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, permit_number: refNo } : b)));
        }

        await supabase.from("notifications").insert({
          user_id: target.user_id,
          title: "🎉 Booking Approved — Payment & Permit Claim",
          message: `Your booking for ${target.trails?.name || "Trekking Trail"} on ${target.climb_date} (Permit Ref: ${refNo}) has been APPROVED! Please proceed to the DENR NNNP Office to settle the fee and claim your paper permit.`,
          type: "booking_approved",
          read: false,
          link: "/my-bookings",
          entity_id: id,
        });

        toast.success("Booking approved & permit issued! Trekker has been notified.");
      } else if (status === "rejected" && target?.user_id) {
        await supabase.from("notifications").insert({
          user_id: target.user_id,
          title: "Trekking Booking Not Approved",
          message: `Your booking request for ${target.trails?.name || "Trail"} on ${target.climb_date} could not be approved at this time.`,
          type: "booking_rejected",
          read: false,
          link: "/my-bookings",
          entity_id: id,
        });
        toast.info("Booking marked as rejected.");
      }
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  // Manual Guide Assignment
  const handleAssignGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningBooking || !selectedGuideId) return;

    try {
      const { error } = await supabase
        .from("bookings")
        .update({ guide_id: selectedGuideId })
        .eq("id", assigningBooking.id);

      if (error) throw error;

      // Send instant notification to the assigned guide
      try {
        await supabase.from("notifications").insert({
          user_id: selectedGuideId,
          title: "🧭 New Trekking Assignment",
          message: `Admin has assigned you to lead a trek on ${assigningBooking.climb_date} for ${assigningBooking.trails?.name || "NNNP Trail"} (${assigningBooking.group_size || 1} trekkers). Please review on your Guide Dashboard.`,
          type: "booking_assignment",
          read: false,
          link: "/guide",
          entity_id: assigningBooking.id,
        });
      } catch (notifErr) {
        console.warn("Could not notify assigned guide:", notifErr);
      }

      toast.success("Tour guide assigned & notified successfully!");
      setAssigningBooking(null);
      setSelectedGuideId("");
      fetchData();
    } catch (err: any) {
      toast.error("Failed to assign guide: " + err.message);
    }
  };

  // User Role Updater
  const handleUpdateUserRole = async () => {
    if (!editingUser) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newUserRole as any })
        .eq("id", editingUser.id);

      if (error) throw error;

      // Notify the user about their role change
      const roleLabels: Record<string, string> = {
        trekker: "Trekker (Regular User)",
        guide: "Accredited Tour Guide",
        admin: "Administrator",
      };
      try {
        await supabase.from("notifications").insert({
          user_id: editingUser.id,
          title: "🔄 Account Role Updated",
          message: `Your TAKAZZ NNNP account role has been updated to: ${roleLabels[newUserRole] || newUserRole.toUpperCase()} by the system administrator.`,
          type: "booking_created",
          read: false,
          link: "/profile",
        });
      } catch (notifErr) {
        console.warn("Could not notify user about role change:", notifErr);
      }

      toast.success(`User role updated to ${newUserRole.toUpperCase()} ✓`);
      setUsersList((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, role: newUserRole } : u))
      );
      setEditingUser(null);
    } catch (err: any) {
      toast.error("Failed to update user role: " + err.message);
    }
  };

  // User Account Deletion Handler
  const handleDeleteUserAccount = async () => {
    if (!deletingUser) return;
    if (deletingUser.id === user?.id) {
      toast.error("You cannot delete your own admin account while logged in.");
      return;
    }

    setIsDeletingUser(true);
    try {
      // 1. Attempt server-side delete_user_account RPC
      const { error: rpcError } = await (supabase as any).rpc("delete_user_account", {
        p_user_id: deletingUser.id,
      });

      if (rpcError) {
        console.warn("delete_user_account RPC error, trying direct profile deletion fallback:", rpcError);
        // Fallback: direct delete from public.profiles
        const { error: pErr } = await supabase
          .from("profiles")
          .delete()
          .eq("id", deletingUser.id);

        if (pErr) throw pErr;
      }

      setUsersList((prev) => prev.filter((u) => u.id !== deletingUser.id));
      toast.success(`Account for ${deletingUser.full_name || "User"} deleted successfully.`);
      setDeletingUser(null);
    } catch (err: any) {
      toast.error("Failed to delete account: " + (err.message || "Unknown error"));
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Trail Quota Limit / Active toggle
  const handleSaveTrail = async () => {
    if (!editingTrail) return;
    try {
      const { error } = await supabase
        .from("trails")
        .update({ weekly_slots: newTrailLimit, active: editingTrail.active ?? true })
        .eq("id", editingTrail.id);

      if (error) throw error;

      toast.success("Trail configuration updated!");
      setTrailsList((prev) =>
        prev.map((t) => (t.id === editingTrail.id ? { ...t, weekly_slots: newTrailLimit, active: editingTrail.active } : t))
      );
      setEditingTrail(null);
    } catch (err: any) {
      toast.error("Failed to update trail: " + err.message);
    }
  };

  // Filtered Bookings for Management Tab
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Global navbar search or tab search
      const q = (bookingSearch || navbarSearch).toLowerCase().trim();
      const trekkerName = (b.profiles?.full_name || "").toLowerCase();
      const trekkerEmail = (b.profiles?.email || "").toLowerCase();
      const permitNo = (b.permit_number || "").toLowerCase();
      const trailName = (b.trails?.name || "").toLowerCase();
      const climbDate = b.climb_date || "";

      const matchesSearch =
        !q ||
        trekkerName.includes(q) ||
        trekkerEmail.includes(q) ||
        permitNo.includes(q) ||
        trailName.includes(q) ||
        climbDate.includes(q);

      const matchesStatus =
        bookingStatusFilter === "all" || b.status.toLowerCase() === bookingStatusFilter.toLowerCase();

      const matchesTrail =
        bookingTrailFilter === "all" || b.trail_id === bookingTrailFilter;

      return matchesSearch && matchesStatus && matchesTrail;
    });
  }, [bookings, bookingSearch, navbarSearch, bookingStatusFilter, bookingTrailFilter]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const q = userSearch.toLowerCase().trim();
      const name = (u.full_name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const phone = (u.phone || "").toLowerCase();
      const matchesSearch = !q || name.includes(q) || email.includes(q) || phone.includes(q);
      const matchesRole = userRoleFilter === "all" || u.role.toLowerCase() === userRoleFilter.toLowerCase();
      return matchesSearch && matchesRole;
    });
  }, [usersList, userSearch, userRoleFilter]);

  // Sidebar navigation menu items
  const SIDEBAR_ITEMS: {
    group: string;
    items: {
      id: TabType;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number;
      badgeColor?: string;
    }[];
  }[] = [
    {
      group: "MAIN",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      group: "OPERATIONS",
      items: [
        { id: "users", label: "User Management", icon: Users, badge: totalUsers },
        { id: "trails", label: "Trekking Trail Management", icon: Mountain, badge: totalTrails },
        { id: "bookings", label: "Booking Management", icon: CalendarCheck, badge: pendingBookings > 0 ? pendingBookings : undefined, badgeColor: "bg-amber-500" },
        { id: "permits", label: "Permit & Document Verification", icon: FileCheck, badge: pendingPermits > 0 ? pendingPermits : undefined, badgeColor: "bg-emerald-500" },
        { id: "guides", label: "Guide Management", icon: Compass, badge: pendingGuideApps > 0 ? pendingGuideApps : undefined, badgeColor: "bg-red-500" },
      ],
    },
    {
      group: "CONTENT & NAVIGATION",
      items: [
        { id: "navigation", label: "Maps and Directions", icon: MapPin },
        { id: "advisories", label: "Advisories Management", icon: Megaphone },
        { id: "faq", label: "FAQ Management", icon: HelpCircle },
      ],
    },
    {
      group: "INSIGHTS & SYSTEM",
      items: [
        { id: "notifications", label: "Notifications", icon: BellRing, badge: notificationsList.filter(n => !n.read).length || undefined, badgeColor: "bg-red-500" },
        { id: "reports", label: "Reports and Activity Logs", icon: BarChart3 },
        { id: "settings", label: "Account Settings", icon: Settings },
      ],
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans">
      
      {/* ======================================================== */}
      {/* 1. LEFT SIDEBAR (Desktop & Mobile Drawer)                 */}
      {/* ======================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-emerald-950 text-white flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-emerald-900/80 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0">
              <img src="/takazz-logo.png" alt="TAKAZZ" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-black text-lg tracking-wider text-white block leading-tight">
                TAKAZZ
              </span>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-widest block">
                DENR NNNP Admin
              </span>
            </div>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-xl hover:bg-emerald-900 text-emerald-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Admin User Pill in Sidebar */}
        <div className="p-4 mx-3 my-3 bg-emerald-900/60 border border-emerald-800/80 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-emerald-400 text-emerald-950 font-black text-sm flex items-center justify-center shadow-xs shrink-0">
            {profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : "AD"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">
              {profile?.full_name || "Administrator"}
            </p>
            <span className="inline-block mt-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-200 bg-emerald-800/80 px-2 py-0.5 rounded-md">
              Full Administrator
            </span>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6 text-xs">
          {SIDEBAR_ITEMS.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <p className="px-3 text-[10px] font-black uppercase tracking-widest text-emerald-400/80 mb-2">
                {section.group}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold transition-all text-left ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900"
                        : "text-emerald-100/80 hover:bg-emerald-900/70 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-emerald-400"}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white shrink-0 ${
                          item.badgeColor || (isActive ? "bg-emerald-800" : "bg-emerald-900")
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer Link */}
        <div className="p-4 border-t border-emerald-900/80 text-[11px] text-emerald-300/80 space-y-2">
          <Link
            to="/"
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 text-white font-bold transition"
          >
            <span className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-emerald-400" /> Public Website
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
          </Link>
          <div className="flex items-center justify-between px-2 pt-1 text-[10px] text-emerald-400/60">
            <span>DENR-NNNP Protected Area</span>
            <span className="font-mono">v2.4 Pro</span>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile drawer */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* ======================================================== */}
      {/* 2. MAIN VIEWPORT (TOP NAVBAR + DASHBOARD CONTENT)        */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* TOP NAVIGATION BAR */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100"
              aria-label="Open Navigation"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
              <span className="hidden sm:inline">TAKAZZ Admin</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="text-slate-900 font-bold capitalize text-sm">
                {activeTab.replace("-", " ")}
              </span>
            </div>
          </div>

          {/* Center Search Input */}
          <div className="hidden md:flex items-center relative w-72 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder="Quick search bookings, users..."
              value={navbarSearch}
              onChange={(e) => setNavbarSearch(e.target.value)}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
            />
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Database status pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>System Online</span>
            </div>

            {/* Quick Refresh */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              title="Refresh Dashboard Data"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-emerald-600" : ""} />
            </button>

            {/* Notifications Button */}
            <button
              onClick={() => handleTabChange("notifications")}
              className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              title="View System Notifications"
            >
              <BellRing size={16} />
              {notificationsList.filter((n) => !n.read).length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </button>

            {/* Admin Profile Dropdown */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : "AD"}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {profile?.full_name || "Administrator"}
                </span>
                <span className="text-[10px] font-semibold text-emerald-700">Administrator</span>
              </div>
              <button
                onClick={() => {
                  signOut();
                  navigate("/login");
                }}
                className="ml-1 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                title="Sign Out of Admin Console"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        {/* ======================================================== */}
        {/* 3. DYNAMIC CONTENT AREA BASED ON ACTIVE TAB              */}
        {/* ======================================================== */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Welcome Banner */}
              <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-6 sm:p-8 rounded-3xl shadow-sm relative overflow-hidden">
                <div className="relative z-10 max-w-2xl">
                  <span className="text-[11px] font-black uppercase tracking-widest text-emerald-200 bg-white/10 px-3 py-1 rounded-full">
                    Protected Area Executive Console
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black mt-3">
                    Welcome back, {profile?.full_name || "Administrator"}
                  </h1>
                  <p className="text-emerald-100 text-xs sm:text-sm mt-1 leading-relaxed">
                    Northern Negros Natural Park (NNNP) online permit booking & ecotourism dashboard. Review pending climber documents, oversee accredited guide rosters, and monitor live trail density.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-10 translate-y-10">
                  <Mountain size={280} />
                </div>
              </div>

              {/* 6 Key Metrics Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* 1. Total Users */}
                <div
                  onClick={() => handleTabChange("users")}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Total Users</span>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Users size={16} /></div>
                  </div>
                  <p className="text-2xl font-black text-slate-900">{totalUsers}</p>
                  <span className="text-[10px] text-slate-400">Registered Trekkers</span>
                </div>

                {/* 2. Total Trails */}
                <div
                  onClick={() => handleTabChange("trails")}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Trek Trails</span>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Mountain size={16} /></div>
                  </div>
                  <p className="text-2xl font-black text-slate-900">{totalTrails}</p>
                  <span className="text-[10px] text-slate-400">Designated Routes</span>
                </div>

                {/* 3. Pending Requests */}
                <div
                  onClick={() => handleTabChange("bookings")}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-500 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Pending Bookings</span>
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Clock size={16} /></div>
                  </div>
                  <p className="text-2xl font-black text-amber-700">{pendingBookings}</p>
                  <span className="text-[10px] text-amber-600 font-bold">Needs Review</span>
                </div>

                {/* 4. Approved Bookings */}
                <div
                  onClick={() => handleTabChange("bookings")}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Approved Bookings</span>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle2 size={16} /></div>
                  </div>
                  <p className="text-2xl font-black text-emerald-700">{approvedBookings}</p>
                  <span className="text-[10px] text-emerald-600 font-bold">Permits Issued</span>
                </div>

                {/* 5. Pending Permits */}
                <div
                  onClick={() => handleTabChange("permits")}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Pending Permits</span>
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><FileCheck size={16} /></div>
                  </div>
                  <p className="text-2xl font-black text-purple-700">{pendingPermits}</p>
                  <span className="text-[10px] text-slate-400">Document Verification</span>
                </div>

                {/* 6. Available Guides */}
                <div
                  onClick={() => handleTabChange("guides")}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Active Guides</span>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Compass size={16} /></div>
                  </div>
                  <p className="text-2xl font-black text-emerald-800">{availableGuides}</p>
                  <span className="text-[10px] text-slate-400">{guidesList.length} Total Guides</span>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-600" /> Admin Quick Actions:
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => handleTabChange("permits")}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200 transition"
                  >
                    Verify Pending Permits ({pendingPermits})
                  </button>
                  <button
                    onClick={() => handleTabChange("users")}
                    className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition"
                  >
                    Manage User Accounts
                  </button>
                  <button
                    onClick={() => handleTabChange("advisories")}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl border border-amber-200 transition"
                  >
                    Post Park Advisory
                  </button>
                  <button
                    onClick={() => {
                      handleTabChange("reports");
                      setReportsSubTab("analytics");
                    }}
                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold rounded-xl border border-blue-200 transition"
                  >
                    Export Excel Reports
                  </button>
                </div>
              </div>

              {/* Two Column Grid: Recent Bookings & Pending Approvals Feed */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Recent Bookings */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Recent Booking Activities</h3>
                      <p className="text-xs text-slate-500">Latest permit registration submissions and status</p>
                    </div>
                    <button
                      onClick={() => handleTabChange("bookings")}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      View All ({bookings.length}) <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b">
                        <tr>
                          <th className="py-3 px-3">Trekker</th>
                          <th className="py-3 px-3">Trail & Date</th>
                          <th className="py-3 px-3">Pax</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bookings.slice(0, 6).map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-900 block">{b.profiles?.full_name || "Lead Climber"}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{b.permit_number || b.id.slice(0, 8)}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-semibold text-slate-800 block">{b.trails?.name || "NNNP Trail"}</span>
                              <span className="text-[10px] text-slate-400">{b.climb_date}</span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700">
                              {b.group_size} Pax
                            </td>
                            <td className="py-3 px-3">
                              <StatusBadge status={b.status} />
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedRosterBooking(b);
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                              >
                                View Roster
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right 1 Col: Pending Approvals & Live Notifications */}
                <div className="space-y-6">
                  {/* Pending Action Box */}
                  <div className="bg-amber-50/80 border border-amber-200 rounded-3xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600" /> Pending Approval Queue
                      </h4>
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                        {pendingBookings}
                      </span>
                    </div>

                    {pendingBookings === 0 ? (
                      <p className="text-xs text-amber-700">All pending bookings have been reviewed! 🎉</p>
                    ) : (
                      <div className="space-y-2.5 max-h-64 overflow-y-auto">
                        {bookings
                          .filter((b) => b.status === "pending")
                          .slice(0, 4)
                          .map((b) => (
                            <div key={b.id} className="bg-white p-3 rounded-xl border border-amber-200/60 shadow-xs flex items-center justify-between gap-2 text-xs">
                              <div>
                                <p className="font-bold text-slate-900 truncate max-w-[120px]">{b.profiles?.full_name || "Trekker"}</p>
                                <p className="text-[10px] text-slate-500">{b.trails?.name} • {b.climb_date}</p>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => updateBookingStatus(b.id, "approved")}
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                                  title="Approve"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => updateBookingStatus(b.id, "rejected")}
                                  className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
                                  title="Reject"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* System Notifications Feed */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <BellRing className="w-4 h-4 text-emerald-600" /> Recent System Alerts
                      </h4>
                      <button
                        onClick={() => handleTabChange("notifications")}
                        className="text-[11px] font-bold text-emerald-700 hover:underline"
                      >
                        All
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-60 overflow-y-auto">
                      {notificationsList.slice(0, 4).map((n) => (
                        <div key={n.id} className="p-2.5 bg-slate-50 rounded-xl text-xs space-y-0.5">
                          <p className="font-bold text-slate-900 text-[11px]">{n.title}</p>
                          <p className="text-[11px] text-slate-600 line-clamp-2">{n.message}</p>
                          <span className="text-[9px] text-slate-400 block pt-0.5">
                            {new Date(n.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === "users" && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">User Management Console</h2>
                  <p className="text-xs text-slate-500">Manage registered user accounts, assign roles, and inspect climber profiles</p>
                </div>

              {/* ⚠️ Email setup banner — shown when RPC not yet applied */}
              {!emailsAvailable && (
                <div className="w-full mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-900">Emails not showing — one-time DB setup required</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Run <code className="bg-amber-100 px-1 rounded font-mono">fix_emails_rpc.sql</code> in your{" "}
                      <a
                        href="https://supabase.com/dashboard/project/kmmgtcyegvbrgsdbdtsh/sql/new"
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-bold text-amber-800 hover:text-amber-900"
                      >
                        Supabase SQL Editor ↗
                      </a>{" "}
                      to enable the <code className="bg-amber-100 px-1 rounded font-mono">get_profiles_with_email</code> function.
                    </p>
                  </div>
                  <a
                    href="https://supabase.com/dashboard/project/kmmgtcyegvbrgsdbdtsh/sql/new"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-xl transition shrink-0"
                  >
                    Open SQL Editor
                  </a>
                </div>
              )}

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-8 pr-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-60"
                    />
                  </div>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="border rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="all">All Roles ({usersList.length})</option>
                    <option value="trekker">Trekkers</option>
                    <option value="guide">Tour Guides</option>
                    <option value="admin">Administrators</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Nationality</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-xs">
                              {u.full_name ? u.full_name.substring(0, 2).toUpperCase() : "U"}
                            </div>
                            <span className="font-bold text-slate-900">{u.full_name || "User"}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{u.email || "No email on record"}</td>
                        <td className="py-3.5 px-4 text-slate-600">{u.phone || "N/A"}</td>
                        <td className="py-3.5 px-4 text-slate-600">{u.nationality || "Filipino"}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase border ${
                              u.role === "admin"
                                ? "bg-red-100 text-red-800 border-red-200"
                                : u.role === "guide"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : "bg-emerald-100 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setNewUserRole(u.role || "trekker");
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 font-bold rounded-xl text-[11px] transition"
                            >
                              Edit Role
                            </button>
                            {u.id !== user?.id && (
                              <button
                                onClick={() => setDeletingUser(u)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                                title={`Delete account for ${u.full_name || "User"}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TREKKING TRAIL MANAGEMENT */}
          {activeTab === "trails" && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Protected Trekking Trails</h2>
                  <p className="text-xs text-slate-500">Manage trail capacity quotas, daily limits, and active reservation status</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {trailsList.map((t) => {
                  const meta = NNNP_TRAILS_METADATA[t.id] || Object.values(NNNP_TRAILS_METADATA).find(m => m.name.toLowerCase().includes(t.name.toLowerCase()));
                  return (
                    <div key={t.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between">
                      <div className="relative h-40 bg-slate-900">
                        <img
                          src={meta?.imageUrl || "/images/trails/kumalisikis.jpg"}
                          alt={t.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 right-3">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full text-white shadow-xs ${t.active ? "bg-emerald-600" : "bg-red-600"}`}>
                            {t.active ? "Active" : "Closed"}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{t.name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{t.barangay}, {t.city}</p>
                          <div className="mt-3 pt-2 border-t text-[11px] text-slate-600 space-y-1">
                            <p>Elevation: <strong>{meta?.elevation || "Highland"}</strong></p>
                            <p>Weekly Capacity Limit: <strong>{t.weekly_slots || 50} Trekkers/Week</strong></p>
                          </div>
                        </div>

                        <div className="pt-2 flex gap-2">
                          <button
                            onClick={() => {
                              setEditingTrail(t);
                              setNewTrailLimit(t.weekly_slots || 50);
                            }}
                            className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs transition"
                          >
                            Configure Limits
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: BOOKING MANAGEMENT */}
          {activeTab === "bookings" && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Trekking Booking Management</h2>
                  <p className="text-xs text-slate-500">Review climber submissions, approve permits, and assign accredited tour guides</p>
                </div>
                
                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search bookings, permit #..."
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                      className="pl-8 pr-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-60"
                    />
                  </div>
                  <select
                    value={bookingStatusFilter}
                    onChange={(e) => setBookingStatusFilter(e.target.value)}
                    className="border rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending ({pendingBookings})</option>
                    <option value="approved">Approved ({approvedBookings})</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b">
                    <tr>
                      <th className="py-3 px-4">Permit / Trekker</th>
                      <th className="py-3 px-4">Destination & Date</th>
                      <th className="py-3 px-4">Tour Guide</th>
                      <th className="py-3 px-4">Climber Pax</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{b.profiles?.full_name || "Lead Climber"}</span>
                          <span className="text-[10px] text-emerald-700 font-mono font-bold block">{b.permit_number || `REF-${b.id.slice(0, 8).toUpperCase()}`}</span>
                          <span className="text-[10px] text-slate-400">{b.profiles?.phone || b.emergency_contact_phone || "No phone"}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-900 block">{b.trails?.name}</span>
                          <span className="text-[10px] text-slate-500">{b.climb_date}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          {b.guides?.name ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                              <Compass size={12} /> {b.guides.name}
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setAssigningBooking(b);
                                setSelectedGuideId("");
                              }}
                              className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition"
                            >
                              + Assign Guide
                            </button>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800">{b.group_size} Pax</span>
                          <button
                            onClick={() => setSelectedRosterBooking(b)}
                            className="block text-[10px] text-emerald-700 hover:underline mt-0.5"
                          >
                            View Names ({getBookingParticipants(b)?.length || b.group_size})
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={b.status} />
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          {b.status === "pending" && (
                            <>
                              <button
                                onClick={() => updateBookingStatus(b.id, "approved")}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateBookingStatus(b.id, "rejected")}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-[11px] transition"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setSelectedRosterBooking(b)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: PERMIT & DOCUMENT VERIFICATION */}
          {activeTab === "permits" && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="border-b pb-4">
                <h2 className="text-lg font-bold text-slate-900">Permit & Document Verification Queue</h2>
                <p className="text-xs text-slate-500">Inspect uploaded government IDs, waivers, and medical certificates before granting trekking permits</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {bookings.filter(b => b.status === "pending" || !b.permit_number).map((b) => (
                  <div key={b.id} className="border border-slate-200 rounded-2xl p-5 space-y-4 hover:shadow-md transition bg-slate-50/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">{b.profiles?.full_name || "Lead Climber"}</span>
                        <span className="text-xs text-slate-500">{b.trails?.name} • {b.climb_date}</span>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>

                    {/* Requirements checklist */}
                    <div className="space-y-2 pt-1 border-t text-xs">
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white border">
                        <span className="font-semibold text-slate-700">Government Valid ID</span>
                        {b.valid_id_url ? (
                          <a href={b.valid_id_url} target="_blank" rel="noreferrer" className="text-emerald-700 font-bold hover:underline flex items-center gap-1">
                            <Eye size={12} /> Inspect
                          </a>
                        ) : (
                          <span className="text-red-500 font-semibold">Missing</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-white border">
                        <span className="font-semibold text-slate-700">Signed NNNP Waiver</span>
                        {b.waiver_url ? (
                          <a href={b.waiver_url} target="_blank" rel="noreferrer" className="text-emerald-700 font-bold hover:underline flex items-center gap-1">
                            <Eye size={12} /> Inspect
                          </a>
                        ) : (
                          <span className="text-red-500 font-semibold">Missing</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-white border">
                        <span className="font-semibold text-slate-700">Medical Certificate</span>
                        {b.medical_cert_url ? (
                          <a href={b.medical_cert_url} target="_blank" rel="noreferrer" className="text-emerald-700 font-bold hover:underline flex items-center gap-1">
                            <Eye size={12} /> Inspect
                          </a>
                        ) : (
                          <span className="text-red-500 font-semibold">Missing</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => updateBookingStatus(b.id, "approved")}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
                      >
                        Approve & Issue Permit
                      </button>
                      <button
                        onClick={() => updateBookingStatus(b.id, "rejected")}
                        className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-xl text-xs transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: GUIDE MANAGEMENT (Embeds full AdminGuides) */}
          {activeTab === "guides" && (
            <div className="space-y-4">
              <AdminGuides />
            </div>
          )}

          {/* TAB 7: MAPS AND DIRECTIONS */}
          {activeTab === "navigation" && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="border-b pb-4">
                <h2 className="text-lg font-bold text-slate-900">Maps & Trailhead Directions</h2>
                <p className="text-xs text-slate-500">Official DENR outpost GPS landmarks, meeting points, and navigation links</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(NNNP_TRAILS_METADATA).map(([id, trail]) => (
                  <div key={id} className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-black text-slate-900 text-base">{trail.name}</h3>
                        <p className="text-xs text-slate-500">{trail.barangay}, {trail.city}</p>
                      </div>
                      <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                        {trail.lat.toFixed(4)}°N, {trail.lng.toFixed(4)}°E
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border text-xs space-y-1">
                      <p className="font-bold text-slate-800">Meeting Point / Outpost:</p>
                      <p className="text-slate-600">{trail.meetingPoint.name}</p>
                      <p className="text-[11px] text-slate-500 italic">{trail.meetingPoint.address}</p>
                    </div>

                    <div className="flex gap-2 text-xs">
                      <a
                        href={trail.navigationUrls.googleMaps}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 text-center bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <MapPin size={14} /> Open Google Maps
                      </a>
                      <a
                        href={trail.navigationUrls.waze}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2 text-center bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <Compass size={14} /> Open Waze
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: ADVISORIES MANAGEMENT (Embeds AnnouncementManager) */}
          {activeTab === "advisories" && (
            <div className="space-y-4">
              <AnnouncementManager />
            </div>
          )}

          {/* TAB 9: FAQ MANAGEMENT */}
          {activeTab === "faq" && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">FAQ Content Management</h2>
                  <p className="text-xs text-slate-500">Provide official guidance for trekkers regarding bookings, permits, and park rules</p>
                </div>
                <button
                  onClick={() => setFaqModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus size={16} /> Add FAQ Item
                </button>
              </div>

              <div className="space-y-3">
                {faqs.map((f) => (
                  <div key={f.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/50 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{f.question}</span>
                      <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                        {f.category}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{f.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 10: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">System Notifications & Alerts</h2>
                  <p className="text-xs text-slate-500">Real-time alerts for incoming registrations, guide submissions, and cancellations</p>
                </div>
                <button
                  onClick={async () => {
                    await supabase.from("notifications").update({ read: true }).neq("read", true);
                    setNotificationsList(prev => prev.map(n => ({ ...n, read: true })));
                    toast.success("All notifications marked as read");
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Mark All Read
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {notificationsList.map((n) => (
                  <div key={n.id} className={`py-3.5 flex items-start justify-between gap-4 text-xs ${n.read ? "opacity-75" : "bg-emerald-50/30 p-3 rounded-2xl mb-1"}`}>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
                        <BellRing size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{n.title}</p>
                        <p className="text-slate-600 mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 11: REPORTS AND ACTIVITY LOGS */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              {/* Subtab navigation */}
              <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/80 rounded-2xl w-fit text-xs font-bold">
                <button
                  onClick={() => setReportsSubTab("analytics")}
                  className={`px-4 py-2 rounded-xl transition ${reportsSubTab === "analytics" ? "bg-white text-emerald-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  📊 Visitor Analytics & Excel
                </button>
                <button
                  onClick={() => setReportsSubTab("heatmap")}
                  className={`px-4 py-2 rounded-xl transition ${reportsSubTab === "heatmap" ? "bg-white text-emerald-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  🔥 Trail Heat Map
                </button>
                <button
                  onClick={() => setReportsSubTab("incidents")}
                  className={`px-4 py-2 rounded-xl transition ${reportsSubTab === "incidents" ? "bg-white text-emerald-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  ⚠️ Field Incidents & Safety
                </button>
                <button
                  onClick={() => setReportsSubTab("schedules")}
                  className={`px-4 py-2 rounded-xl transition ${reportsSubTab === "schedules" ? "bg-white text-emerald-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  📅 Schedules & Quota Controls
                </button>
                <button
                  onClick={() => setReportsSubTab("reviews")}
                  className={`px-4 py-2 rounded-xl transition ${reportsSubTab === "reviews" ? "bg-white text-emerald-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                >
                  ⭐ Ratings & Feedback
                </button>
              </div>

              {/* Subtab Views */}
              {reportsSubTab === "analytics" && (
                <AdminAnalytics bookings={bookings} guides={guidesList} trails={trailsList} />
              )}
              {reportsSubTab === "heatmap" && (
                <TrekkingHeatMap bookings={bookings} />
              )}
              {reportsSubTab === "incidents" && (
                <AdminIncidents />
              )}
              {reportsSubTab === "schedules" && (
                <ScheduleManagement bookings={bookings} trails={trailsList} />
              )}
              {reportsSubTab === "reviews" && (
                <ReviewsManager />
              )}
            </div>
          )}

          {/* TAB 12: ACCOUNT SETTINGS */}
          {activeTab === "settings" && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6 max-w-3xl">
              <div className="border-b pb-4">
                <h2 className="text-lg font-bold text-slate-900">Administrator Account Settings</h2>
                <p className="text-xs text-slate-500">System credentials and administrative security overview</p>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border">
                <div className="w-14 h-14 rounded-2xl bg-emerald-800 text-white font-black text-xl flex items-center justify-center">
                  {profile?.full_name ? profile.full_name.substring(0, 2).toUpperCase() : "AD"}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{profile?.full_name || "Administrator"}</h3>
                  <p className="text-xs text-slate-500">{user?.email || ""}</p>
                  <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                    Administrator Account
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1">
                  <p className="font-bold text-emerald-950">Administrative Access Verification:</p>
                  <p className="text-emerald-800 leading-relaxed">
                    This account possesses unrestricted full system permissions across user accounts, booking approvals, permit verification, guide accreditations, and database records.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Link
                    to="/profile"
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition"
                  >
                    Edit Profile Details
                  </Link>
                  <button
                    onClick={() => {
                      signOut();
                      navigate("/login");
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 font-bold rounded-xl transition"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ======================================================== */}
      {/* MODALS & DIALOGS                                         */}
      {/* ======================================================== */}

      {/* Participant Pax Roster Details Modal */}
      {selectedRosterBooking && (
        <Dialog open={!!selectedRosterBooking} onOpenChange={() => setSelectedRosterBooking(null)}>
          <DialogContent className="max-w-xl bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Climber Roster & Registration Details
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {selectedRosterBooking.trails?.name} • {selectedRosterBooking.climb_date}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border space-y-1">
                <p><strong>Permit Ref:</strong> {selectedRosterBooking.permit_number || selectedRosterBooking.id}</p>
                <p><strong>Lead Trekker:</strong> {selectedRosterBooking.profiles?.full_name}</p>
                <p><strong>Emergency Contact:</strong> {selectedRosterBooking.emergency_contact_name} ({selectedRosterBooking.emergency_contact_phone})</p>
                <p><strong>Total Climbers:</strong> {selectedRosterBooking.group_size} Pax</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2 uppercase text-[11px]">Registered Group Members:</h4>
                <div className="divide-y border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {getBookingParticipants(selectedRosterBooking)?.map((p, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between bg-white text-xs">
                      <span className="font-semibold text-slate-800">{idx + 1}. {p.fullName}</span>
                      <span className="text-slate-500 text-[11px]">{p.age ? `${p.age} yrs` : ""} • {p.contactNumber || "No phone"}</span>
                    </div>
                  )) || (
                    <div className="p-3 text-slate-400 italic">No individual participant breakdown recorded.</div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Guide Assignment Modal */}
      {assigningBooking && (
        <Dialog open={!!assigningBooking} onOpenChange={() => setAssigningBooking(null)}>
          <DialogContent className="max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Assign Accredited Tour Guide
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Select an accredited guide for {assigningBooking.trails?.name} on {assigningBooking.climb_date}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAssignGuide} className="space-y-4 my-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Select Tour Guide:</label>
                <select
                  value={selectedGuideId}
                  onChange={(e) => setSelectedGuideId(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">-- Choose Tour Guide --</option>
                  {guidesList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.full_name} ({g.phone || "No phone"}) - {g.experience_years || 1} yrs exp
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningBooking(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit User Role Modal */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Update User Role
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Change system role for {editingUser.full_name || editingUser.email}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Select Role:</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="trekker">Trekker (Regular User)</option>
                  <option value="guide">Tour Guide</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateUserRole}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Save Role
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete User Account Confirmation Modal */}
      {deletingUser && (
        <Dialog open={!!deletingUser} onOpenChange={() => !isDeletingUser && setDeletingUser(null)}>
          <DialogContent className="max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Delete User Account
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                This action cannot be undone. Please confirm permanent account deletion.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 my-2 text-xs">
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-900 space-y-1">
                <p className="font-bold">
                  Are you sure you want to permanently delete this account?
                </p>
                <p className="text-[11px] text-red-800">
                  <strong>{deletingUser.full_name || "User"}</strong> ({deletingUser.email || deletingUser.phone || "No contact info"})
                </p>
                <p className="text-[10px] text-red-700 pt-1 leading-relaxed">
                  Role: <span className="font-bold uppercase">{deletingUser.role || "trekker"}</span>. All personal records, profile data, and login access will be permanently removed.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeletingUser}
                  onClick={() => setDeletingUser(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingUser}
                  onClick={handleDeleteUserAccount}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingUser && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isDeletingUser ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Trail Limit Modal */}
      {editingTrail && (
        <Dialog open={!!editingTrail} onOpenChange={() => setEditingTrail(null)}>
          <DialogContent className="max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Configure Trail Limits
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Update daily climber capacity quota for {editingTrail.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Weekly Trekker Capacity Limit:</label>
                <input
                  type="number"
                  min={5}
                  max={500}
                  value={newTrailLimit}
                  onChange={(e) => setNewTrailLimit(Number(e.target.value))}
                  className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="trailActiveToggle"
                  checked={editingTrail.active ?? true}
                  onChange={(e) => setEditingTrail({ ...editingTrail, active: e.target.checked })}
                  className="rounded text-emerald-600"
                />
                <label htmlFor="trailActiveToggle" className="font-bold text-slate-700">
                  Trail is Open & Accepting Bookings
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTrail(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTrail}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete User Account Confirmation Modal */}
      {deletingUser && (
        <Dialog open={!!deletingUser} onOpenChange={(open) => { if (!open) setDeletingUser(null); }}>
          <DialogContent className="max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-red-700 flex items-center gap-2">
                <Trash2 className="w-5 h-5" /> Delete User Account
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                This action is permanent and cannot be undone. All data associated with this account will be removed.
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm">
              <p className="text-slate-700 font-semibold mb-1">You are about to permanently delete:</p>
              <p className="text-slate-900 font-black text-base">{deletingUser.full_name || "User"}</p>
              <p className="text-slate-500 text-xs mt-0.5">{deletingUser.email || "No email on record"} &bull; Role: <span className="font-bold uppercase">{deletingUser.role}</span></p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                disabled={isDeletingUser}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUserAccount}
                disabled={isDeletingUser}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isDeletingUser ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add FAQ Modal */}
      {faqModalOpen && (
        <Dialog open={faqModalOpen} onOpenChange={setFaqModalOpen}>
          <DialogContent className="max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">Add New FAQ</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Create a new FAQ item for public guidance</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 my-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Question:</label>
                <input
                  type="text"
                  value={newFaqQ}
                  onChange={(e) => setNewFaqQ(e.target.value)}
                  placeholder="e.g. How do I reschedule my trek?"
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Answer:</label>
                <textarea
                  rows={3}
                  value={newFaqA}
                  onChange={(e) => setNewFaqA(e.target.value)}
                  placeholder="Detailed guidelines..."
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Category:</label>
                <select
                  value={newFaqCat}
                  onChange={(e) => setNewFaqCat(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-white"
                >
                  <option value="Booking">Booking</option>
                  <option value="Permits">Permits</option>
                  <option value="Safety">Safety</option>
                  <option value="Requirements">Requirements</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFaqModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!newFaqQ.trim() || !newFaqA.trim()) {
                      toast.error("Please fill in both question and answer.");
                      return;
                    }
                    setFaqs(prev => [...prev, { id: Date.now(), question: newFaqQ, answer: newFaqA, category: newFaqCat }]);
                    toast.success("FAQ item added!");
                    setFaqModalOpen(false);
                    setNewFaqQ("");
                    setNewFaqA("");
                  }}
                  className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-xl"
                >
                  Add FAQ
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}