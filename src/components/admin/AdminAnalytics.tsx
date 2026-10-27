import { useMemo, useRef, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Download,
  Printer,
  TrendingUp,
  FileSpreadsheet,
  Search,
  Filter,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Users,
  Star,
  Calendar,
  CheckCircle,
  ShieldCheck,
  Award,
  Layers,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { getIncidentReports, type IncidentReport } from "@/lib/incidentService";
import { fetchReviews, type RatingReviewItem } from "@/lib/bookingService";

interface AnalyticsProps {
  bookings: any[];
  guides: any[];
  trails: any[];
}

const COLORS = ["#047857", "#0284c7", "#d97706", "#dc2626", "#8b5cf6", "#10b981"];

type ReportSheetType = "permits" | "incidents" | "guides" | "reviews" | "schedules" | "summary";

export const AdminAnalytics = ({ bookings, guides, trails }: AnalyticsProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  // View state: 'excel' (Spreadsheet table view) vs 'charts' (Recharts visualization)
  const [viewMode, setViewMode] = useState<"excel" | "charts">("excel");

  // Active Excel Sheet Tab inside the console
  const [activeSheet, setActiveSheet] = useState<ReportSheetType>("permits");

  // Additional reports state
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [reviews, setReviews] = useState<RatingReviewItem[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);

  // Search & Filters for the active Excel sheet
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 12;

  // Load incidents & reviews on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingExtras(true);
    Promise.all([getIncidentReports(), fetchReviews()])
      .then(([incData, revData]) => {
        if (isMounted) {
          setIncidents(incData || []);
          setReviews(revData || []);
        }
      })
      .catch((err) => {
        console.error("Error loading supplementary report data:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingExtras(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Reset pagination & search when switching sheets
  const handleSheetChange = (sheet: ReportSheetType) => {
    setActiveSheet(sheet);
    setCurrentPage(1);
    setSearchTerm("");
    setStatusFilter("all");
  };

  // 1. KPI Calculations
  const totalBookings = bookings.length;
  const validBookings = bookings.filter((b) => b.status !== "cancelled" && b.status !== "rejected");
  const totalTrekkers = validBookings.reduce((sum, b) => sum + (b.group_size || 1), 0);
  const totalForeigners = validBookings.reduce((sum, b) => sum + (b.foreign_count || 0), 0);
  const avgGroupSize = validBookings.length > 0 ? (totalTrekkers / validBookings.length).toFixed(1) : "0";
  const completedTreks = bookings.filter((b) => b.status === "completed").length;

  const totalIncidents = incidents.length;
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved").length;
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + (r.overall_rating || 5), 0) / reviews.length).toFixed(1)
      : "5.0";

  // Guide workload map
  const guideWorkloadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.guide_id && b.status !== "cancelled" && b.status !== "rejected") {
        const id = b.guide_id;
        counts[id] = (counts[id] || 0) + 1;
      }
    });
    return counts;
  }, [bookings]);

  // Trail workload / trekker counts
  const trailStatsMap = useMemo(() => {
    const stats: Record<string, { bookings: number; trekkers: number }> = {};
    validBookings.forEach((b) => {
      const name = b.trails?.name || "Main Trail";
      if (!stats[name]) stats[name] = { bookings: 0, trekkers: 0 };
      stats[name].bookings += 1;
      stats[name].trekkers += b.group_size || 1;
    });
    return stats;
  }, [validBookings]);

  // 2. Chart Distributions
  const trailData = useMemo(() => {
    return Object.entries(trailStatsMap).map(([name, stat]) => ({
      name: name
        .replace(" (Patag Trail)", "")
        .replace(" (Cabatangan Trail)", "")
        .replace(" (Canlandog Trail)", ""),
      fullName: name,
      value: stat.trekkers,
    }));
  }, [trailStatsMap]);

  const monthlyTrends = useMemo(() => {
    const monthsMap: Record<string, { month: string; bookings: number; trekkers: number }> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      monthsMap[key] = { month: key, bookings: 0, trekkers: 0 };
    }

    bookings.forEach((b) => {
      const date = new Date(b.climb_date || b.created_at);
      const key = `${monthNames[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
      if (monthsMap[key]) {
        monthsMap[key].bookings++;
        if (b.status !== "cancelled" && b.status !== "rejected") {
          monthsMap[key].trekkers += b.group_size || 1;
        }
      }
    });

    return Object.values(monthsMap);
  }, [bookings]);

  const guideWorkloadChart = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.guide_id && b.status !== "cancelled" && b.status !== "rejected") {
        const guideName = b.guides?.name || "Guide";
        counts[guideName] = (counts[guideName] || 0) + 1;
      }
    });

    return Object.entries(counts).map(([name, count]) => ({
      name: name.split(" ")[0],
      fullName: name,
      treks: count,
    }));
  }, [bookings]);

  // 3. Current Sheet Data Filtered
  const currentSheetData = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    if (activeSheet === "permits") {
      return bookings.filter((b) => {
        const ref = (b.permit_number || b.id || "").toLowerCase();
        const trail = (b.trails?.name || "").toLowerCase();
        const guide = (b.guides?.name || "").toLowerCase();
        const contact = (b.emergency_contact_name || "").toLowerCase();
        const matchesQuery = !query || ref.includes(query) || trail.includes(query) || guide.includes(query) || contact.includes(query);
        const matchesStatus = statusFilter === "all" || b.status === statusFilter;
        return matchesQuery && matchesStatus;
      });
    }

    if (activeSheet === "incidents") {
      return incidents.filter((i) => {
        const cat = (i.category || "").toLowerCase();
        const trail = (i.trail_name || "").toLowerCase();
        const desc = (i.description || "").toLowerCase();
        const guide = (i.guide?.full_name || "").toLowerCase();
        const matchesQuery = !query || cat.includes(query) || trail.includes(query) || desc.includes(query) || guide.includes(query);
        const matchesStatus = statusFilter === "all" || i.status === statusFilter || i.severity === statusFilter;
        return matchesQuery && matchesStatus;
      });
    }

    if (activeSheet === "guides") {
      return guides.filter((g) => {
        const name = (g.full_name || "").toLowerCase();
        const phone = (g.phone || "").toLowerCase();
        const status = (g.guide_application_status || "approved").toLowerCase();
        const matchesQuery = !query || name.includes(query) || phone.includes(query);
        const matchesStatus = statusFilter === "all" || status === statusFilter;
        return matchesQuery && matchesStatus;
      });
    }

    if (activeSheet === "reviews") {
      return reviews.filter((r) => {
        const hiker = (r.user_name || "").toLowerCase();
        const trail = (r.trail_name || "").toLowerCase();
        const guide = (r.guide_name || "").toLowerCase();
        const comment = (r.feedback_text || "").toLowerCase();
        const matchesQuery = !query || hiker.includes(query) || trail.includes(query) || guide.includes(query) || comment.includes(query);
        const matchesStatus = statusFilter === "all" || (r.overall_rating && String(r.overall_rating) === statusFilter);
        return matchesQuery && matchesStatus;
      });
    }

    if (activeSheet === "schedules") {
      return trails.filter((t) => {
        const name = (t.name || "").toLowerCase();
        const diff = (t.difficulty || "").toLowerCase();
        const matchesQuery = !query || name.includes(query) || diff.includes(query);
        return matchesQuery;
      });
    }

    // Default summary metrics
    return [
      { metric: "Total Permits Booked", value: totalBookings, note: "All climbing permit registrations" },
      { metric: "Active / Confirmed Permits", value: validBookings.length, note: "Excludes cancelled and rejected" },
      { metric: "Cumulative Trekker Volume", value: totalTrekkers, note: "Total hikers registered" },
      { metric: "Foreign Trekkers", value: totalForeigners, note: `${totalTrekkers > 0 ? ((totalForeigners / totalTrekkers) * 100).toFixed(1) : 0}% of total visitors` },
      { metric: "Local Trekkers", value: Math.max(0, totalTrekkers - totalForeigners), note: "Philippine residents" },
      { metric: "Completed Summits", value: completedTreks, note: "Safely concluded climbs" },
      { metric: "Average Group Size", value: `${avgGroupSize} Pax`, note: "Hikers per permit" },
      { metric: "Total Safety Incidents", value: totalIncidents, note: `${resolvedIncidents} resolved by park rangers` },
      { metric: "Accredited Tour Guides", value: guides.length, note: "Registered local community guides" },
      { metric: "Average Hiker Satisfaction", value: `${avgRating} ★`, note: "Based on trekker feedback submissions" },
      { metric: "Designated Public Trails", value: trails.length, note: "Active trekking routes within NNNP" },
      { metric: "Report Generation Timestamp", value: new Date().toLocaleString(), note: "Real-time DENR audit ledger" },
    ];
  }, [
    activeSheet,
    searchTerm,
    statusFilter,
    bookings,
    incidents,
    guides,
    reviews,
    trails,
    validBookings,
    totalBookings,
    totalTrekkers,
    totalForeigners,
    completedTreks,
    avgGroupSize,
    totalIncidents,
    resolvedIncidents,
    avgRating,
  ]);

  const totalPages = Math.ceil(currentSheetData.length / rowsPerPage) || 1;
  const paginatedData = currentSheetData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // 4. Comprehensive Multi-Sheet Excel (.xlsx) Export Handler
  const exportAllToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Permits & Bookings
      const permitsRows = bookings.map((b, idx) => ({
        "No.": idx + 1,
        "Permit Ref": b.permit_number || b.id.substring(0, 8).toUpperCase(),
        "Trail Name": b.trails?.name || "Main Trail",
        "Climb Date": b.climb_date || "",
        "Total Trekkers": Number(b.group_size) || 1,
        "Foreign Trekkers": Number(b.foreign_count) || 0,
        "Local Trekkers": Math.max(0, (Number(b.group_size) || 1) - (Number(b.foreign_count) || 0)),
        "Tour Guide": b.guides?.name || "Unassigned",
        "Status": (b.status || "pending").toUpperCase(),
        "Emergency Contact": b.emergency_contact_name || "",
        "Emergency Phone": b.emergency_contact_phone || "",
        "Registration Date": b.created_at ? new Date(b.created_at).toISOString().split("T")[0] : "",
      }));
      const wsPermits = XLSX.utils.json_to_sheet(permitsRows);
      wsPermits["!cols"] = [
        { wch: 6 }, { wch: 18 }, { wch: 28 }, { wch: 14 },
        { wch: 14 }, { wch: 16 }, { wch: 15 }, { wch: 22 },
        { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, wsPermits, "Permits & Bookings");

      // Sheet 2: Safety Incidents
      const incidentsRows = incidents.map((i, idx) => ({
        "Incident #": idx + 1,
        "ID": i.id.substring(0, 8).toUpperCase(),
        "Date Reported": i.created_at ? new Date(i.created_at).toLocaleDateString() : "",
        "Category": (i.category || "").toUpperCase(),
        "Severity": (i.severity || "").toUpperCase(),
        "Trail Name": i.trail_name || "Trail",
        "Reporting Guide": i.guide?.full_name || "Guide",
        "Description": i.description || "",
        "Action Taken": i.action_taken || "None",
        "Requires Assistance": i.requires_assistance ? "YES" : "NO",
        "Status": (i.status || "open").toUpperCase(),
        "Admin Notes": i.admin_notes || "",
        "Resolved At": i.resolved_at ? new Date(i.resolved_at).toLocaleDateString() : "—",
      }));
      const wsIncidents = XLSX.utils.json_to_sheet(incidentsRows.length > 0 ? incidentsRows : [{ "Status": "No incident reports logged" }]);
      wsIncidents["!cols"] = [
        { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
        { wch: 24 }, { wch: 20 }, { wch: 35 }, { wch: 30 }, { wch: 18 },
        { wch: 14 }, { wch: 30 }, { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(wb, wsIncidents, "Safety Incidents");

      // Sheet 3: Tour Guides
      const guidesRows = guides.map((g, idx) => ({
        "No.": idx + 1,
        "Guide Name": g.full_name || "Guide",
        "Contact Number": g.phone || "—",
        "Experience (Yrs)": g.experience_years || 0,
        "Assigned Treks": guideWorkloadCounts[g.id] || 0,
        "Accreditation Status": (g.guide_application_status || "approved").toUpperCase(),
        "Duty Status": g.is_available === false ? "OFF-DUTY" : "AVAILABLE",
      }));
      const wsGuides = XLSX.utils.json_to_sheet(guidesRows.length > 0 ? guidesRows : [{ "Status": "No guides in registry" }]);
      wsGuides["!cols"] = [
        { wch: 6 }, { wch: 26 }, { wch: 18 }, { wch: 16 },
        { wch: 16 }, { wch: 22 }, { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(wb, wsGuides, "Tour Guides Registry");

      // Sheet 4: Trekker Reviews
      const reviewsRows = reviews.map((r, idx) => ({
        "No.": idx + 1,
        "Trekker Name": r.user_name || "Hiker",
        "Trail Name": r.trail_name || "Trail",
        "Assigned Guide": r.guide_name || "Guide",
        "Overall Rating": r.overall_rating || 5,
        "Trail Rating": r.trail_rating || 5,
        "Guide Rating": r.guide_rating || 5,
        "Hiker Feedback": r.feedback_text || "—",
        "Submitted Date": r.created_at ? new Date(r.created_at).toLocaleDateString() : "",
      }));
      const wsReviews = XLSX.utils.json_to_sheet(reviewsRows.length > 0 ? reviewsRows : [{ "Status": "No hiker reviews submitted" }]);
      wsReviews["!cols"] = [
        { wch: 6 }, { wch: 22 }, { wch: 24 }, { wch: 22 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 35 }, { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(wb, wsReviews, "Hiker Reviews");

      // Sheet 5: Trail Capacity & Schedules
      const schedulesRows = trails.map((t, idx) => {
        const stats = trailStatsMap[t.name] || { bookings: 0, trekkers: 0 };
        const limit = t.weekly_slots || t.daily_limit || 50;
        return {
          "No.": idx + 1,
          "Trail Name": t.name,
          "Difficulty": t.difficulty || "Moderate",
          "Daily Carrying Capacity": limit,
          "Active Bookings Count": stats.bookings,
          "Total Trekkers Registered": stats.trekkers,
          "Capacity Utilization": `${((stats.trekkers / limit) * 100).toFixed(1)}%`,
          "Trail Status": t.active !== false ? "OPERATIONAL" : "CLOSED",
        };
      });
      const wsSchedules = XLSX.utils.json_to_sheet(schedulesRows);
      wsSchedules["!cols"] = [
        { wch: 6 }, { wch: 30 }, { wch: 16 }, { wch: 22 },
        { wch: 20 }, { wch: 24 }, { wch: 20 }, { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(wb, wsSchedules, "Trail Capacity");

      // Sheet 6: Executive KPI Summary
      const summaryRows = [
        { "Category": "Park Administration", "Key Performance Indicator": "Protected Area", "Value": "Mount Northern Negros Natural Park" },
        { "Category": "Park Administration", "Key Performance Indicator": "Supervisory Body", "Value": "DENR Provincial & Regional Office" },
        { "Category": "Park Administration", "Key Performance Indicator": "Report Extraction Date", "Value": new Date().toLocaleString() },
        { "Category": "Visitor Demographics", "Key Performance Indicator": "Total Permits Registered", "Value": totalBookings },
        { "Category": "Visitor Demographics", "Key Performance Indicator": "Confirmed / Active Permits", "Value": validBookings.length },
        { "Category": "Visitor Demographics", "Key Performance Indicator": "Total Hiker Volume", "Value": totalTrekkers },
        { "Category": "Visitor Demographics", "Key Performance Indicator": "Foreign Trekkers Count", "Value": totalForeigners },
        { "Category": "Visitor Demographics", "Key Performance Indicator": "Local Trekkers Count", "Value": Math.max(0, totalTrekkers - totalForeigners) },
        { "Category": "Visitor Demographics", "Key Performance Indicator": "Average Group Size", "Value": `${avgGroupSize} Pax` },
        { "Category": "Visitor Demographics", "Key Performance Indicator": "Completed Treks", "Value": completedTreks },
        { "Category": "Field Safety", "Key Performance Indicator": "Total Safety Incidents Logged", "Value": totalIncidents },
        { "Category": "Field Safety", "Key Performance Indicator": "Incidents Resolved", "Value": resolvedIncidents },
        { "Category": "Park Operations", "Key Performance Indicator": "Accredited Tour Guides", "Value": guides.length },
        { "Category": "Park Operations", "Key Performance Indicator": "Public Trekking Trails", "Value": trails.length },
        { "Category": "Park Operations", "Key Performance Indicator": "Average Trekker Satisfaction", "Value": `${avgRating} ★` },
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary["!cols"] = [{ wch: 24 }, { wch: 32 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Executive KPI Summary");

      // Save complete consolidated workbook
      const dateStr = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `DENR_NNNP_Master_Park_Reports_${dateStr}.xlsx`);
      toast.success("Complete Excel Report Generated! (All 6 Sheets Included)");
    } catch (err) {
      console.error("Excel Master export error:", err);
      toast.error("Failed to generate master Excel file.");
    }
  };

  // CSV Fallback Export Handler
  const exportCurrentToCSV = () => {
    try {
      let headers: string[] = [];
      let rows: any[][] = [];

      if (activeSheet === "permits") {
        headers = ["Ref", "Trail", "Climb Date", "Group Size", "Foreign", "Guide", "Status", "Contact", "Phone"];
        rows = bookings.map((b) => [
          `"${b.permit_number || b.id.substring(0, 8)}"`,
          `"${b.trails?.name || "Trail"}"`,
          `"${b.climb_date || ""}"`,
          b.group_size || 1,
          b.foreign_count || 0,
          `"${b.guides?.name || "Unassigned"}"`,
          `"${b.status}"`,
          `"${b.emergency_contact_name || ""}"`,
          `"${b.emergency_contact_phone || ""}"`,
        ]);
      } else if (activeSheet === "incidents") {
        headers = ["ID", "Category", "Severity", "Trail", "Guide", "Description", "Status", "Date"];
        rows = incidents.map((i) => [
          `"${i.id.substring(0, 8)}"`,
          `"${i.category}"`,
          `"${i.severity}"`,
          `"${i.trail_name || ""}"`,
          `"${i.guide?.full_name || ""}"`,
          `"${(i.description || "").replace(/"/g, '""')}"`,
          `"${i.status}"`,
          `"${i.created_at || ""}"`,
        ]);
      } else if (activeSheet === "guides") {
        headers = ["Name", "Phone", "Experience", "Treks Handled", "Status", "Availability"];
        rows = guides.map((g) => [
          `"${g.full_name || ""}"`,
          `"${g.phone || ""}"`,
          g.experience_years || 0,
          guideWorkloadCounts[g.id] || 0,
          `"${g.guide_application_status || "approved"}"`,
          `"${g.is_available === false ? "Off" : "Available"}"`,
        ]);
      } else if (activeSheet === "reviews") {
        headers = ["Hiker", "Trail", "Guide", "Overall Rating", "Trail Rating", "Guide Rating", "Comment", "Date"];
        rows = reviews.map((r) => [
          `"${r.user_name || ""}"`,
          `"${r.trail_name || ""}"`,
          `"${r.guide_name || ""}"`,
          r.overall_rating || 5,
          r.trail_rating || 5,
          r.guide_rating || 5,
          `"${(r.feedback_text || "").replace(/"/g, '""')}"`,
          `"${r.created_at || ""}"`,
        ]);
      } else if (activeSheet === "schedules") {
        headers = ["Trail Name", "Difficulty", "Capacity Limit", "Active Bookings", "Registered Trekkers"];
        rows = trails.map((t) => {
          const s = trailStatsMap[t.name] || { bookings: 0, trekkers: 0 };
          return [`"${t.name}"`, `"${t.difficulty || ""}"`, t.weekly_slots || t.daily_limit || 50, s.bookings, s.trekkers];
        });
      } else {
        headers = ["Metric", "Value", "Notes"];
        rows = (currentSheetData as any[]).map((s) => [`"${s.metric}"`, `"${s.value}"`, `"${s.note || ""}"`]);
      }

      const csvContent =
        "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `NNNP_${activeSheet.toUpperCase()}_Report_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${activeSheet} CSV report`);
    } catch (err) {
      toast.error("Failed to generate CSV");
    }
  };

  const printSummary = () => {
    window.print();
  };

  return (
    <div ref={printRef} className="space-y-6">
      {/* Header & Export Actions (As shown in User Photo) */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-700" />
            <h3 className="text-xl font-black text-slate-900">Park Analytics & All Consolidated Reports</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Full comprehensive park supervision: Permits, Safety Incidents, Tour Guides, Reviews, and Carrying Capacity.
          </p>
        </div>

        {/* Header Action Button */}
        <div className="flex items-center gap-2">
          <Button
            onClick={exportAllToExcel}
            className="bg-[#107C41] hover:bg-[#0b5c30] text-white rounded-xl text-xs font-bold flex items-center gap-2 px-4 py-2.5 shadow-sm transition-all cursor-pointer ring-2 ring-emerald-600/20"
            title="Download Complete Multi-Sheet Excel Workbook (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" /> Export Excel (.xlsx)
          </Button>
        </div>
      </div>

      {/* KPI Cards across ALL reports */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div
          onClick={() => handleSheetChange("permits")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeSheet === "permits"
              ? "bg-emerald-50/70 border-emerald-300 shadow-xs"
              : "bg-white border-slate-100 hover:border-slate-200"
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Permits</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalBookings}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">{validBookings.length} Active</p>
        </div>

        <div
          onClick={() => handleSheetChange("permits")}
          className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all cursor-pointer"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Hikers</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{totalTrekkers}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">{totalForeigners} Foreign</p>
        </div>

        <div
          onClick={() => handleSheetChange("incidents")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeSheet === "incidents"
              ? "bg-rose-50/70 border-rose-300 shadow-xs"
              : "bg-white border-slate-100 hover:border-slate-200"
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Incidents</span>
          <div className="text-2xl font-black text-rose-600 mt-1">{totalIncidents}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">{resolvedIncidents} Resolved</p>
        </div>

        <div
          onClick={() => handleSheetChange("guides")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeSheet === "guides"
              ? "bg-blue-50/70 border-blue-300 shadow-xs"
              : "bg-white border-slate-100 hover:border-slate-200"
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tour Guides</span>
          <div className="text-2xl font-black text-blue-600 mt-1">{guides.length}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Accredited</p>
        </div>

        <div
          onClick={() => handleSheetChange("reviews")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeSheet === "reviews"
              ? "bg-amber-50/70 border-amber-300 shadow-xs"
              : "bg-white border-slate-100 hover:border-slate-200"
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hiker Rating</span>
          <div className="text-2xl font-black text-amber-600 mt-1 flex items-center gap-1">
            {avgRating} <span className="text-xs">★</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{reviews.length} Reviews</p>
        </div>

        <div
          onClick={() => handleSheetChange("schedules")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeSheet === "schedules"
              ? "bg-purple-50/70 border-purple-300 shadow-xs"
              : "bg-white border-slate-100 hover:border-slate-200"
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Park Trails</span>
          <div className="text-2xl font-black text-purple-600 mt-1">{trails.length}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Protected Paths</p>
        </div>
      </div>

      {/* Main Switcher: Excel Multi-Sheet Grid vs Visual Analytics */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setViewMode("excel")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === "excel"
                ? "bg-[#107C41] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel Spreadsheet Console
          </button>
          <button
            onClick={() => setViewMode("charts")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === "charts"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Visual Charts & Trends
          </button>
        </div>

        <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-2 px-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>
            {currentSheetData.length} records in {activeSheet.toUpperCase()} report
          </span>
        </div>
      </div>

      {/* VIEW 1: EXCEL MULTI-SHEET CONSOLE */}
      {viewMode === "excel" && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Excel Application Title Bar */}
          <div className="bg-[#107C41] text-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-black text-sm shrink-0">
                X
              </div>
              <div>
                <h4 className="text-sm font-black tracking-wide flex items-center gap-2">
                  DENR_NNNP_Master_Park_Reports.xlsx
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-normal">
                    Active Sheet: {activeSheet.toUpperCase()}
                  </span>
                </h4>
                <p className="text-[11px] text-emerald-100">
                  Consolidated multi-report ledger • Switch between sheets below
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={exportAllToExcel}
                size="sm"
                className="bg-white text-[#107C41] hover:bg-emerald-50 text-xs font-black rounded-xl border border-white/40 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Export All Sheets (.xlsx)
              </Button>
            </div>
          </div>

          {/* EXCEL SHEET SELECTOR TABS (Like real Excel Sheet tabs at top) */}
          <div className="bg-slate-100/90 border-b border-slate-200 px-3 pt-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Sheets:
            </span>

            <button
              onClick={() => handleSheetChange("permits")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap transition-all border-t border-x cursor-pointer ${
                activeSheet === "permits"
                  ? "bg-white text-emerald-900 border-slate-200 shadow-xs font-black"
                  : "bg-slate-200/60 text-slate-600 border-transparent hover:bg-slate-200"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              1. Permits & Bookings ({bookings.length})
            </button>

            <button
              onClick={() => handleSheetChange("incidents")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap transition-all border-t border-x cursor-pointer ${
                activeSheet === "incidents"
                  ? "bg-white text-rose-900 border-slate-200 shadow-xs font-black"
                  : "bg-slate-200/60 text-slate-600 border-transparent hover:bg-slate-200"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              2. Safety Incidents ({incidents.length})
            </button>

            <button
              onClick={() => handleSheetChange("guides")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap transition-all border-t border-x cursor-pointer ${
                activeSheet === "guides"
                  ? "bg-white text-blue-900 border-slate-200 shadow-xs font-black"
                  : "bg-slate-200/60 text-slate-600 border-transparent hover:bg-slate-200"
              }`}
            >
              <Award className="w-3.5 h-3.5 text-blue-600" />
              3. Tour Guides ({guides.length})
            </button>

            <button
              onClick={() => handleSheetChange("reviews")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap transition-all border-t border-x cursor-pointer ${
                activeSheet === "reviews"
                  ? "bg-white text-amber-900 border-slate-200 shadow-xs font-black"
                  : "bg-slate-200/60 text-slate-600 border-transparent hover:bg-slate-200"
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              4. Hiker Reviews ({reviews.length})
            </button>

            <button
              onClick={() => handleSheetChange("schedules")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap transition-all border-t border-x cursor-pointer ${
                activeSheet === "schedules"
                  ? "bg-white text-purple-900 border-slate-200 shadow-xs font-black"
                  : "bg-slate-200/60 text-slate-600 border-transparent hover:bg-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              5. Trail Capacity ({trails.length})
            </button>

            <button
              onClick={() => handleSheetChange("summary")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-xl text-xs font-bold whitespace-nowrap transition-all border-t border-x cursor-pointer ${
                activeSheet === "summary"
                  ? "bg-white text-slate-900 border-slate-200 shadow-xs font-black"
                  : "bg-slate-200/60 text-slate-600 border-transparent hover:bg-slate-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              6. Executive Summary
            </button>
          </div>

          {/* Excel Search Ribbon */}
          {activeSheet !== "summary" && (
            <div className="bg-slate-50/90 border-b border-slate-200 p-3 sm:p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeSheet} report...`}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#107C41] text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400">Filter:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#107C41] font-semibold text-slate-700"
                  >
                    <option value="all">All Records</option>
                    {activeSheet === "permits" && (
                      <>
                        <option value="approved">Approved</option>
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="rejected">Rejected</option>
                        <option value="cancelled">Cancelled</option>
                      </>
                    )}
                    {activeSheet === "incidents" && (
                      <>
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                        <option value="critical">Critical Severity</option>
                        <option value="high">High Severity</option>
                      </>
                    )}
                    {activeSheet === "reviews" && (
                      <>
                        <option value="5">5 Stars</option>
                        <option value="4">4 Stars</option>
                        <option value="3">3 Stars</option>
                        <option value="2">2 Stars</option>
                        <option value="1">1 Star</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SPREADSHEET TABLE GRID FOR ACTIVE SHEET */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3 w-12 text-center text-[10px] font-mono text-slate-400 border-r border-slate-200 bg-slate-200/50">
                    #
                  </th>

                  {activeSheet === "permits" && (
                    <>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col A</span>
                        Permit Ref
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 min-w-[180px]">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col B</span>
                        Trail Name
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col C</span>
                        Climb Date
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 text-center">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col D</span>
                        Trekkers
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 text-center">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col E</span>
                        Foreign
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col F</span>
                        Tour Guide
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col G</span>
                        Status
                      </th>
                      <th className="py-2.5 px-3 font-extrabold text-slate-700 min-w-[160px]">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col H</span>
                        Emergency Contact
                      </th>
                    </>
                  )}

                  {activeSheet === "incidents" && (
                    <>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col A</span>
                        ID
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col B</span>
                        Category
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col C</span>
                        Severity
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col D</span>
                        Trail Name
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col E</span>
                        Reporting Guide
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 min-w-[200px]">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col F</span>
                        Description
                      </th>
                      <th className="py-2.5 px-3 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col G</span>
                        Status
                      </th>
                    </>
                  )}

                  {activeSheet === "guides" && (
                    <>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col A</span>
                        Guide Name
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col B</span>
                        Contact Phone
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 text-center">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col C</span>
                        Experience
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 text-center">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col D</span>
                        Treks Handled
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col E</span>
                        Accreditation
                      </th>
                      <th className="py-2.5 px-3 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col F</span>
                        Availability
                      </th>
                    </>
                  )}

                  {activeSheet === "reviews" && (
                    <>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col A</span>
                        Trekker
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col B</span>
                        Trail Name
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col C</span>
                        Tour Guide
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 text-center">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col D</span>
                        Overall (★)
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 min-w-[220px]">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col E</span>
                        Comments
                      </th>
                      <th className="py-2.5 px-3 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col F</span>
                        Date
                      </th>
                    </>
                  )}

                  {activeSheet === "schedules" && (
                    <>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col A</span>
                        Trail Name
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col B</span>
                        Difficulty
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 text-center">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col C</span>
                        Daily Limit
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 text-center">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col D</span>
                        Registered Trekkers
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 text-center">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col E</span>
                        Utilization
                      </th>
                      <th className="py-2.5 px-3 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col F</span>
                        Status
                      </th>
                    </>
                  )}

                  {activeSheet === "summary" && (
                    <>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 min-w-[220px]">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col A</span>
                        Key Performance Indicator
                      </th>
                      <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-700 min-w-[160px]">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col B</span>
                        Consolidated Value
                      </th>
                      <th className="py-2.5 px-3 font-extrabold text-slate-700">
                        <span className="text-[9px] font-mono text-slate-400 block font-normal">Col C</span>
                        Operational Scope & Notes
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-600">No records found in {activeSheet}</p>
                      <p className="text-[11px] text-slate-400">Adjust query or select another sheet.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row: any, idx) => {
                    const rowNumber = (currentPage - 1) * rowsPerPage + idx + 1;
                    return (
                      <tr key={row.id || idx} className="hover:bg-emerald-50/50 transition-colors group">
                        <td className="py-2 px-3 text-center text-[10px] font-mono text-slate-400 border-r border-slate-200 bg-slate-50 group-hover:bg-emerald-100/40 select-none">
                          {rowNumber}
                        </td>

                        {activeSheet === "permits" && (
                          <>
                            <td className="py-2 px-3 border-r border-slate-100 font-mono font-bold text-slate-900">
                              {row.permit_number || row.id?.substring(0, 8).toUpperCase()}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 font-semibold text-slate-800">
                              {row.trails?.name || "Trail"}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-slate-600 whitespace-nowrap">
                              {row.climb_date || "—"}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-center font-bold text-slate-900">
                              {row.group_size || 1}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-center text-slate-600">
                              {row.foreign_count || 0}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-slate-700">
                              {row.guides?.name || <span className="text-slate-400 italic">Unassigned</span>}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                  row.status === "approved" || row.status === "completed"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : row.status === "pending"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-700 truncate max-w-[180px]">
                              {row.emergency_contact_name || "—"}{" "}
                              {row.emergency_contact_phone && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  {row.emergency_contact_phone}
                                </span>
                              )}
                            </td>
                          </>
                        )}

                        {activeSheet === "incidents" && (
                          <>
                            <td className="py-2 px-3 border-r border-slate-100 font-mono font-bold text-slate-900">
                              {row.id?.substring(0, 8).toUpperCase()}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 font-bold uppercase text-[11px] text-slate-700">
                              {row.category}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                  row.severity === "critical"
                                    ? "bg-red-600 text-white animate-pulse"
                                    : row.severity === "high"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {row.severity}
                              </span>
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 font-semibold text-slate-800">
                              {row.trail_name || "Trail"}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-slate-700">
                              {row.guide?.full_name || "Guide"}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-slate-600 truncate max-w-[220px]">
                              {row.description}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                  row.status === "resolved"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                          </>
                        )}

                        {activeSheet === "guides" && (
                          <>
                            <td className="py-2 px-3 border-r border-slate-100 font-bold text-slate-900">
                              {row.full_name}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 font-mono text-slate-600">
                              {row.phone || "—"}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-center font-bold text-slate-700">
                              {row.experience_years || 0} Yrs
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-center font-extrabold text-emerald-700">
                              {guideWorkloadCounts[row.id] || 0} Treks
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                                {row.guide_application_status || "Approved"}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  row.is_available === false
                                    ? "bg-slate-200 text-slate-700"
                                    : "bg-emerald-500 text-white"
                                }`}
                              >
                                {row.is_available === false ? "Off-Duty" : "Available"}
                              </span>
                            </td>
                          </>
                        )}

                        {activeSheet === "reviews" && (
                          <>
                            <td className="py-2 px-3 border-r border-slate-100 font-bold text-slate-900">
                              {row.user_name || "Trekker"}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 font-semibold text-slate-700">
                              {row.trail_name || "Trail"}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-slate-700">
                              {row.guide_name || "Guide"}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-center font-black text-amber-600">
                              {row.overall_rating || 5} ★
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-slate-600 italic truncate max-w-[240px]">
                              "{row.feedback_text || "Great climb"}"
                            </td>
                            <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                              {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
                            </td>
                          </>
                        )}

                        {activeSheet === "schedules" && (
                          <>
                            <td className="py-2 px-3 border-r border-slate-100 font-bold text-slate-900">
                              {row.name}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-slate-600 font-semibold">
                              {row.difficulty || "Moderate"}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-center font-bold text-slate-800">
                              {row.weekly_slots || row.daily_limit || 50} Slots
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-center font-black text-emerald-700">
                              {trailStatsMap[row.name]?.trekkers || 0} Pax
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-center font-mono font-bold text-slate-700">
                              {(
                                ((trailStatsMap[row.name]?.trekkers || 0) / (row.weekly_slots || row.daily_limit || 50)) *
                                100
                              ).toFixed(0)}
                              %
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                                Open
                              </span>
                            </td>
                          </>
                        )}

                        {activeSheet === "summary" && (
                          <>
                            <td className="py-2.5 px-3 border-r border-slate-100 font-extrabold text-slate-900">
                              {row.metric}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-100 font-black text-emerald-800 font-mono text-sm">
                              {row.value}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 text-xs">
                              {row.note}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Excel Status Bar & Formula Summary Footer */}
          <div className="bg-slate-100 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 flex-wrap text-slate-600 font-mono text-[11px]">
              <span className="text-slate-400 font-sans font-bold uppercase tracking-wider text-[10px]">
                {activeSheet.toUpperCase()} STATS:
              </span>
              <span>
                <strong className="text-slate-800">COUNT</strong> ={" "}
                <span className="text-slate-900 font-bold">{currentSheetData.length}</span>
              </span>
              {activeSheet === "permits" && (
                <span>
                  <strong className="text-slate-800">SUM</strong>(Trekkers) ={" "}
                  <span className="text-emerald-700 font-bold">{totalTrekkers}</span>
                </span>
              )}
              {activeSheet === "incidents" && (
                <span>
                  <strong className="text-slate-800">RESOLVED</strong> ={" "}
                  <span className="text-emerald-700 font-bold">{resolvedIncidents}</span>
                </span>
              )}
              {activeSheet === "reviews" && (
                <span>
                  <strong className="text-slate-800">AVG_RATING</strong> ={" "}
                  <span className="text-amber-600 font-bold">{avgRating} ★</span>
                </span>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0 rounded-lg border-slate-300 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0 rounded-lg border-slate-300 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: VISUAL CHARTS & TRENDS */}
      {viewMode === "charts" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend Chart */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Monthly Booking & Trekker Volume
            </h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends}>
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      borderRadius: "12px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="trekkers" name="Total Trekkers" fill="#047857" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="bookings" name="Permit Bookings" fill="#0284c7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trail Popularity Pie */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Trail Visitor Carrying Distribution
            </h4>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trailData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    fontSize={10}
                  >
                    {trailData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Guide Workload Bar */}
          {guideWorkloadChart.length > 0 && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 lg:col-span-2">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                Accredited Tour Guide Workload (Treks Supervised)
              </h4>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={guideWorkloadChart} layout="vertical">
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={100} />
                    <Tooltip />
                    <Bar dataKey="treks" name="Assigned Treks" fill="#d97706" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
