import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, X, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchAnnouncements, type AnnouncementItem } from "@/lib/bookingService";

export const AnnouncementsBanner = () => {
  const [urgentAnn, setUrgentAnn] = useState<AnnouncementItem | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkAnnouncements = async () => {
      const all = await fetchAnnouncements();
      const highPriority = all.find(
        (a) => a.is_active && (a.priority === "Urgent" || a.priority === "Critical")
      );
      if (highPriority) {
        setUrgentAnn(highPriority);
      }
    };

    checkAnnouncements();
  }, []);

  if (!urgentAnn || dismissed) return null;

  const isCritical = urgentAnn.priority === "Critical";

  return (
    <div
      className={`py-2 px-4 text-xs font-semibold flex items-center justify-between transition-all ${
        isCritical
          ? "bg-red-600 text-white"
          : "bg-amber-500 text-white"
      }`}
    >
      <div className="max-w-7xl mx-auto flex-1 flex items-center justify-center gap-2 text-center">
        {isCritical ? (
          <ShieldAlert className="w-4 h-4 shrink-0 animate-pulse" />
        ) : (
          <AlertTriangle className="w-4 h-4 shrink-0" />
        )}
        <span>
          <strong className="uppercase tracking-wider mr-1">[{urgentAnn.priority} Advisory]:</strong>
          {urgentAnn.title} — {urgentAnn.content.slice(0, 110)}...
        </span>
        <Link
          to="/announcements"
          className="underline font-bold ml-2 inline-flex items-center gap-0.5 hover:opacity-80"
        >
          Read Details <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-white/20 transition shrink-0 ml-2"
        title="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
