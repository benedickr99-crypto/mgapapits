import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import {
  RoutePoint,
  CheckpointItem,
  calculateTotalDistance,
  MANDALAGAN_DEFAULT_START,
  MANDALAGAN_DEFAULT_DESTINATION,
  DEFAULT_MANDALAGAN_GPS_POINTS,
  DEFAULT_MANDALAGAN_CHECKPOINTS,
} from "@/lib/routeTypes";
import {
  MapPin,
  Flag,
  Mountain,
  Plus,
  Trash2,
  Undo2,
  RotateCcw,
  Save,
  CheckCircle2,
  Layers,
  Info,
  Maximize2,
  Navigation,
  Compass,
} from "lucide-react";

// Fix Leaflet's default icon path issues in bundled environments
const createCustomPin = (color: string, iconLabel: string, border = "#ffffff") => {
  return L.divIcon({
    className: "custom-leaflet-div-icon",
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
        border: 2px solid ${border};
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: 800;
          font-size: 13px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.4);
        ">${iconLabel}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const createWaypointIcon = (index: number) => {
  return L.divIcon({
    className: "custom-waypoint-icon",
    html: `
      <div style="
        background-color: #059669;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 11px;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: grab;
      ">${index}</div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const startIcon = createCustomPin("#10b981", "S"); // Strava vibrant green
const destinationIcon = createCustomPin("#ef4444", "★"); // Bright red mountain summit
const checkpointIcon = createCustomPin("#3b82f6", "⛺"); // Blue tent for checkpoints

interface StravaTrailMapProps {
  initialPoints?: RoutePoint[];
  initialCheckpoints?: CheckpointItem[];
  isAdmin?: boolean;
  onSaveRoute?: (routeData: {
    points: RoutePoint[];
    checkpoints: CheckpointItem[];
    distanceKm: number;
    status: "draft" | "published";
  }) => Promise<void> | void;
  trailName?: string;
  trailDifficulty?: string;
  trailDuration?: string;
  isSaving?: boolean;
  publishedStatus?: "draft" | "published";
}

export const StravaTrailMap: React.FC<StravaTrailMapProps> = ({
  initialPoints,
  initialCheckpoints,
  isAdmin = false,
  onSaveRoute,
  trailName = "Mount Mandalagan Summit Trail",
  trailDifficulty = "Challenging",
  trailDuration = "7 - 9 hours",
  isSaving = false,
  publishedStatus = "draft",
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layers
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const glowPolylineLayerRef = useRef<L.Polyline | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const checkpointsLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Route state
  const [points, setPoints] = useState<RoutePoint[]>(() => {
    return initialPoints && initialPoints.length > 0
      ? initialPoints
      : DEFAULT_MANDALAGAN_GPS_POINTS;
  });

  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>(() => {
    return initialCheckpoints && initialCheckpoints.length > 0
      ? initialCheckpoints
      : DEFAULT_MANDALAGAN_CHECKPOINTS;
  });

  // History for undo
  const [history, setHistory] = useState<RoutePoint[][]>([]);

  // Mode for click handling: "add_point" | "add_checkpoint" | "view"
  const [activeTool, setActiveTool] = useState<"draw" | "checkpoint" | "browse">("browse");

  // Temporary checkpoint state for modal
  const [pendingCheckpointCoord, setPendingCheckpointCoord] = useState<RoutePoint | null>(null);
  const [cpName, setCpName] = useState("");
  const [cpElevation, setCpElevation] = useState("");
  const [cpDesc, setCpDesc] = useState("");
  const [showCpModal, setShowCpModal] = useState(false);

  // Status state
  const [currentStatus, setCurrentStatus] = useState<"draft" | "published">(publishedStatus);

  // Total distance calculation
  const totalDistanceKm = useMemo(() => {
    return calculateTotalDistance(points);
  }, [points]);

  // Sync external changes
  useEffect(() => {
    if (initialPoints && initialPoints.length > 0) {
      setPoints(initialPoints);
    }
  }, [initialPoints]);

  useEffect(() => {
    if (initialCheckpoints && initialCheckpoints.length > 0) {
      setCheckpoints(initialCheckpoints);
    }
  }, [initialCheckpoints]);

  useEffect(() => {
    setCurrentStatus(publishedStatus);
  }, [publishedStatus]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center between Patag and Summit
    const centerLat = (MANDALAGAN_DEFAULT_START.lat + MANDALAGAN_DEFAULT_DESTINATION.lat) / 2;
    const centerLng = (MANDALAGAN_DEFAULT_START.lng + MANDALAGAN_DEFAULT_DESTINATION.lng) / 2;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 13,
      zoomControl: false, // We add custom positioned zoom control
    });

    // Add OpenStreetMap base tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | TA KAZZ DENR NNNP',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Create layer groups
    markersLayerGroupRef.current = L.layerGroup().addTo(map);
    checkpointsLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map click listeners depending on active tool and role
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.off("click");

    if (isAdmin && activeTool === "draw") {
      map.on("click", (e: L.LeafletMouseEvent) => {
        const newPoint: RoutePoint = {
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        };
        setPoints((prev) => {
          setHistory((h) => [...h.slice(-15), prev]);
          return [...prev, newPoint];
        });
      });
    } else if (isAdmin && activeTool === "checkpoint") {
      map.on("click", (e: L.LeafletMouseEvent) => {
        setPendingCheckpointCoord({
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        });
        setCpName("");
        setCpElevation("");
        setCpDesc("");
        setShowCpModal(true);
      });
    }
  }, [isAdmin, activeTool]);

  // Re-render Strava Route Polyline and Markers whenever points change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Remove previous polylines
    if (glowPolylineLayerRef.current) {
      map.removeLayer(glowPolylineLayerRef.current);
      glowPolylineLayerRef.current = null;
    }
    if (polylineLayerRef.current) {
      map.removeLayer(polylineLayerRef.current);
      polylineLayerRef.current = null;
    }

    // 2. Clear markers layer
    if (markersLayerGroupRef.current) {
      markersLayerGroupRef.current.clearLayers();
    }

    if (points.length === 0) return;

    const latLngs: [number, number][] = points.map((p) => [p.lat, p.lng]);

    // Strava-Style Aesthetic: Outer vibrant neon glow + Inner thick solid line
    // Outer glow polyline
    const glowPolyline = L.polyline(latLngs, {
      color: "#059669", // Darker emerald backdrop for high contrast
      weight: 10,
      opacity: 0.35,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);
    glowPolylineLayerRef.current = glowPolyline;

    // Continuous bright green Strava GPS route polyline
    const mainPolyline = L.polyline(latLngs, {
      color: "#10b981", // Strava-style vibrant energetic green
      weight: 6,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);
    polylineLayerRef.current = mainPolyline;

    // 3. Render Start Marker (Always at index 0 or default Old Hospital)
    const startPoint = points[0] || MANDALAGAN_DEFAULT_START;
    const startMarker = L.marker([startPoint.lat, startPoint.lng], {
      icon: startIcon,
      title: "Trail Starting Point: Old Hospital, Patag",
      draggable: isAdmin && activeTool === "draw",
    });
    startMarker.bindPopup(`
      <div style="font-family: sans-serif; min-width: 180px;">
        <span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
          Starting Trailhead
        </span>
        <h4 style="font-size: 14px; font-weight: 800; margin: 6px 0 2px 0; color: #111827;">Old Hospital, Brgy. Patag</h4>
        <p style="font-size: 11px; color: #4b5563; margin: 0;">Silay City, Negros Occidental</p>
        <p style="font-size: 10px; color: #9ca3af; margin-top: 4px; font-family: monospace;">GPS: ${startPoint.lat.toFixed(4)}, ${startPoint.lng.toFixed(4)}</p>
      </div>
    `);
    if (isAdmin && activeTool === "draw") {
      startMarker.on("dragend", (e: any) => {
        const marker = e.target;
        const position = marker.getLatLng();
        setPoints((prev) => {
          setHistory((h) => [...h, prev]);
          const updated = [...prev];
          updated[0] = { lat: Number(position.lat.toFixed(6)), lng: Number(position.lng.toFixed(6)) };
          return updated;
        });
      });
    }
    markersLayerGroupRef.current?.addLayer(startMarker);

    // 4. Render Destination Marker (Mount Mandalagan Summit)
    const destPoint = points[points.length - 1] || MANDALAGAN_DEFAULT_DESTINATION;
    if (points.length > 1) {
      const destMarker = L.marker([destPoint.lat, destPoint.lng], {
        icon: destinationIcon,
        title: "Trail Destination: Mt. Mandalagan Summit",
        draggable: isAdmin && activeTool === "draw",
      });
      destMarker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 180px;">
          <span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Destination Peak
          </span>
          <h4 style="font-size: 14px; font-weight: 800; margin: 6px 0 2px 0; color: #111827;">Mount Mandalagan Summit</h4>
          <p style="font-size: 11px; color: #4b5563; margin: 0;">Peak Elevation: 1,885 MASL</p>
          <p style="font-size: 10px; color: #9ca3af; margin-top: 4px; font-family: monospace;">GPS: ${destPoint.lat.toFixed(4)}, ${destPoint.lng.toFixed(4)}</p>
        </div>
      `);
      if (isAdmin && activeTool === "draw") {
        destMarker.on("dragend", (e: any) => {
          const marker = e.target;
          const position = marker.getLatLng();
          setPoints((prev) => {
            setHistory((h) => [...h, prev]);
            const updated = [...prev];
            updated[updated.length - 1] = {
              lat: Number(position.lat.toFixed(6)),
              lng: Number(position.lng.toFixed(6)),
            };
            return updated;
          });
        });
      }
      markersLayerGroupRef.current?.addLayer(destMarker);
    }

    // 5. If Admin is in Draw mode, render draggable waypoints for intermediate points
    if (isAdmin && activeTool === "draw" && points.length > 2) {
      for (let i = 1; i < points.length - 1; i++) {
        const pt = points[i];
        const wpMarker = L.marker([pt.lat, pt.lng], {
          icon: createWaypointIcon(i),
          draggable: true,
          title: `Waypoint #${i}`,
        });

        wpMarker.on("dragend", (e: any) => {
          const marker = e.target;
          const position = marker.getLatLng();
          setPoints((prev) => {
            setHistory((h) => [...h, prev]);
            const updated = [...prev];
            updated[i] = {
              lat: Number(position.lat.toFixed(6)),
              lng: Number(position.lng.toFixed(6)),
            };
            return updated;
          });
        });

        wpMarker.bindPopup(`
          <div style="font-family: sans-serif; padding: 2px;">
            <p style="font-weight: bold; font-size: 12px; margin: 0 0 6px 0;">Waypoint #${i}</p>
            <p style="font-size: 10px; color: #6b7280; margin: 0 0 8px 0;">Lat: ${pt.lat.toFixed(5)}, Lng: ${pt.lng.toFixed(5)}</p>
            <button id="del-wp-${i}" style="background: #fee2e2; color: #dc2626; border: 1px solid #f87171; font-weight: bold; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer;">
              Remove Point
            </button>
          </div>
        `);

        wpMarker.on("popupopen", () => {
          const btn = document.getElementById(`del-wp-${i}`);
          if (btn) {
            btn.onclick = () => {
              setPoints((prev) => {
                setHistory((h) => [...h, prev]);
                return prev.filter((_, idx) => idx !== i);
              });
            };
          }
        });

        markersLayerGroupRef.current?.addLayer(wpMarker);
      }
    }
  }, [points, isAdmin, activeTool]);

  // Re-render Checkpoint Markers
  useEffect(() => {
    if (!checkpointsLayerGroupRef.current) return;
    checkpointsLayerGroupRef.current.clearLayers();

    checkpoints.forEach((cp) => {
      const marker = L.marker([cp.lat, cp.lng], {
        icon: checkpointIcon,
        title: cp.name,
      });

      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 200px;">
          <span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
            Trail Checkpoint
          </span>
          <h4 style="font-size: 14px; font-weight: 800; margin: 6px 0 2px 0; color: #111827;">${cp.name}</h4>
          ${cp.elevation ? `<p style="font-size: 11px; font-weight: 600; color: #0284c7; margin: 2px 0;">⛰ Elevation: ${cp.elevation}</p>` : ""}
          ${cp.description ? `<p style="font-size: 11px; color: #4b5563; margin: 4px 0;">${cp.description}</p>` : ""}
          <p style="font-size: 10px; color: #9ca3af; margin-top: 4px; font-family: monospace;">GPS: ${cp.lat.toFixed(4)}, ${cp.lng.toFixed(4)}</p>
          ${
            isAdmin
              ? `<div style="margin-top: 8px; border-top: 1px solid #e5e7eb; padding-top: 6px;">
                  <button id="del-cp-${cp.id}" style="background: #fee2e2; color: #dc2626; border: 1px solid #f87171; font-weight: bold; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; width: 100%;">
                    Delete Checkpoint
                  </button>
                </div>`
              : ""
          }
        </div>
      `);

      if (isAdmin) {
        marker.on("popupopen", () => {
          const btn = document.getElementById(`del-cp-${cp.id}`);
          if (btn) {
            btn.onclick = () => {
              setCheckpoints((prev) => prev.filter((item) => item.id !== cp.id));
            };
          }
        });
      }

      checkpointsLayerGroupRef.current?.addLayer(marker);
    });
  }, [checkpoints, isAdmin]);

  // Fit bounds to show entire route
  const fitRouteBounds = () => {
    if (!mapInstanceRef.current || points.length === 0) return;
    const latLngs: [number, number][] = points.map((p) => [p.lat, p.lng]);
    const bounds = L.latLngBounds(latLngs);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
  };

  // Undo last route addition
  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setPoints(last);
  };

  // Clear route completely (or reset to start + summit)
  const handleClearRoute = () => {
    if (!confirm("Are you sure you want to clear all plotted route points?")) return;
    setHistory((prev) => [...prev, points]);
    setPoints([MANDALAGAN_DEFAULT_START, MANDALAGAN_DEFAULT_DESTINATION]);
  };

  // Reset to verified Strava route
  const handleResetToVerified = () => {
    if (!confirm("Reset route to the verified NNNP Patag to Mandalagan Summit path?")) return;
    setHistory((prev) => [...prev, points]);
    setPoints(DEFAULT_MANDALAGAN_GPS_POINTS);
    setCheckpoints(DEFAULT_MANDALAGAN_CHECKPOINTS);
  };

  // Save checkpoint modal confirmation
  const handleConfirmCheckpoint = () => {
    if (!pendingCheckpointCoord || !cpName.trim()) return;
    const newCp: CheckpointItem = {
      id: `cp-${Date.now()}`,
      name: cpName.trim(),
      lat: pendingCheckpointCoord.lat,
      lng: pendingCheckpointCoord.lng,
      elevation: cpElevation.trim() ? `${cpElevation.trim()} MASL` : undefined,
      description: cpDesc.trim() || undefined,
    };
    setCheckpoints((prev) => [...prev, newCp]);
    setShowCpModal(false);
    setPendingCheckpointCoord(null);
  };

  // Save handler (Draft or Published)
  const handleSave = async (status: "draft" | "published") => {
    if (!onSaveRoute) return;
    setCurrentStatus(status);
    await onSaveRoute({
      points,
      checkpoints,
      distanceKm: totalDistanceKm,
      status,
    });
  };

  return (
    <div className="space-y-4">
      {/* Strava Top Stat Bar */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Mountain className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest uppercase bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full">
                Strava GPS Trail
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  currentStatus === "published"
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {currentStatus === "published" ? "Official Published" : "DENR Draft Route"}
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-black text-white mt-0.5 tracking-tight">
              {trailName}
            </h2>
          </div>
        </div>

        {/* Live Route Telemetry (Strava Style) */}
        <div className="flex items-center gap-6 divide-x divide-slate-800">
          <div className="text-left">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Distance
            </span>
            <div className="text-2xl font-black text-emerald-400">
              {totalDistanceKm} <span className="text-xs font-semibold text-slate-400">km</span>
            </div>
          </div>
          <div className="pl-6 text-left">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Est. Time
            </span>
            <div className="text-lg font-bold text-white">{trailDuration}</div>
          </div>
          <div className="pl-6 text-left">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Difficulty
            </span>
            <div className="text-lg font-bold text-amber-400">{trailDifficulty}</div>
          </div>
          <div className="pl-6 text-left hidden sm:block">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Checkpoints
            </span>
            <div className="text-lg font-bold text-blue-400">{checkpoints.length} verified</div>
          </div>
        </div>
      </div>

      {/* Admin Drawing Controls Bar */}
      {isAdmin && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-1 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-emerald-700" /> Admin Tools:
            </span>
            <button
              type="button"
              onClick={() => setActiveTool("browse")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTool === "browse"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Browse Map
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("draw")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTool === "draw"
                  ? "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/20"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <Plus className="w-3.5 h-3.5" /> Draw Route ({points.length} pts)
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("checkpoint")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTool === "checkpoint"
                  ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20"
                  : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
              }`}
            >
              <Flag className="w-3.5 h-3.5" /> Add Checkpoint
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition flex items-center gap-1"
              title="Undo last added route point"
            >
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
            <button
              type="button"
              onClick={handleClearRoute}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Route
            </button>
            <button
              type="button"
              onClick={handleResetToVerified}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition flex items-center gap-1"
              title="Reset to official NNNP verified GPS trail"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Default
            </button>

            <div className="h-5 w-px bg-slate-200 mx-1" />

            {/* Save Buttons */}
            <button
              type="button"
              onClick={() => handleSave("draft")}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" /> Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSave("published")}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Publish Verified
            </button>
          </div>
        </div>
      )}

      {/* Mode Instruction Notice when Admin is Drawing */}
      {isAdmin && activeTool === "draw" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>Draw Mode Active:</strong> Click on the map to add sequential GPS waypoints along the trail. Drag waypoints to adjust curves or click on any point to delete it.
            </span>
          </div>
          <span className="font-mono font-bold text-emerald-800">{points.length} GPS Points</span>
        </div>
      )}

      {isAdmin && activeTool === "checkpoint" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-700 shrink-0" />
          <span>
            <strong>Checkpoint Mode Active:</strong> Click anywhere along the hiking trail to place a verified checkpoint (e.g., Tinagong Dagat, water springs, emergency shelters).
          </span>
        </div>
      )}

      {/* Main Interactive Map Canvas */}
      <div className="relative rounded-3xl overflow-hidden border-2 border-slate-300 shadow-md bg-slate-100 h-[500px] md:h-[620px]">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Strava Legend / Key */}
        <div className="absolute top-4 left-4 z-[400] bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-lg border border-slate-200 text-xs space-y-2 pointer-events-auto max-w-[240px]">
          <div className="font-bold text-slate-900 flex items-center justify-between">
            <span>Trail Route Legend</span>
            <button
              type="button"
              onClick={fitRouteBounds}
              title="Fit map to entire route"
              className="text-slate-500 hover:text-slate-900 transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-4 h-1.5 bg-emerald-500 rounded-full inline-block shadow-xs" />
              <span className="font-medium">Strava GPS Polyline</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-emerald-500 border border-white rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white shadow-xs">
                S
              </span>
              <span>Start: Old Hospital, Patag</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 border border-white rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white shadow-xs">
                ★
              </span>
              <span>Destination: Mt. Mandalagan Peak</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 border border-white rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white shadow-xs">
                ⛺
              </span>
              <span>Verified Checkpoints</span>
            </div>
          </div>
        </div>

        {/* Reset View Button */}
        <button
          type="button"
          onClick={fitRouteBounds}
          className="absolute bottom-6 left-6 z-[400] bg-white hover:bg-slate-50 text-slate-800 font-bold px-3.5 py-2 rounded-2xl shadow-lg border border-slate-200 text-xs flex items-center gap-2 transition"
        >
          <Maximize2 className="w-3.5 h-3.5 text-emerald-700" /> Center Trail View
        </button>
      </div>

      {/* Checkpoints Overview Cards */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-blue-600" />
            <h3 className="font-extrabold text-slate-900 text-base">
              Verified Trail Checkpoints ({checkpoints.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Official NNNP Navigation Waypoints
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {checkpoints.map((cp, idx) => (
            <div
              key={cp.id || idx}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50/40 hover:border-blue-200 transition space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-slate-900 text-sm">{cp.name}</h4>
                {cp.elevation && (
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full shrink-0">
                    {cp.elevation}
                  </span>
                )}
              </div>
              {cp.description && (
                <p className="text-xs text-slate-600 leading-relaxed">{cp.description}</p>
              )}
              <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-200 flex items-center justify-between">
                <span>GPS: {cp.lat.toFixed(4)}° N, {cp.lng.toFixed(4)}° E</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setCheckpoints((prev) => prev.filter((c) => c.id !== cp.id))}
                    className="text-red-600 hover:text-red-800 font-sans font-bold text-[11px]"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal for adding a new checkpoint */}
      {showCpModal && pendingCheckpointCoord && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-blue-700 font-bold text-sm uppercase tracking-wider">
              <Flag className="w-4 h-4" /> Add Verified Trail Checkpoint
            </div>
            <h3 className="text-xl font-black text-slate-900">Checkpoint Details</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Checkpoint Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={cpName}
                  onChange={(e) => setCpName(e.target.value)}
                  placeholder="e.g. Tinagong Dagat High Caldera"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Elevation (MASL, optional)
                </label>
                <input
                  type="text"
                  value={cpElevation}
                  onChange={(e) => setCpElevation(e.target.value)}
                  placeholder="e.g. 1550"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description / Landmark Information
                </label>
                <textarea
                  rows={3}
                  value={cpDesc}
                  onChange={(e) => setCpDesc(e.target.value)}
                  placeholder="Official rest area, water source, or campsite..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-100 font-mono text-[11px] text-slate-600">
                Pinned GPS: {pendingCheckpointCoord.lat.toFixed(6)}, {pendingCheckpointCoord.lng.toFixed(6)}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowCpModal(false);
                  setPendingCheckpointCoord(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!cpName.trim()}
                onClick={handleConfirmCheckpoint}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50 shadow-sm"
              >
                Save Checkpoint Pin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
