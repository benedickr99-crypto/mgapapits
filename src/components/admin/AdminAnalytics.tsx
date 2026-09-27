import { useMemo, useRef } from "react";
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
  Legend,
} from "recharts";
import { Download, Printer, TrendingUp, Users, Compass, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalyticsProps {
  bookings: any[];
  guides: any[];
  trails: any[];
}

const COLORS = ["#047857", "#0284c7", "#d97706", "#dc2626", "#8b5cf6"];

export const AdminAnalytics = ({ bookings, guides, trails }: AnalyticsProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  // 1. KPI Calculations
  const totalBookings = bookings.length;
  const validBookings = bookings.filter((b) => b.status !== "cancelled" && b.status !== "rejected");
  const totalTrekkers = validBookings.reduce((sum, b) => sum + (b.group_size || 1), 0);
  const avgGroupSize = validBookings.length > 0 ? (totalTrekkers / validBookings.length).toFixed(1) : "0";
  const completedTreks = bookings.filter((b) => b.status === "completed").length;

  // 2. Trail Popularity Distribution
  const trailData = useMemo(() => {
    const counts: Record<string, number> = {};
    validBookings.forEach((b) => {
      const name = b.trails?.name || "Other Trail";
      counts[name] = (counts[name] || 0) + (b.group_size || 1);
    });

    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace(" (Patag Trail)", "").replace(" (Cabatangan Trail)", "").replace(" (Canlandog Trail)", ""),
      fullName: name,
      value,
    }));
  }, [validBookings]);

  // 3. Monthly Trends
  const monthlyTrends = useMemo(() => {
    const monthsMap: Record<string, { month: string; bookings: number; trekkers: number }> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Initialize recent months
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

  // 4. Guide Workload Distribution
  const guideWorkload = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach((b) => {
      if (b.guide_id && b.status !== "cancelled" && b.status !== "rejected") {
        const guideName = b.guides?.name || "Assigned Guide";
        counts[guideName] = (counts[guideName] || 0) + 1;
      }
    });

    return Object.entries(counts).map(([name, count]) => ({
      name: name.split(" ")[0], // First name for neat chart label
      fullName: name,
      treks: count,
    }));
  }, [bookings]);

  // CSV Export Handler
  const exportToCSV = () => {
    const headers = [
      "Booking Reference",
      "Trail",
      "Climb Date",
      "Group Size",
      "Foreign Trekkers",
      "Guide Assigned",
      "Status",
      "Emergency Contact",
      "Emergency Phone",
      "Created At",
    ];

    const rows = bookings.map((b) => [
      `"${b.permit_number || b.id.substring(0, 8)}"`,
      `"${b.trails?.name || "Trail"}"`,
      `"${b.climb_date}"`,
      b.group_size || 1,
      b.foreign_count || 0,
      `"${b.guides?.name || "Unassigned"}"`,
      `"${b.status}"`,
      `"${b.emergency_contact_name || ""}"`,
      `"${b.emergency_contact_phone || ""}"`,
      `"${new Date(b.created_at).toISOString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NNNP_Trekking_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printSummary = () => {
    window.print();
  };

  return (
    <div ref={printRef} className="space-y-6">
      {/* Header & Export Actions */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-700" />
            <h3 className="text-xl font-black text-slate-900">Park Analytics & Trekking Intelligence</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Statistical monitoring, guide workload distribution, and trail carrying performance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="rounded-xl text-xs flex items-center gap-1.5 border-slate-200"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" /> Export CSV Data
          </Button>
          <Button
            onClick={printSummary}
            className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print Summary
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Permits</span>
          <div className="text-3xl font-black text-slate-900 mt-1">{totalBookings}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">{validBookings.length} confirmed / active</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Trekkers</span>
          <div className="text-3xl font-black text-emerald-700 mt-1">{totalTrekkers}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Cumulative visitor count</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed Treks</span>
          <div className="text-3xl font-black text-blue-600 mt-1">{completedTreks}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Safely concluded summits</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Group Size</span>
          <div className="text-3xl font-black text-amber-600 mt-1">{avgGroupSize}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Trekkers per permit</p>
        </div>
      </div>

      {/* Charts Grid */}
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
            Trail Visitor Distribution
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
        {guideWorkload.length > 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 lg:col-span-2">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Tour Guide Assignment Workload (Treks Handled)
            </h4>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={guideWorkload} layout="vertical">
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
    </div>
  );
};
