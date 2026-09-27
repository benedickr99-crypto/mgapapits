import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Mountain, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

import { getCached, setCached } from "@/lib/cache";
import { getTrailImage } from "@/lib/trailData";

type Trail = Tables<"trails">;

const getDifficultyColor = (level: string | null) => {
  if (!level) return "bg-gray-500";
  if (level.toLowerCase().includes("easy")) return "bg-green-500";
  if (level.toLowerCase().includes("hard")) return "bg-red-500";
  return "bg-yellow-500";
};

const Trails = () => {
  // ⚡ INSTANT LOAD from cache
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
      if (cached && cached.length > 0 && trails.length === 0) {
        setTrails(cached);
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
      <section className="bg-gradient-to-r from-green-800 to-green-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1 rounded-full w-fit">
            <MapPin size={14} /> Northern Negros Natural Park
          </div>

          <h1 className="mt-6 text-4xl md:text-5xl font-bold">
            Explore Trails
          </h1>

          <p className="mt-3 text-white/80 max-w-xl">
            Choose your adventure. Each trail offers a unique trekking
            experience with breathtaking views and natural beauty.
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {trails.map((trail) => (
              <div
                key={trail.id}
                className="animate-on-scroll card-hover group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full flex flex-col"
              >
                {/* TRAIL PHOTO */}
                <div className="relative h-56 overflow-hidden bg-slate-900">
                  <img
                    src={getTrailImage(trail.name)}
                    alt={trail.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                  {/* BADGE */}
                  {trail.difficulty && (
                    <span
                      className={`absolute top-4 left-4 text-xs font-semibold text-white px-3 py-1 rounded-full shadow-sm ${getDifficultyColor(
                        trail.difficulty
                      )}`}
                    >
                      {trail.difficulty}
                    </span>
                  )}
                </div>

                {/* CONTENT */}
                <div className="p-6 flex flex-col flex-grow">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Mountain size={18} />
                    {trail.name}
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    {trail.barangay}, {trail.city}
                  </p>

                  {trail.description && (
                    <p className="text-sm text-gray-600 mt-3 flex-grow">
                      {trail.description}
                    </p>
                  )}

                  {trail.weekly_slots && (
                    <p className="text-xs text-gray-400 mt-2">
                      Weekly slots: {trail.weekly_slots}
                    </p>
                  )}

                  {/* BUTTON */}
                  <Link
                    to={`/booking?trailId=${trail.id}`}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:underline"
                  >
                    Book this trail <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Trails;
