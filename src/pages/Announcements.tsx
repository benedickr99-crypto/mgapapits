import { useState, useEffect } from "react";
import { Bell, ShieldAlert, AlertTriangle, Info, Calendar, Filter, Compass, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchAnnouncements, type AnnouncementItem } from "@/lib/bookingService";

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  useEffect(() => {
    const load = async () => {
      const data = await fetchAnnouncements();
      setAnnouncements(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = selectedCategory === "All"
    ? announcements
    : announcements.filter((a) => a.category.toLowerCase() === selectedCategory.toLowerCase());

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "Critical":
        return {
          badge: "bg-red-100 text-red-800 border-red-200",
          card: "border-red-200 bg-red-50/20",
          icon: <ShieldAlert className="w-5 h-5 text-red-600" />,
        };
      case "Urgent":
        return {
          badge: "bg-amber-100 text-amber-800 border-amber-200",
          card: "border-amber-200 bg-amber-50/20",
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
        };
      default:
        return {
          badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
          card: "border-emerald-200 bg-emerald-50/10",
          icon: <Info className="w-5 h-5 text-emerald-600" />,
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100/70 px-3.5 py-1.5 rounded-full mb-3 shadow-2xs">
            <Bell className="w-3.5 h-3.5" /> DENR Official Bulletins
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight">
            Park Announcements & Advisories
          </h1>
          <p className="text-sm md:text-base text-gray-600 max-w-xl mx-auto mt-2">
            Stay updated with vital weather notices, seasonal trail conditions, wildlife protection bulletins, and park regulations in Northern Negros.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
          {["All", "Weather", "Advisory", "Maintenance", "Event"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
                selectedCategory === cat
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Announcements Stream */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm animate-pulse">
            Loading official bulletins...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 p-8">
            <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-semibold text-sm">No advisories found in this category.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((ann) => {
              const style = getPriorityStyle(ann.priority);
              return (
                <div
                  key={ann.id}
                  className={`bg-white rounded-3xl p-6 shadow-xs border transition-all hover:shadow-md ${style.card}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      {style.icon}
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${style.badge}`}>
                        {ann.priority} Priority
                      </span>
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-md">
                        {ann.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(ann.published_at).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-2">{ann.title}</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{ann.content}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Ready to Book Banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-green-900 text-white rounded-3xl p-8 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Protected Area Trekking</span>
            <h3 className="text-2xl font-black text-white mt-1">Ready for your NNNP Adventure?</h3>
            <p className="text-xs text-emerald-100/90 mt-1 max-w-md">
              Secure your permit online at least 14 days in advance to reserve accredited tour guides and staggered slots.
            </p>
          </div>
          <Link
            to="/booking"
            className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-6 py-3 rounded-2xl text-sm transition shrink-0 inline-flex items-center gap-2 shadow-md"
          >
            Book Trek Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
