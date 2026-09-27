import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Phone,
  MapPin,
  Search,
  Filter,
  Loader2,
  Send,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  getIncidentReports,
  updateIncidentStatus,
  type IncidentReport
} from "@/lib/incidentService";

export default function AdminIncidents() {
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "investigating" | "resolved">("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Managing notes / resolution
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const data = await getIncidentReports();
      setIncidents(data);
    } catch (err) {
      console.error("Error loading incidents:", err);
      toast.error("Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleUpdateStatus = async (
    id: string,
    newStatus: "open" | "investigating" | "resolved",
    note?: string
  ) => {
    setUpdating(true);
    try {
      const res = await updateIncidentStatus(id, newStatus, note);
      if (res.success) {
        toast.success(`Incident status updated to ${newStatus.toUpperCase()}`);
        if (selectedIncident && selectedIncident.id === id) {
          setSelectedIncident({
            ...selectedIncident,
            status: newStatus,
            admin_notes: note !== undefined ? note : selectedIncident.admin_notes,
            resolved_at: newStatus === "resolved" ? new Date().toISOString() : selectedIncident.resolved_at,
          });
        }
        await fetchIncidents();
      } else {
        toast.error(res.error || "Failed to update incident");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  // Filtered list
  const filtered = incidents.filter((inc) => {
    const matchesStatus = statusFilter === "all" || inc.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || inc.severity === severityFilter;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      inc.trail_name?.toLowerCase().includes(query) ||
      inc.description.toLowerCase().includes(query) ||
      inc.category.toLowerCase().includes(query) ||
      inc.location_details?.toLowerCase().includes(query) ||
      inc.guide?.full_name?.toLowerCase().includes(query);

    return matchesStatus && matchesSeverity && matchesSearch;
  });

  const criticalCount = incidents.filter((i) => i.severity === "critical" && i.status !== "resolved").length;
  const openCount = incidents.filter((i) => i.status === "open").length;
  const investigatingCount = incidents.filter((i) => i.status === "investigating").length;
  const resolvedCount = incidents.filter((i) => i.status === "resolved").length;

  return (
    <div className="space-y-6">
      {/* STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center gap-4">
          <div className="bg-red-50 p-3 rounded-xl text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Critical Alerts</p>
            <p className="text-2xl font-black text-red-700">{criticalCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">New Reports</p>
            <p className="text-2xl font-black text-blue-700">{openCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center gap-4">
          <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Responding</p>
            <p className="text-2xl font-black text-amber-700">{investigatingCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex items-center gap-4">
          <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Resolved</p>
            <p className="text-2xl font-black text-emerald-700">{resolvedCount}</p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by trail, guide, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold">
            {(["all", "open", "investigating", "resolved"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg capitalize transition ${
                  statusFilter === st ? "bg-white shadow-xs text-gray-900" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 bg-white outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="high">High Only</option>
            <option value="medium">Medium Only</option>
            <option value="low">Low Only</option>
          </select>
        </div>
      </div>

      {/* MAIN CONTENT LIST */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-gray-100">
          <Loader2 className="animate-spin text-emerald-600 mb-2" size={36} />
          <p className="text-gray-500 text-xs font-bold">Loading incident records...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-gray-200 text-center">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3">
            <Shield size={28} />
          </div>
          <h3 className="font-bold text-gray-900 text-base">No Incidents Found</h3>
          <p className="text-gray-500 text-xs mt-1 max-w-sm">
            There are currently no reported incidents matching your selected filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((inc) => {
            const isCritical = inc.severity === "critical";
            const severityBadge =
              inc.severity === "critical"
                ? "bg-red-100 text-red-800 border-red-300"
                : inc.severity === "high"
                ? "bg-amber-100 text-amber-800 border-amber-300"
                : inc.severity === "medium"
                ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                : "bg-blue-50 text-blue-800 border-blue-200";

            const statusBadge =
              inc.status === "resolved"
                ? "bg-emerald-100 text-emerald-800"
                : inc.status === "investigating"
                ? "bg-amber-100 text-amber-800"
                : "bg-blue-100 text-blue-800";

            return (
              <div
                key={inc.id}
                className={`bg-white rounded-2xl p-5 border transition hover:shadow-md ${
                  isCritical ? "border-red-300 ring-2 ring-red-100" : "border-gray-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${severityBadge}`}>
                      {inc.severity} Severity
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                      {inc.category.replace("_", " ")}
                    </span>
                    {inc.requires_assistance && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-600 text-white animate-pulse">
                        Ranger Support Requested
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2.5 py-0.5 rounded-md font-bold uppercase ${statusBadge}`}>
                      {inc.status}
                    </span>
                    <span className="text-gray-400 font-medium">
                      {new Date(inc.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left 2 columns: Details */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                      <MapPin size={14} className="text-red-500 shrink-0" />
                      <span>{inc.trail_name || "Trail"}</span>
                      {inc.location_details && (
                        <span className="text-gray-500 font-normal">({inc.location_details})</span>
                      )}
                    </div>

                    <p className="text-xs text-gray-800 font-medium whitespace-pre-line leading-relaxed bg-gray-50 p-3 rounded-xl">
                      {inc.description}
                    </p>

                    {inc.action_taken && (
                      <div className="text-[11px] text-gray-600">
                        <strong className="text-gray-900">Guide Actions:</strong> {inc.action_taken}
                      </div>
                    )}

                    {inc.admin_notes && (
                      <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl text-xs text-emerald-900">
                        <strong>Park HQ Notes:</strong> {inc.admin_notes}
                      </div>
                    )}
                  </div>

                  {/* Right column: Guide contact & quick actions */}
                  <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4 space-y-3">
                    <div className="text-xs space-y-1">
                      <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Reporting Guide</p>
                      <p className="font-bold text-gray-900">{inc.guide?.full_name || "Assigned Guide"}</p>
                      {inc.guide?.phone && (
                        <a
                          href={`tel:${inc.guide.phone}`}
                          className="text-emerald-700 font-semibold flex items-center gap-1 hover:underline"
                        >
                          <Phone size={12} /> {inc.guide.phone}
                        </a>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-2">
                      {inc.status === "open" && (
                        <button
                          onClick={() => handleUpdateStatus(inc.id, "investigating", "Ranger unit dispatched to trail coordinates.")}
                          disabled={updating}
                          className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                        >
                          Acknowledge & Dispatch Rangers
                        </button>
                      )}

                      {inc.status !== "resolved" && (
                        <button
                          onClick={() => {
                            setSelectedIncident(inc);
                            setAdminNote(inc.admin_notes || "");
                          }}
                          className="w-full py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
                        >
                          Resolve & Update Notes
                        </button>
                      )}

                      {inc.status === "resolved" && (
                        <button
                          onClick={() => {
                            setSelectedIncident(inc);
                            setAdminNote(inc.admin_notes || "");
                          }}
                          className="w-full py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                        >
                          View / Edit Resolution
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RESOLUTION & NOTES MODAL */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Incident Resolution Notes</h3>
                <p className="text-xs text-gray-500">{selectedIncident.trail_name}</p>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Admin Response / Actions Taken
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Medical team administered first aid; trekker safely transported down. Trail cleared of debris."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                This note will be communicated to the reporting tour guide and logged into park safety archives.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={() => {
                  handleUpdateStatus(selectedIncident.id, "resolved", adminNote);
                  setSelectedIncident(null);
                }}
                className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
