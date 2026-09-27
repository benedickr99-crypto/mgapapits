import { useState, useMemo } from "react";
import { Mountain, Users, Calendar, Filter, Flame, TrendingUp, AlertTriangle } from "lucide-react";
import { NNNP_TRAILS_METADATA } from "@/lib/trailData";

interface HeatMapProps {
  bookings: any[];
}

export const TrekkingHeatMap = ({ bookings }: HeatMapProps) => {
  const [dateFilter, setDateFilter] = useState<"today" | "this_week" | "this_month" | "all">("this_month");

  // Filter bookings based on selected period
  const filteredBookings = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return bookings.filter((b) => {
      if (b.status === "cancelled" || b.status === "rejected") return false;
      const bDate = new Date(b.climb_date || b.trekking_date);

      if (dateFilter === "today") {
        return (b.climb_date || b.trekking_date) === todayStr;
      }
      if (dateFilter === "this_week") {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return bDate >= weekAgo && bDate <= now;
      }
      if (dateFilter === "this_month") {
        return bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [bookings, dateFilter]);

  // Aggregate stats per trail
  const trailStats = useMemo(() => {
    const map: Record<string, { count: number; trekkers: number; name: string; key: string }> = {
      "mt-mandalagan": { count: 0, trekkers: 0, name: "Mt. Mandalagan (Patag)", key: "mt-mandalagan" },
      "mt-silay": { count: 0, trekkers: 0, name: "Mt. Silay (Cabatangan)", key: "mt-silay" },
      "mt-marapara": { count: 0, trekkers: 0, name: "Mt. Marapara (Canlandog)", key: "mt-marapara" },
      "kumalisikis": { count: 0, trekkers: 0, name: "Kumalisikis Trail (DSB)", key: "kumalisikis" },
    };

    filteredBookings.forEach((b) => {
      const trailName = (b.trails?.name || "").toLowerCase();
      const pax = b.group_size || b.num_participants || 1;

      if (trailName.includes("mandalagan") || trailName.includes("patag")) {
        map["mt-mandalagan"].count++;
        map["mt-mandalagan"].trekkers += pax;
      } else if (trailName.includes("silay") || trailName.includes("cabatangan")) {
        map["mt-silay"].count++;
        map["mt-silay"].trekkers += pax;
      } else if (trailName.includes("marapara") || trailName.includes("canlandog")) {
        map["mt-marapara"].count++;
        map["mt-marapara"].trekkers += pax;
      } else {
        map["kumalisikis"].count++;
        map["kumalisikis"].trekkers += pax;
      }
    });

    return map;
  }, [filteredBookings]);

  const totalTrekkers = Object.values(trailStats).reduce((s, t) => s + t.trekkers, 0);
  const maxTrekkers = Math.max(...Object.values(trailStats).map((t) => t.trekkers), 1);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <h3 className="text-xl font-black text-slate-900">Trekking Heat Map & Trail Density</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time activity distribution and carrying capacity saturation across Northern Negros peaks.
          </p>
        </div>

        {/* Date Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
          {[
            { id: "today", label: "Today" },
            { id: "this_week", label: "This Week" },
            { id: "this_month", label: "This Month" },
            { id: "all", label: "All Time" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id as any)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${
                dateFilter === f.id
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Active Bookings</span>
          <div className="text-2xl font-black text-emerald-950 mt-1">{filteredBookings.length}</div>
          <p className="text-[11px] text-emerald-700 mt-0.5">Reserved groups in period</p>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Total Trekkers</span>
          <div className="text-2xl font-black text-blue-950 mt-1">{totalTrekkers}</div>
          <p className="text-[11px] text-blue-700 mt-0.5">Permitted participants</p>
        </div>

        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Most Active Trail</span>
          <div className="text-lg font-black text-amber-950 mt-1 truncate">
            {Object.values(trailStats).sort((a, b) => b.trekkers - a.trekkers)[0]?.name || "Mt. Mandalagan"}
          </div>
          <p className="text-[11px] text-amber-700 mt-0.5">Highest visitor concentration</p>
        </div>
      </div>

      {/* Visual Density Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(trailStats).map(([key, stat]) => {
          const meta = NNNP_TRAILS_METADATA[key];
          const densityPercent = Math.round((stat.trekkers / maxTrekkers) * 100);
          const isHighDensity = densityPercent >= 75;

          return (
            <div
              key={key}
              className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 relative overflow-hidden transition-all hover:shadow-md"
            >
              {/* Density colored bar */}
              <div
                className={`absolute top-0 left-0 bottom-0 w-2 ${
                  densityPercent >= 80
                    ? "bg-red-500"
                    : densityPercent >= 40
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
              />

              <div className="pl-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {meta?.mountain || "Protected Area"}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      densityPercent >= 80
                        ? "bg-red-100 text-red-700"
                        : densityPercent >= 40
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {densityPercent >= 80 ? "High Activity" : densityPercent >= 40 ? "Moderate" : "Low Density"}
                  </span>
                </div>

                <h4 className="text-base font-black text-slate-900">{stat.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Elevation: {meta?.elevation} • Max limit: {meta?.maxCapacityPerSlot}/slot
                </p>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600">
                      {stat.trekkers} Trekkers ({stat.count} groups)
                    </span>
                    <span className="text-slate-800">{densityPercent}% relative load</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        densityPercent >= 80
                          ? "bg-red-500"
                          : densityPercent >= 40
                          ? "bg-amber-500"
                          : "bg-emerald-600"
                      }`}
                      style={{ width: `${Math.max(5, densityPercent)}%` }}
                    />
                  </div>
                </div>

                {isHighDensity && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    High activity cluster. Consider deploying additional ranger patrols.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
