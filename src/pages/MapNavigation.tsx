import { useState, useEffect } from "react";
import {
  MapPin,
  Navigation,
  Compass,
  ExternalLink,
  Mountain,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { NNNP_TRAILS_METADATA } from "@/lib/trailData";
import { WeatherWidget } from "@/components/WeatherWidget";
import { Link } from "react-router-dom";
import { StravaTrailMap } from "@/components/StravaTrailMap";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  RoutePoint,
  CheckpointItem,
  DEFAULT_MANDALAGAN_GPS_POINTS,
  DEFAULT_MANDALAGAN_CHECKPOINTS,
} from "@/lib/routeTypes";

export default function MapNavigation() {
  const { isAdmin } = useAuth();
  const [selectedTrailKey, setSelectedTrailKey] = useState<string>("mt-mandalagan");
  const trail = NNNP_TRAILS_METADATA[selectedTrailKey];

  // Route state loaded from Supabase or default
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>(DEFAULT_MANDALAGAN_GPS_POINTS);
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>(DEFAULT_MANDALAGAN_CHECKPOINTS);
  const [trailDistanceKm, setTrailDistanceKm] = useState<number>(14.5);
  const [routeStatus, setRouteStatus] = useState<"draft" | "published">("published");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"strava" | "overview">("strava");

  // Fetch saved route from Supabase for this trail
  useEffect(() => {
    let isMounted = true;
    const fetchTrailRoute = async () => {
      try {
        const { data, error } = await supabase
          .from("trails")
          .select("id, name, route_geojson, distance_km, route_status")
          .ilike("name", `%${trail.mountain}%`)
          .maybeSingle();

        if (error) {
          console.warn("Could not load custom trail route from DB:", error);
          return;
        }

        if (data && data.route_geojson && isMounted) {
          const geo = data.route_geojson as any;
          if (geo.features && Array.isArray(geo.features)) {
            // Find line feature
            const lineFeature = geo.features.find(
              (f: any) => f.geometry && f.geometry.type === "LineString"
            );
            if (lineFeature && lineFeature.geometry.coordinates) {
              const loadedPts: RoutePoint[] = lineFeature.geometry.coordinates.map(
                (c: [number, number]) => ({
                  lng: c[0],
                  lat: c[1],
                })
              );
              if (loadedPts.length > 0) setRoutePoints(loadedPts);
            }

            // Find point features (checkpoints)
            const pointFeatures = geo.features.filter(
              (f: any) =>
                f.geometry &&
                f.geometry.type === "Point" &&
                f.properties?.pointType === "checkpoint"
            );
            if (pointFeatures.length > 0) {
              const loadedCps: CheckpointItem[] = pointFeatures.map((pf: any, idx: number) => ({
                id: pf.id || `cp-${idx}`,
                name: pf.properties?.name || "Checkpoint",
                lng: pf.geometry.coordinates[0],
                lat: pf.geometry.coordinates[1],
                elevation: pf.properties?.elevation,
                description: pf.properties?.description,
              }));
              setCheckpoints(loadedCps);
            }
          }

          if (data.distance_km) setTrailDistanceKm(Number(data.distance_km));
          if (data.route_status) {
            setRouteStatus(data.route_status as "draft" | "published");
          }
        }
      } catch (err) {
        console.warn("Error fetching trail route:", err);
      }
    };

    fetchTrailRoute();
    return () => {
      isMounted = false;
    };
  }, [selectedTrailKey, trail.mountain]);

  // Handle Admin saving route as draft or publishing
  const handleSaveRoute = async (saveData: {
    points: RoutePoint[];
    checkpoints: CheckpointItem[];
    distanceKm: number;
    status: "draft" | "published";
  }) => {
    setIsSaving(true);
    try {
      // Build GeoJSON structure
      const geojsonPayload = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: saveData.points.map((p) => [p.lng, p.lat]),
            },
            properties: {
              name: `${trail.name} Strava GPS Route`,
              distance_km: saveData.distanceKm,
              stroke: "#10b981",
            },
          },
          // Start point
          ...(saveData.points.length > 0
            ? [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [saveData.points[0].lng, saveData.points[0].lat],
                },
                properties: {
                  name: "Old Hospital Trailhead, Patag",
                  pointType: "start",
                },
              },
            ]
            : []),
          // Destination point
          ...(saveData.points.length > 1
            ? [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [
                    saveData.points[saveData.points.length - 1].lng,
                    saveData.points[saveData.points.length - 1].lat,
                  ],
                },
                properties: {
                  name: "Mount Mandalagan Summit",
                  pointType: "destination",
                  elevation: "1,885 MASL",
                },
              },
            ]
            : []),
          // Checkpoints
          ...saveData.checkpoints.map((cp) => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [cp.lng, cp.lat],
            },
            properties: {
              id: cp.id,
              name: cp.name,
              pointType: "checkpoint",
              elevation: cp.elevation,
              description: cp.description,
            },
          })),
        ],
      };

      // Find matching trail in DB to update
      const { data: matchedTrail } = await supabase
        .from("trails")
        .select("id")
        .ilike("name", `%${trail.mountain}%`)
        .maybeSingle();

      if (matchedTrail?.id) {
        const { error: updateErr } = await supabase
          .from("trails")
          .update({
            route_geojson: geojsonPayload as any,
            distance_km: saveData.distanceKm,
            route_status: saveData.status,
          })
          .eq("id", matchedTrail.id);

        if (updateErr) throw updateErr;
      }

      setRoutePoints(saveData.points);
      setCheckpoints(saveData.checkpoints);
      setTrailDistanceKm(saveData.distanceKm);
      setRouteStatus(saveData.status);

      toast.success(
        saveData.status === "published"
          ? "Official GPS route published successfully for all trekkers!"
          : "Draft GPS route saved successfully in Supabase."
      );
    } catch (err: any) {
      console.error("Save route error:", err);
      toast.error(err.message || "Failed to save route to database.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100/70 px-3.5 py-1.5 rounded-full mb-3 shadow-2xs">
            <Navigation className="w-3.5 h-3.5" /> Strava GPS Trail Mapping & Wayfinding
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight">
            Trailhead Navigation & GPS Route Map
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-2">
            Explore continuous Strava-style GPS route paths, turn-by-turn waypoint landmarks, and official DENR ranger stations across Northern Negros Natural Park.
          </p>
        </div>

        {/* Trail Selector Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(NNNP_TRAILS_METADATA).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setSelectedTrailKey(key)}
              className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col gap-2 ${selectedTrailKey === key
                  ? "border-emerald-600 bg-emerald-50/60 shadow-md ring-2 ring-emerald-600/20"
                  : "border-gray-200 hover:border-emerald-300 bg-white"
                }`}
            >
              <div className="h-28 w-full rounded-xl overflow-hidden bg-slate-100">
                <img src={t.imageUrl} alt={t.name} className="w-full h-full object-cover object-center" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  {t.mountain}
                </span>
                <h3 className="font-bold text-gray-900 text-xs mt-0.5 truncate">{t.alias || t.name}</h3>
                <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" /> {t.city}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* View Switcher Tabs: Strava GPS Map vs Meeting Points Overview */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("strava")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activeTab === "strava"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              Strava GPS Trail Route (Continuous Polyline)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activeTab === "overview"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Meeting Points & Directions
            </button>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" /> DENR Admin Mode Active
            </div>
          )}
        </div>

        {/* Tab 1: Strava GPS Trail Map */}
        {activeTab === "strava" && (
          <div className="space-y-6">
            <StravaTrailMap
              initialPoints={routePoints}
              initialCheckpoints={checkpoints}
              isAdmin={isAdmin}
              onSaveRoute={handleSaveRoute}
              trailName={trail.name}
              trailDifficulty={trail.difficulty}
              trailDuration={trail.duration}
              isSaving={isSaving}
              publishedStatus={routeStatus}
            />

            {/* Trekker Route Specs Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Verified Start Trailhead
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm mt-1">Old Hospital, Brgy. Patag</h4>
                <p className="text-xs text-slate-500 mt-0.5">Silay City (10.6946° N, 123.1742° E)</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Official Destination Peak
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm mt-1">Mt. Mandalagan Summit</h4>
                <p className="text-xs text-slate-500 mt-0.5">Peak Caldera (10.6375° N, 123.2358° E)</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Total Trail Distance
                </span>
                <h4 className="font-extrabold text-emerald-600 text-base mt-1">
                  {trailDistanceKm} Kilometers
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">Dynamic Haversine GPS summation</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Trail Access Status
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    {routeStatus === "published" ? "Open & Verified" : "Draft Status"}
                  </h4>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Accredited guide required</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Overview & Meeting Points */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Meeting Point Card */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-200 space-y-6">
              {/* Trail Photo Banner */}
              <div className="relative h-48 sm:h-60 rounded-2xl overflow-hidden shadow-xs">
                <img
                  src={trail.imageUrl}
                  alt={trail.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-5">
                  <div>
                    <span className="text-xs font-bold text-white bg-emerald-700/90 px-3 py-1 rounded-full uppercase tracking-wider">
                      {trail.elevation}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5 drop-shadow-sm">{trail.name}</h2>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                    Official Meeting Point
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    GPS: {trail.lat.toFixed(4)}° N, {trail.lng.toFixed(4)}° E
                  </span>
                </div>
                <h2 className="text-2xl font-black text-gray-900">{trail.meetingPoint.name}</h2>
                <p className="text-sm text-gray-600 mt-1">{trail.meetingPoint.address}</p>
              </div>

              {/* Landmark Box */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 text-xs space-y-1">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-emerald-700" />
                  Key Navigation Landmark:
                </div>
                <p className="text-gray-700">{trail.meetingPoint.landmark}</p>
                <p className="text-gray-500 italic mt-1">{trail.meetingPoint.description}</p>
              </div>

              {/* One-Click Navigation Links */}
              <div className="flex flex-wrap gap-3">
                <a
                  href={trail.navigationUrls.googleMaps}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 px-5 rounded-2xl text-xs transition shadow-md"
                >
                  Open in Google Maps <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Interactive Embedded Map Preview */}
              <div className="rounded-2xl overflow-hidden border border-gray-200 h-64 relative bg-slate-100 shadow-inner">
                <iframe
                  title="Trailhead OpenStreetMap Location"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${trail.lng - 0.04}%2C${trail.lat - 0.04}%2C${trail.lng + 0.04}%2C${trail.lat + 0.04}&layer=mapnik&marker=${trail.lat}%2C${trail.lng}`}
                />
              </div>

              {/* Trail Quick Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block font-semibold">Elevation</span>
                  <span className="font-bold text-gray-900">{trail.elevation}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block font-semibold">Trail Length</span>
                  <span className="font-bold text-gray-900">{trail.distance}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block font-semibold">Est. Duration</span>
                  <span className="font-bold text-gray-900">{trail.duration}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Weather & Book Button */}
            <div className="space-y-6">
              <WeatherWidget
                lat={trail.lat}
                lng={trail.lng}
                trailName={trail.name}
              />

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-4">
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                  Trail Safety Guidelines
                </h3>
                <ul className="space-y-2 text-xs text-gray-600">
                  {trail.safetyGuidelines.map((g, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2">
                  <Link
                    to={`/booking`}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md"
                  >
                    Book Permit for this Trail <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
