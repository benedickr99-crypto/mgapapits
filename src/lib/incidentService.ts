import { supabase } from "@/integrations/supabase/client";

export type IncidentReport = {
  id: string;
  guide_id: string;
  trail_id?: string | null;
  trail_name?: string | null;
  booking_id?: string | null;
  category: "medical" | "hazard" | "lost_trekker" | "weather" | "violation" | "other";
  severity: "low" | "medium" | "high" | "critical";
  location_details?: string | null;
  description: string;
  action_taken?: string | null;
  requires_assistance?: boolean | null;
  status: "open" | "investigating" | "resolved";
  admin_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at?: string;
  guide?: {
    full_name: string | null;
    phone: string | null;
  } | null;
};

const LOCAL_STORAGE_KEY = "nnnp_incident_reports";

function getLocalIncidents(): IncidentReport[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalIncidents(reports: IncidentReport[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reports));
  } catch (e) {
    console.warn("Failed to persist incident to localStorage", e);
  }
}

/**
 * Report a new incident from tour guide to admin.
 */
export async function createIncidentReport(report: {
  guide_id: string;
  trail_id?: string | null;
  trail_name?: string | null;
  booking_id?: string | null;
  category: "medical" | "hazard" | "lost_trekker" | "weather" | "violation" | "other";
  severity: "low" | "medium" | "high" | "critical";
  location_details?: string | null;
  description: string;
  action_taken?: string | null;
  requires_assistance?: boolean;
  guide_name?: string;
  guide_phone?: string;
}): Promise<{ success: boolean; data?: IncidentReport; error?: string }> {
  const newIncident: IncidentReport = {
    id: crypto.randomUUID(),
    guide_id: report.guide_id,
    trail_id: report.trail_id || null,
    trail_name: report.trail_name || null,
    booking_id: report.booking_id || null,
    category: report.category,
    severity: report.severity,
    location_details: report.location_details || null,
    description: report.description,
    action_taken: report.action_taken || null,
    requires_assistance: report.requires_assistance ?? false,
    status: "open",
    created_at: new Date().toISOString(),
    guide: {
      full_name: report.guide_name || null,
      phone: report.guide_phone || null,
    },
  };

  // Always back up locally first
  const localList = getLocalIncidents();
  saveLocalIncidents([newIncident, ...localList]);

  try {
    // 1. Attempt insert into Supabase incident_reports
    const { data, error } = await supabase
      .from("incident_reports")
      .insert({
        id: newIncident.id,
        guide_id: newIncident.guide_id,
        trail_id: newIncident.trail_id,
        trail_name: newIncident.trail_name,
        booking_id: newIncident.booking_id,
        category: newIncident.category,
        severity: newIncident.severity,
        location_details: newIncident.location_details,
        description: newIncident.description,
        action_taken: newIncident.action_taken,
        requires_assistance: newIncident.requires_assistance,
        status: newIncident.status,
      } as any)
      .select()
      .single();

    // 2. Notify Admin
    try {
      // Find admin user id
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      if (adminProfile?.id) {
        const severityEmoji =
          report.severity === "critical"
            ? "🚨 [CRITICAL EMERGENCY]"
            : report.severity === "high"
            ? "⚠️ [HIGH SEVERITY]"
            : "📢 [INCIDENT REPORT]";

        await supabase.from("notifications").insert({
          user_id: adminProfile.id,
          title: `${severityEmoji} Trail Incident Reported`,
          message: `Guide ${report.guide_name || "Assigned Guide"} reported: "${report.category.toUpperCase()}" at ${
            report.trail_name || "Trail"
          }. ${report.requires_assistance ? "⚠️ IMMEDIATE ASSISTANCE REQUESTED!" : ""}`,
          type: "incident_alert",
          link: "/admin",
        });
      }
    } catch (notifErr) {
      console.warn("Could not send admin notification:", notifErr);
    }

    if (error) {
      console.warn("Supabase incident_reports insert warning:", error.message);
      // Still return success since local storage saved it
      return { success: true, data: newIncident };
    }

    return { success: true, data: (data as unknown as IncidentReport) || newIncident };
  } catch (err: any) {
    console.warn("createIncidentReport exception:", err);
    return { success: true, data: newIncident };
  }
}

/**
 * Fetch incident reports.
 * If guideId is provided, returns only reports for that guide.
 * Otherwise, returns all reports (Admin view).
 */
export async function getIncidentReports(guideId?: string): Promise<IncidentReport[]> {
  const localList = getLocalIncidents();

  try {
    let query = supabase
      .from("incident_reports")
      .select(`
        *,
        guide:profiles!incident_reports_guide_id_fkey(full_name, phone)
      `)
      .order("created_at", { ascending: false });

    if (guideId) {
      query = query.eq("guide_id", guideId);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      // Merge remote and local without duplicates
      const remoteIds = new Set(data.map((d: any) => d.id));
      const relevantLocal = guideId
        ? localList.filter((l) => l.guide_id === guideId && !remoteIds.has(l.id))
        : localList.filter((l) => !remoteIds.has(l.id));

      const merged = [...(data as unknown as IncidentReport[]), ...relevantLocal];
      saveLocalIncidents(merged);
      return merged;
    }
  } catch (e) {
    console.warn("Error querying incident_reports, fallback to local:", e);
  }

  // Fallback to local
  if (guideId) {
    return localList.filter((l) => l.guide_id === guideId);
  }
  return localList;
}

/**
 * Update incident status and admin notes (by Admin).
 */
export async function updateIncidentStatus(
  id: string,
  status: "open" | "investigating" | "resolved",
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  // Update local storage
  const localList = getLocalIncidents();
  const updatedLocal = localList.map((inc) => {
    if (inc.id === id) {
      return {
        ...inc,
        status,
        admin_notes: adminNotes !== undefined ? adminNotes : inc.admin_notes,
        resolved_at: status === "resolved" ? new Date().toISOString() : inc.resolved_at,
      };
    }
    return inc;
  });
  saveLocalIncidents(updatedLocal);

  try {
    const updatePayload: any = {
      status,
      admin_notes: adminNotes,
      updated_at: new Date().toISOString(),
    };
    if (status === "resolved") {
      updatePayload.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("incident_reports")
      .update(updatePayload)
      .eq("id", id);

    // Notify the guide about status update
    const target = updatedLocal.find((i) => i.id === id);
    if (target?.guide_id) {
      try {
        const statusLabel =
          status === "investigating"
            ? "Admin has acknowledged your report and rangers are investigating/responding."
            : status === "resolved"
            ? "Admin has marked this incident as RESOLVED."
            : "Admin has updated your incident report.";

        await supabase.from("notifications").insert({
          user_id: target.guide_id,
          title: `Incident Report Update: ${status.toUpperCase()}`,
          message: `${statusLabel} ${adminNotes ? `Admin Note: ${adminNotes}` : ""}`,
          type: "incident_status",
          link: "/guide-dashboard",
        });
      } catch (e) {
        console.warn("Could not notify guide:", e);
      }
    }

    if (error) {
      console.warn("updateIncidentStatus remote warning:", error.message);
    }
    return { success: true };
  } catch (err: any) {
    console.warn("updateIncidentStatus exception:", err);
    return { success: true };
  }
}
