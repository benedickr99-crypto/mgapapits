import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Mountain, ArrowRight, Navigation, WifiOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

import { getCached, setCached } from "@/lib/cache";
import { getTrailImage } from "@/lib/trailData";
import { isTrailAvailableOffline } from "@/lib/offlineTrails";

type Trail = Tables<"trails">;

function getTrailKey(trailName: string): string {
  const clean = trailName.toLowerCase();
  if (clean.includes("mandalagan")) return "mt-mandalagan";
  if (clean.includes("silay")) return "mt-silay";
  if (clean.includes("marapara")) return "mt-marapara";
  if (clean.includes("kumalisikis") || clean.includes("malatan")) return "kumalisikis";
  return "mt-mandalagan";
}

const Trails = () => {
  // INSTANT LOAD from cache
  const [trails, setTrails] = useState<Trail[]>(() => {
    return getCached<Trail[]>("nnnp_trails") || [];
  });
  const [loading, setLoading] = useState(() => {
    return (getCached<Trail[]>("nnnp_trails")?.length || 0) === 0;
  });
  const scrollRef = useScrollAnimation([trails]);

  useEffect(() => {
    const fetchTrails = async () => {
      const cached = getCached<Trail[]>("nnnp_trails");
      if (cached && cached.length > 0) {
        setTrails((prev) => (prev.length === 0 ? cached : prev));
        setLoading(false);
      }

      try {
        const { data, error } = await supabase
          .from("trails")
          .select("*")
          .eq("active", true)
          .order("name");

        if (!error && data) {
          setTrails(data);
          setCached("nnnp_trails", data, 15 * 60 * 1000); // 15 mins cache
        }
      } catch (e) {
        console.warn("Trails fetch fallback:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchTrails();
  }, []);

  return (
    <div ref={scrollRef} className="bg-gray-50 min-h-screen">
      {/* HEADER */}
      <section className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1 rounded-full w-fit">
            <MapPin size={14} /> Northern Negros Natural Park
          </div>

          <h1 className="mt-6 text-4xl md:text-5xl font-bold">
            Explore Trails & GPS Mapping
          </h1>

          <p className="mt-3 text-white/80 max-w-xl">
            Choose your adventure. View continuous Strava-style GPS route maps, verified checkpoints, and book your DENR accredited guide.
          </p>
        </div>
      </section>

      {/* TRAILS GRID */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        {loading ? (
          <div className="text-center py-20">
            <p className="text-gray-500">Loading trails...</p>
          </div>
        ) : trails.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">No trails available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            {trails.map((trail) => {
              const trailKey = getTrailKey(trail.name);
              const isOffline = isTrailAvailableOffline(trailKey);

              return (
                <div
                  key={trail.id}
                  className="animate-on-scroll card-hover group bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col border border-slate-100"
                >
                  {/* TRAIL PHOTO */}
                  <div className="relative h-64 overflow-hidden bg-slate-900">
                    <img
                      src={getTrailImage(trail.name)}
                      alt={trail.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Top badges */}
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                      <span className="text-xs font-bold text-white bg-emerald-700/90 backdrop-blur-xs px-3 py-1 rounded-full uppercase tracking-wider">
                        {trail.difficulty || "Moderate"}
                      </span>
                      {isOffline && (
                        <span className="text-[10px] font-bold text-white bg-blue-600/90 backdrop-blur-xs px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <WifiOff size={12} /> Offline Cached
                        </span>
                      )}
                    </div>

                    {/* Title overlay */}
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <h2 className="text-2xl font-black drop-shadow-sm flex items-center gap-2">
                        <Mountain size={20} className="text-emerald-400 shrink-0" />
                        {trail.name}
                      </h2>
                      <p className="text-xs text-white/80 mt-0.5 flex items-center gap-1">
                        <MapPin size={12} />
                        {trail.barangay && trail.barangay !== "N/A"
                          ? `${trail.barangay}, ${trail.city}`
                          : trail.city}
                      </p>
                    </div>
                  </div>

                  {/* CONTENT */}
                  <div className="p-6 flex flex-col flex-grow space-y-4">
                    {trail.description && (
                      <p className="text-sm text-gray-600 leading-relaxed flex-grow">
                        {trail.description}
                      </p>
                    )}

                    {/* Trail Specs Info */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block font-semibold">GPS Route Status</span>
                        <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          {trail.route_status === "published" ? "Official Verified" : "Available"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">Capacity</span>
                        <span className="font-bold text-slate-800 mt-0.5 block">
                          {trail.weekly_slots
                            ? `${trail.weekly_slots} slots`
                            : "Guided departures"}
                        </span>
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <Link
                        to={`/navigation?trail=${trailKey}`}
                        className="inline-flex items-center justify-center gap-2 text-xs font-bold py-3 px-4 rounded-xl border border-emerald-600 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 transition shadow-xs"
                      >
                        <Navigation size={14} /> View GPS Map
                      </Link>

                      <Link
                        to={`/booking?trailId=${trail.id}`}
                        className="inline-flex items-center justify-center gap-2 text-xs font-bold py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white transition shadow-sm"
                      >
                        Book Trail <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Trails;
