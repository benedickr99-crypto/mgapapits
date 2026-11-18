import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
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
  Clock,
  Download,
  Wifi,
  WifiOff,
  Activity,
  Layers,
} from "lucide-react";
import { NNNP_TRAILS_METADATA } from "@/lib/trailData";
import { WeatherWidget } from "@/components/WeatherWidget";
import { StravaTrailMap } from "@/components/StravaTrailMap";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  RoutePoint,
  CheckpointItem,
  JumpOffOption,
  TrailRouteStatus,
  FOUR_TRAILS_CONFIG,
  calculateTotalDistance,
} from "@/lib/routeTypes";
import {
  getOfflineTrail,
  isTrailAvailableOffline,
  saveTrailForOffline,
} from "@/lib/offlineTrails";

export default function MapNavigation() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected trail key from URL or default to mt-mandalagan
  const initialKey = searchParams.get("trail") || "mt-mandalagan";
  const [selectedTrailKey, setSelectedTrailKey] = useState<string>(
    FOUR_TRAILS_CONFIG[initialKey] ? initialKey : "mt-mandalagan"
  );

  const trailConfig = FOUR_TRAILS_CONFIG[selectedTrailKey] || FOUR_TRAILS_CONFIG["mt-mandalagan"];
  const trailMeta = NNNP_TRAILS_METADATA[selectedTrailKey] || NNNP_TRAILS_METADATA["mt-mandalagan"];

  // Selected jump-off for Mandalagan (or default for other trails)
  const [selectedJumpOffId, setSelectedJumpOffId] = useState<string>(
    trailConfig.primaryJumpOff.id
  );

  // Active jump-off object
  const activeJumpOff =
    trailConfig.alternateJumpOffs?.find((j) => j.id === selectedJumpOffId) ||
    trailConfig.primaryJumpOff;

  // Route state
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>(trailConfig.defaultPoints);
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>(trailConfig.defaultCheckpoints);
  const [trailDistanceKm, setTrailDistanceKm] = useState<number>(trailConfig.defaultDistanceKm);
  const [routeStatus, setRouteStatus] = useState<TrailRouteStatus>("published");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"strava" | "overview">("strava");
  const [isOfflineLoaded, setIsOfflineLoaded] = useState<boolean>(false);

  // Update query param when trail changes
  const handleSelectTrail = (key: string) => {
    setSelectedTrailKey(key);
    setSearchParams({ trail: key });
    const newConfig = FOUR_TRAILS_CONFIG[key] || FOUR_TRAILS_CONFIG["mt-mandalagan"];
    setSelectedJumpOffId(newConfig.primaryJumpOff.id);
  };

  // Switch jump-off (e.g. for Mandalagan between Old Hospital, Patag and Sitio Campuestohan)
  const handleSelectJumpOff = (jumpOff: JumpOffOption) => {
    setSelectedJumpOffId(jumpOff.id);
    setRoutePoints((prev) => {
      if (prev.length === 0) return [{ lat: jumpOff.lat, lng: jumpOff.lng }];
      const copy = [...prev];
      copy[0] = { lat: jumpOff.lat, lng: jumpOff.lng };
      return copy;
    });
    toast.info(`Switched jump-off trailhead to: ${jumpOff.name}`);
  };

  // Fetch saved route from Supabase for this trail
  useEffect(() => {
    let isMounted = true;
    setIsOfflineLoaded(false);

    const fetchTrailRoute = async () => {
      try {
        const { data, error } = await supabase
          .from("trails")
          .select("id, name, route_geojson, distance_km, route_status")
          .ilike("name", `%${trailConfig.dbNamePattern}%`)
          .maybeSingle();

        if (error) {
          console.warn("Could not load trail route from DB, checking offline storage:", error);
          loadOfflineFallback();
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
            setRouteStatus(data.route_status as TrailRouteStatus);
          }
        } else if (isMounted) {
          loadOfflineFallback();
        }
      } catch (err) {
        console.warn("Error fetching trail route, using fallback:", err);
        loadOfflineFallback();
      }
    };

    const loadOfflineFallback = () => {
      const offline = getOfflineTrail(selectedTrailKey);
      if (offline && isMounted) {
        setRoutePoints(offline.points);
        setCheckpoints(offline.checkpoints);
        setTrailDistanceKm(offline.distanceKm);
        setIsOfflineLoaded(true);
      } else if (isMounted) {
        // Fallback to verified official default points
        setRoutePoints(trailConfig.defaultPoints);
        setCheckpoints(trailConfig.defaultCheckpoints);
        setTrailDistanceKm(trailConfig.defaultDistanceKm);
        setRouteStatus("published");
      }
    };

    fetchTrailRoute();
    return () => {
      isMounted = false;
    };
  }, [selectedTrailKey, trailConfig]);

  // Handle Admin saving route
  const handleSaveRoute = async (saveData: {
    points: RoutePoint[];
    checkpoints: CheckpointItem[];
    distanceKm: number;
    status: TrailRouteStatus;
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
              name: `${trailConfig.name} Strava GPS Route`,
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
                    name: activeJumpOff.name,
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
                    name: trailConfig.destination.name,
                    pointType: "destination",
                    elevation: trailConfig.destination.elevation,
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
        .ilike("name", `%${trailConfig.dbNamePattern}%`)
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
          ? `Official GPS route for ${trailConfig.name} published successfully!`
          : saveData.status === "pending_verification"
          ? `Route submitted for DENR verification.`
          : `Draft GPS route saved successfully in Supabase.`
      );
    } catch (err: any) {
      console.error("Save route error:", err);
      toast.error(err.message || "Failed to save route to database.");
    } finally {
      setIsSaving(false);
    }
  };

  // Jump-off options list
  const jumpOffOptions: JumpOffOption[] = [
    trailConfig.primaryJumpOff,
    ...(trailConfig.alternateJumpOffs || []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100/70 px-3.5 py-1.5 rounded-full mb-3 shadow-2xs">
            <Activity className="w-3.5 h-3.5 text-emerald-600" /> Strava-Style Continuous GPS Trail Routing
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight">
            NNNP Trail Mapping & Navigation
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-2">
            Explore verified GPS routes across Northern Negros Natural Park: Mt. Mandalagan, Mt. Silay, Mt. Marapara, and Malatan-og Falls with offline caching and elevation data.
          </p>
        </div>

        {/* Trail Selector Bar - 4 TRAILS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(FOUR_TRAILS_CONFIG).map(([key, config]) => {
            const isSelected = selectedTrailKey === key;
            const meta = NNNP_TRAILS_METADATA[key] || trailMeta;
            const isOffline = isTrailAvailableOffline(key);

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectTrail(key)}
                className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col gap-2 relative ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50/60 shadow-md ring-2 ring-emerald-600/20"
                    : "border-gray-200 hover:border-emerald-300 bg-white"
                }`}
              >
                {/* Offline indicator badge on card */}
                {isOffline && (
                  <span className="absolute top-2 right-2 z-10 text-[9px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                    <WifiOff className="w-2.5 h-2.5" /> Offline
                  </span>
                )}

                <div className="h-28 w-full rounded-xl overflow-hidden bg-slate-100">
                  <img
                    src={meta.imageUrl}
                    alt={config.name}
                    className="w-full h-full object-cover object-center"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    {config.mountain}
                  </span>
                  <h3 className="font-bold text-gray-900 text-xs mt-0.5 truncate">
                    {config.name}
                  </h3>
                  <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{config.location}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* View Switcher Tabs: Strava GPS Map vs Meeting Points Overview */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("strava")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "strava"
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
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "overview"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Meeting Points & Directions
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isOfflineLoaded && (
              <div className="flex items-center gap-1 text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                <WifiOff className="w-3.5 h-3.5 text-blue-600" /> Offline Cached Route
              </div>
            )}
            {isAdmin && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> DENR Admin Mode Active
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Strava GPS Trail Map */}
        {activeTab === "strava" && (
          <div className="space-y-6">
            {authLoading ? (
              <div className="flex items-center justify-center h-64 bg-slate-100 rounded-2xl">
                <div className="text-slate-500 text-sm animate-pulse">Loading trail map…</div>
              </div>
            ) : (
              <StravaTrailMap
                trailKey={selectedTrailKey}
                initialPoints={routePoints}
                initialCheckpoints={checkpoints}
                isAdmin={isAdmin}
                onSaveRoute={handleSaveRoute}
                trailName={trailConfig.name}
                mountain={trailConfig.mountain}
                location={trailConfig.location}
                trailDifficulty={trailConfig.difficulty}
                trailDuration={trailConfig.estimatedDuration}
                isSaving={isSaving}
                publishedStatus={routeStatus}
                startPointName={activeJumpOff.name}
                destinationName={trailConfig.destination.name}
                jumpOffOptions={jumpOffOptions}
                selectedJumpOffId={selectedJumpOffId}
                onSelectJumpOff={handleSelectJumpOff}
              />
            )}

            {/* Trekker Route Specs Card */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Verified Trailhead
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm mt-1">{activeJumpOff.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  ({activeJumpOff.lat.toFixed(4)}° N, {activeJumpOff.lng.toFixed(4)}° E)
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Official Destination Peak
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm mt-1">{trailConfig.destination.name}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {trailConfig.destination.elevation || "Summit Elevation"} ({trailConfig.destination.lat.toFixed(4)}° N,{" "}
                  {trailConfig.destination.lng.toFixed(4)}° E)
                </p>
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
                  <h4 className="font-extrabold text-slate-900 text-sm capitalize">
                    {routeStatus === "published"
                      ? "Official Published"
                      : routeStatus === "pending_verification"
                      ? "Pending Verification"
                      : routeStatus === "inactive"
                      ? "Temporarily Closed"
                      : "Draft Route"}
                  </h4>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Accredited guide required</p>
              </div>
            </div>

            {/* Safety Guidelines */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" /> NNNP Safety & Regulations for {trailConfig.name}
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
                {trailConfig.safetyReminders.map((s, idx) => (
                  <li key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
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
                  src={trailMeta.imageUrl}
                  alt={trailConfig.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-5">
                  <div>
                    <span className="text-xs font-bold text-white bg-emerald-700/90 px-3 py-1 rounded-full uppercase tracking-wider">
                      {trailMeta.elevation}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5 drop-shadow-sm">
                      {trailConfig.name}
                    </h2>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                    Official Meeting Point
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    GPS: {trailMeta.lat.toFixed(4)}° N, {trailMeta.lng.toFixed(4)}° E
                  </span>
                </div>
                <h2 className="text-2xl font-black text-gray-900">{trailMeta.meetingPoint.name}</h2>
                <p className="text-sm text-gray-600 mt-1">{trailMeta.meetingPoint.address}</p>
              </div>

              {/* Landmark Box */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 text-xs space-y-1">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-emerald-700" />
                  Key Navigation Landmark:
                </div>
                <p className="text-gray-700">{trailMeta.meetingPoint.landmark}</p>
                <p className="text-gray-500 italic mt-1">{trailMeta.meetingPoint.description}</p>
              </div>

              {/* One-Click Navigation Links */}
              <div className="flex flex-wrap gap-3">
                <a
                  href={trailMeta.navigationUrls.googleMaps}
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
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${trailMeta.lng - 0.04}%2C${trailMeta.lat - 0.04}%2C${trailMeta.lng + 0.04}%2C${trailMeta.lat + 0.04}&layer=mapnik&marker=${trailMeta.lat}%2C${trailMeta.lng}`}
                />
              </div>

              {/* Trail Quick Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block font-semibold">Elevation</span>
                  <span className="font-bold text-gray-900">{trailMeta.elevation}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block font-semibold">Trail Length</span>
                  <span className="font-bold text-gray-900">{trailMeta.distance}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="text-gray-400 block font-semibold">Est. Duration</span>
                  <span className="font-bold text-gray-900">{trailMeta.duration}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Weather & Book Button */}
            <div className="space-y-6">
              <WeatherWidget
                lat={trailMeta.lat}
                lng={trailMeta.lng}
                trailName={trailConfig.name}
              />

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-4">
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                  Trail Safety Guidelines
                </h3>
                <ul className="space-y-2 text-xs text-gray-600">
                  {trailMeta.safetyGuidelines.map((g, i) => (
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
