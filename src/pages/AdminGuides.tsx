import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Edit2, CheckCircle, XCircle, Phone, Clock,
  FileText, ZoomIn, AlertTriangle, ShieldCheck, ShieldX,
  ExternalLink, Loader2, Bell, Mail, MapPin, Download
} from "lucide-react";
import { toast } from "sonner";

type GuideProfile = {
  id: string;
  full_name: string | null;
  experience_years: number | null;
  phone: string | null;
  email?: string | null;
  address?: string | null;
  bio: string | null;
  certifications?: string | null;
  image_url: string | null;
  is_available: boolean | null;
  role: string | null;
  guide_application_status?: string | null;
  guide_id_url?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
};

type RegisteredUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
};

// ─────────────────────────────────────────────────────────────
// DOCUMENT REVIEW MODAL
// ─────────────────────────────────────────────────────────────
function ReviewModal({
  applicant,
  onClose,
  onApprove,
  onReject,
}: {
  applicant: GuideProfile;
  onClose: () => void;
  onApprove: (applicant: GuideProfile, notes: string) => Promise<void>;
  onReject: (applicant: GuideProfile, reason: string) => Promise<void>;
}) {
  const [action, setAction] = useState<"idle" | "approve" | "reject">("idle");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isImage = applicant.guide_id_url
    ? /\.(jpg|jpeg|png|gif|webp)$/i.test(applicant.guide_id_url)
    : false;

  const handleApprove = async () => {
    setSubmitting(true);
    await onApprove(applicant, notes);
    setSubmitting(false);
    onClose();
  };

  const handleReject = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for rejection.");
      return;
    }
    setSubmitting(true);
    await onReject(applicant, reason);
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-800 font-black text-lg flex items-center justify-center border-2 border-amber-200">
              {applicant.full_name?.charAt(0) || "?"}
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">
                Review Application — {applicant.full_name || "Applicant"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Role: Tour Guide
                </span>
                <span className="text-xs text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  Application Status: Pending Review
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 transition p-1.5 rounded-xl hover:bg-red-50"
            title="Close"
          >
            <XCircle size={22} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">

          {/* Applicant Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-2xl p-4 text-xs border border-gray-100">
            <div>
              <p className="text-gray-500 uppercase tracking-wider font-bold text-[10px] mb-0.5">Full Name</p>
              <p className="text-gray-900 font-semibold">{applicant.full_name || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wider font-bold text-[10px] mb-0.5">Role Applied</p>
              <p className="text-emerald-700 font-bold">Tour Guide</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wider font-bold text-[10px] mb-0.5">Email Address</p>
              <p className="text-gray-900 font-semibold flex items-center gap-1.5 truncate">
                <Mail size={12} className="text-gray-400 shrink-0" />
                <span>{applicant.email || "Not specified in profile"}</span>
              </p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wider font-bold text-[10px] mb-0.5">Phone Number</p>
              <p className="text-gray-900 font-semibold flex items-center gap-1.5">
                <Phone size={12} className="text-gray-400 shrink-0" />
                <span>{applicant.phone || "Not provided"}</span>
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-gray-500 uppercase tracking-wider font-bold text-[10px] mb-0.5">Home Address</p>
              <p className="text-gray-900 font-semibold flex items-center gap-1.5">
                <MapPin size={12} className="text-gray-400 shrink-0" />
                <span>{applicant.address || "Not provided"}</span>
              </p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wider font-bold text-[10px] mb-0.5">Experience</p>
              <p className="text-gray-900 font-semibold">{applicant.experience_years || 0} years</p>
            </div>
            <div>
              <p className="text-gray-500 uppercase tracking-wider font-bold text-[10px] mb-0.5">Date Applied</p>
              <p className="text-gray-900 font-semibold">
                {applicant.created_at
                  ? new Date(applicant.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "—"}
              </p>
            </div>
            {applicant.certifications && (
              <div className="sm:col-span-2">
                <p className="text-gray-500 uppercase tracking-wider font-bold text-[10px] mb-0.5">Certifications</p>
                <p className="text-gray-900 font-semibold">{applicant.certifications}</p>
              </div>
            )}
            {applicant.bio && (
              <div className="sm:col-span-2">
                <p className="text-gray-500 uppercase tracking-wider font-bold text-[10px] mb-0.5">Bio / Background</p>
                <p className="text-gray-700 italic">"{applicant.bio}"</p>
              </div>
            )}
          </div>

          {/* Submitted Document */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-amber-600" />
                <h3 className="text-sm font-black text-gray-800">Guide ID / Accreditation Certificate</h3>
              </div>
              {applicant.guide_id_url && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Status: Uploaded
                </span>
              )}
            </div>

            {applicant.guide_id_url ? (
              <div className="border-2 border-amber-200 rounded-2xl overflow-hidden bg-amber-50">
                {isImage ? (
                  <div>
                    <div className="relative group bg-white p-2">
                      <img
                        src={applicant.guide_id_url}
                        alt="Guide ID Certificate"
                        className="w-full max-h-72 object-contain bg-white rounded-xl"
                      />
                      <a
                        href={applicant.guide_id_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition rounded-xl"
                      >
                        <span className="opacity-0 group-hover:opacity-100 flex items-center gap-2 bg-white/95 text-gray-800 font-bold text-xs px-4 py-2 rounded-full shadow-lg transition">
                          <ZoomIn size={14} /> View Full Size
                        </span>
                      </a>
                    </div>
                    <div className="p-3 bg-amber-50/80 border-t border-amber-200 flex items-center justify-between text-xs">
                      <span className="text-amber-900 font-medium">Accreditation Certificate Image</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={applicant.guide_id_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition"
                        >
                          <ExternalLink size={12} /> Open in New Tab
                        </a>
                        <a
                          href={applicant.guide_id_url}
                          download="tour-guide-certificate"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition"
                        >
                          <Download size={12} /> Download
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <FileText size={28} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">PDF Document Uploaded</p>
                        <p className="text-xs text-gray-500">Official Guide ID / Accreditation PDF file</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={applicant.guide_id_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-200/80 hover:bg-amber-300 px-3 py-2 rounded-xl transition"
                      >
                        <ExternalLink size={13} /> Open Document
                      </a>
                      <a
                        href={applicant.guide_id_url}
                        download="tour-guide-certificate.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-200/80 hover:bg-emerald-300 px-3 py-2 rounded-xl transition"
                      >
                        <Download size={13} /> Download
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-800">No Document Submitted</p>
                  <p className="text-xs text-red-600">This applicant did not upload an accreditation certificate. You can reject or request documents.</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons (Step 1) */}
          {action === "idle" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => setAction("approve")}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition"
              >
                <ShieldCheck size={18} /> Approve Application
              </button>
              <button
                onClick={() => setAction("reject")}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm border-2 border-red-200 transition"
              >
                <ShieldX size={18} /> Reject Application
              </button>
              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm border border-gray-200 transition"
              >
                <Clock size={16} /> Keep Pending
              </button>
            </div>
          )}

          {/* APPROVE FLOW */}
          {action === "approve" && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                <h4 className="font-black text-emerald-800 text-sm">Confirm Approval</h4>
              </div>
              <p className="text-xs text-emerald-700">
                Approving will grant <strong>{applicant.full_name}</strong> full Tour Guide access and send them a congratulatory notification.
              </p>
              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">
                  Admin Notes (optional — sent to the guide)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Welcome! Your accreditation is approved. Please check your guide dashboard for assignments."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-emerald-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-400 outline-none resize-none bg-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setAction("idle")}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Back
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="flex-2 flex items-center justify-center gap-2 py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {submitting ? "Approving..." : "✅ Confirm Approval"}
                </button>
              </div>
            </div>
          )}

          {/* REJECT FLOW */}
          {action === "reject" && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldX size={18} className="text-red-600" />
                <h4 className="font-black text-red-800 text-sm">Reject Application</h4>
              </div>
              <p className="text-xs text-red-700">
                Rejecting will record the reason in the database and notify <strong>{applicant.full_name}</strong>.
              </p>
              <div>
                <label className="block text-xs font-bold text-red-800 mb-1">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Submitted ID is unclear or expired. Please resubmit a valid DENR accreditation certificate or government-issued ID..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border border-red-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-red-400 outline-none resize-none bg-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setAction("idle")}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Back
                </button>
                <button
                  onClick={handleReject}
                  disabled={submitting || !reason.trim()}
                  className="flex-2 flex items-center justify-center gap-2 py-2.5 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  {submitting ? "Rejecting..." : "❌ Confirm Rejection"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function AdminGuides() {
  const [guides, setGuides] = useState<GuideProfile[]>([]);
  const [pendingApplicants, setPendingApplicants] = useState<GuideProfile[]>([]);
  const [candidateUsers, setCandidateUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit/Promote modal
  const [showModal, setShowModal] = useState(false);
  const [editingGuide, setEditingGuide] = useState<GuideProfile | null>(null);

  // Review modal
  const [reviewApplicant, setReviewApplicant] = useState<GuideProfile | null>(null);

  // Pulse animation for new applicants
  const [newApplicantAlert, setNewApplicantAlert] = useState(false);

  // Form states
  const [selectedUserId, setSelectedUserId] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    experience_years: 0,
    contact_info: "",
    certifications: "",
    bio: "",
    image_url: "",
    active: true,
  });

  const fetchGuides = async () => {
    setLoading(true);
    try {
      const { data: allProfiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && allProfiles) {
        const typedProfiles = allProfiles as unknown as GuideProfile[];

        // Active / Approved Guides
        const approved = typedProfiles.filter(
          (p) =>
            p.role === "guide" &&
            (p.guide_application_status === "approved" ||
              p.guide_application_status === null ||
              (p.guide_application_status === "none" && p.is_available === true) ||
              (!p.guide_application_status && p.is_available !== false))
        );

        // Pending Applicants
        const applicants = typedProfiles.filter(
          (p) =>
            p.guide_application_status === "pending" ||
            (p.role === "guide" && p.is_available === false && p.guide_application_status !== "approved")
        );

        const candidates = (allProfiles as any[])
          .filter((p) => p.role !== "guide" && p.role !== "admin")
          .map((p) => ({
            id: p.id,
            full_name: p.full_name,
            phone: p.phone,
            role: p.role,
          }));

        setGuides(approved);
        setPendingApplicants(applicants);
        setCandidateUsers(candidates);

        if (applicants.length > 0) setNewApplicantAlert(true);
      }
    } catch (err) {
      console.error("Error fetching guides:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuides();

    // 1. Real-time subscription listening to all changes on profiles table
    const channel = supabase
      .channel("admin_guide_applicants_channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          fetchGuides();
          const rec = payload.new as any;
          if (
            rec &&
            (rec.guide_application_status === "pending" ||
              (rec.role === "guide" && rec.is_available === false && rec.guide_application_status !== "approved"))
          ) {
            setNewApplicantAlert(true);
            toast("📋 New Tour Guide Application Submitted!", {
              description: `${rec.full_name || "A new applicant"} submitted credentials for Tour Guide review.`,
            });
          }
        }
      )
      .subscribe();

    // 2. Periodic polling fallback (every 6 seconds) to ensure real-time consistency
    const pollInterval = setInterval(() => {
      fetchGuides();
    }, 6000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, []);

  const handleOpenModal = (guide: GuideProfile | null = null) => {
    if (guide) {
      setEditingGuide(guide);
      setSelectedUserId(guide.id);
      setFormData({
        name: guide.full_name || "",
        experience_years: guide.experience_years || 0,
        contact_info: guide.phone || "",
        certifications: guide.certifications || "",
        bio: guide.bio || "",
        image_url: guide.image_url || "",
        active: guide.is_available ?? true,
      });
    } else {
      setEditingGuide(null);
      setSelectedUserId("");
      setFormData({
        name: "",
        experience_years: 1,
        contact_info: "",
        certifications: "Standard NNNP Tour Guide",
        bio: "",
        image_url: "",
        active: true,
      });
    }
    setShowModal(true);
  };

  // ── APPROVE ──────────────────────────────────────────────────
  const handleApproveApplicant = async (applicant: GuideProfile, notes: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          role: "guide" as any,
          is_available: true,
          guide_application_status: "approved",
        })
        .eq("id", applicant.id);

      if (error) throw error;

      const message = notes.trim()
        ? `Congratulations! Your application to become an Accredited NNNP Tour Guide has been APPROVED. Admin note: ${notes}`
        : "Congratulations! Your application to become an Accredited NNNP Tour Guide has been APPROVED by DENR NNNP Admin. You can now access your Guide Dashboard.";

      try {
        const { error: notifErr } = await supabase.from("notifications").insert({
          user_id: applicant.id,
          title: "🎉 Tour Guide Application APPROVED!",
          message,
          type: "guide_approval",
          link: "/guide-dashboard",
        });
        if (notifErr) {
          await supabase.from("notifications").insert({
            user_id: applicant.id,
            title: "🎉 Tour Guide Application APPROVED!",
            message,
            type: "booking_approved",
            link: "/guide-dashboard",
          });
        }
      } catch (e) {
        console.warn("Tour guide approval notification skipped:", e);
      }

      toast.success(`✅ ${applicant.full_name || "Applicant"} is now an Accredited Tour Guide!`);
      fetchGuides();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve applicant";
      toast.error(message);
      throw err;
    }
  };

  // ── REJECT ───────────────────────────────────────────────────
  const handleRejectApplicant = async (applicant: GuideProfile, reason: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          role: "trekker" as any,
          is_available: false,
          guide_application_status: "rejected",
          rejection_reason: reason,
        } as any)
        .eq("id", applicant.id);

      if (error) throw error;

      try {
        const { error: notifErr } = await supabase.from("notifications").insert({
          user_id: applicant.id,
          title: "Tour Guide Application — Not Approved",
          message: `Your Tour Guide application has been reviewed and was not approved. Reason: ${reason}. You may reapply after addressing the concerns or contact DENR NNNP for guidance.`,
          type: "guide_rejection",
          link: "/profile",
        });
        if (notifErr) {
          await supabase.from("notifications").insert({
            user_id: applicant.id,
            title: "Tour Guide Application — Not Approved",
            message: `Your Tour Guide application has been reviewed and was not approved. Reason: ${reason}. You may reapply after addressing the concerns or contact DENR NNNP for guidance.`,
            type: "booking_rejected",
            link: "/profile",
          });
        }
      } catch (e) {
        console.warn("Tour guide rejection notification skipped:", e);
      }

      toast.info(`Application for ${applicant.full_name || "Applicant"} was rejected.`);
      fetchGuides();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reject applicant";
      toast.error(message);
      throw err;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGuide) {
        const payload = {
          full_name: formData.name,
          experience_years: formData.experience_years,
          phone: formData.contact_info,
          certifications: formData.certifications,
          bio: formData.bio,
          image_url: formData.image_url,
          is_available: formData.active,
          role: "guide" as const,
        };
        const { error } = await supabase.from("profiles").update(payload).eq("id", editingGuide.id);
        if (error) throw error;
        toast.success("Guide updated successfully");
      } else {
        if (!selectedUserId) {
          toast.error("Please select an existing registered user to promote.");
          return;
        }
        const payload = {
          full_name: formData.name,
          experience_years: formData.experience_years,
          phone: formData.contact_info,
          certifications: formData.certifications,
          bio: formData.bio,
          image_url: formData.image_url,
          is_available: formData.active,
          role: "guide" as const,
          guide_application_status: "approved",
        };
        const { error } = await supabase.from("profiles").update(payload).eq("id", selectedUserId);
        if (error) throw error;

        try {
          const { error: notifErr } = await supabase.from("notifications").insert({
            user_id: selectedUserId,
            title: "🎉 Promoted to Accredited Tour Guide!",
            message: "The Park Administrator has approved your accreditation as an Official NNNP Tour Guide.",
            type: "guide_approval",
            link: "/guide-dashboard",
          });
          if (notifErr) {
            await supabase.from("notifications").insert({
              user_id: selectedUserId,
              title: "🎉 Promoted to Accredited Tour Guide!",
              message: "The Park Administrator has approved your accreditation as an Official NNNP Tour Guide.",
              type: "booking_approved",
              link: "/guide-dashboard",
            });
          }
        } catch (e) {
          console.warn("Tour guide promotion notification skipped:", e);
        }

        toast.success("User promoted to Accredited Tour Guide!");
      }

      setShowModal(false);
      fetchGuides();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save guide";
      toast.error(message);
    }
  };

  const toggleActive = async (guide: GuideProfile) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_available: !guide.is_available })
        .eq("id", guide.id);
      if (error) throw error;
      toast.success(guide.is_available ? "Guide marked as Inactive" : "Guide marked as Active");
      fetchGuides();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to toggle status";
      toast.error(message);
    }
  };

  if (loading)
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">Loading tour guides...</p>
      </div>
    );

  return (
    <div className="space-y-8">

      {/* ─────────── PENDING APPLICANTS ─────────── */}
      {pendingApplicants.length > 0 ? (
        <div className="bg-amber-50/80 rounded-3xl border-2 border-amber-300 p-6 shadow-sm">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className={`p-2 bg-amber-500 text-white rounded-xl relative ${newApplicantAlert ? "animate-pulse" : ""}`}>
                <Clock size={20} />
                {newApplicantAlert && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                )}
              </span>
              <div>
                <h3 className="text-lg font-black text-amber-950 flex items-center gap-2">
                  Pending Tour Guide Applications
                  <span className="inline-flex items-center justify-center bg-amber-500 text-white text-xs font-black rounded-full w-6 h-6">
                    {pendingApplicants.length}
                  </span>
                </h3>
                <p className="text-xs text-amber-700">
                  Review each applicant's ID/certificate before approving or rejecting.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-amber-600" />
              <span className="px-3 py-1 bg-amber-200/80 text-amber-900 rounded-full text-xs font-bold uppercase tracking-wider">
                Requires Review
              </span>
            </div>
          </div>

          {/* Applicant Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingApplicants.map((applicant) => (
              <div
                key={applicant.id}
                className="bg-white rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition flex flex-col overflow-hidden"
              >
                {/* Card top stripe */}
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-400" />

                <div className="p-5 flex flex-col flex-1">
                  {/* Identity row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 font-black text-xl flex items-center justify-center border-2 border-amber-200 flex-shrink-0">
                        {applicant.full_name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm leading-tight">
                          {applicant.full_name || "Applicant"}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Role: Tour Guide
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex-shrink-0">
                      Pending Review
                    </span>
                  </div>

                  {/* Actual Registration Details */}
                  <div className="text-xs text-gray-600 space-y-1.5 mb-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Phone size={12} className="text-gray-400 shrink-0" />
                      <span><strong>Phone:</strong> {applicant.phone || "Not provided"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Mail size={12} className="text-gray-400 shrink-0" />
                      <span className="truncate"><strong>Email:</strong> {applicant.email || "Not specified in profile"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <MapPin size={12} className="text-gray-400 shrink-0" />
                      <span className="truncate"><strong>Address:</strong> {applicant.address || "Not provided"}</span>
                    </div>
                    {applicant.created_at && (
                      <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-200">
                        Applied {new Date(applicant.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>

                  {/* Guide ID / Accreditation Certificate Status */}
                  <div className="mb-4">
                    {applicant.guide_id_url ? (
                      <div className="rounded-xl overflow-hidden border border-amber-200 bg-amber-50 p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                            <CheckCircle size={13} className="text-emerald-600" />
                            Guide ID / Accreditation Certificate: <span className="underline ml-0.5">Uploaded</span>
                          </span>
                        </div>
                        {/\.(jpg|jpeg|png|gif|webp)$/i.test(applicant.guide_id_url) ? (
                          <div className="relative rounded-lg overflow-hidden bg-white h-24 border border-amber-100">
                            <img
                              src={applicant.guide_id_url}
                              alt="ID Preview"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-amber-100">
                            <FileText size={20} className="text-amber-600" />
                            <span className="text-[11px] font-medium text-gray-700">PDF Certificate Document</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-2.5">
                        <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                        <p className="text-xs font-semibold text-red-600">No accreditation certificate uploaded</p>
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  <div className="mt-auto">
                    <button
                      onClick={() => {
                        setNewApplicantAlert(false);
                        setReviewApplicant(applicant);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition"
                    >
                      <FileText size={14} /> Review Application
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Empty state for pending */
        <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-200 flex items-center justify-center flex-shrink-0">
            <CheckCircle size={24} className="text-green-700" />
          </div>
          <div>
            <h3 className="text-sm font-black text-green-800">No Pending Applications</h3>
            <p className="text-xs text-green-600 mt-0.5">
              All guide applications have been reviewed. New applications will appear here automatically.
            </p>
          </div>
        </div>
      )}

      {/* ─────────── ACTIVE GUIDES ─────────── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Accredited Tour Guides</h2>
            <p className="text-xs text-gray-500 mt-1">
              Active guides available for trekking assignments in Northern Negros Natural Park.
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition shadow-sm"
          >
            <Plus size={16} /> Promote / Add Guide
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guides.map((guide) => (
            <div
              key={guide.id}
              className="border border-gray-200 rounded-2xl p-5 flex flex-col hover:shadow-md transition bg-white"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  {guide.image_url ? (
                    <img
                      src={guide.image_url}
                      alt={guide.full_name ?? ""}
                      className="w-12 h-12 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xl">
                      {guide.full_name?.charAt(0) || "?"}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">{guide.full_name}</h3>
                    <p className="text-xs text-gray-500">{guide.experience_years || 0} years experience</p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    guide.is_available ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                  }`}
                >
                  {guide.is_available ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="space-y-1 mb-4 flex-1 text-xs">
                <p className="text-gray-700">
                  <strong className="text-gray-900">Contact:</strong> {guide.phone || "N/A"}
                </p>
                {guide.certifications && (
                  <p className="text-gray-600">
                    <strong className="text-gray-900">Cert:</strong> {guide.certifications}
                  </p>
                )}
                {guide.bio && <p className="text-gray-500 line-clamp-2 mt-2">{guide.bio}</p>}
              </div>

              <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleOpenModal(guide)}
                  className="flex-1 flex justify-center items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-xs font-bold transition"
                >
                  <Edit2 size={13} /> Edit
                </button>
                <button
                  onClick={() => toggleActive(guide)}
                  className={`flex-1 flex justify-center items-center gap-1.5 py-2 rounded-xl text-xs font-bold transition ${
                    guide.is_available
                      ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {guide.is_available ? <XCircle size={13} /> : <CheckCircle size={13} />}
                  {guide.is_available ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
          {guides.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500 border-2 border-dashed rounded-3xl">
              No tour guides accredited yet. Review pending applicants above or promote registered users.
            </div>
          )}
        </div>
      </div>

      {/* ─────────── REVIEW MODAL ─────────── */}
      {reviewApplicant && (
        <ReviewModal
          applicant={reviewApplicant}
          onClose={() => setReviewApplicant(null)}
          onApprove={handleApproveApplicant}
          onReject={handleRejectApplicant}
        />
      )}

      {/* ─────────── ADD / EDIT GUIDE MODAL ─────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                {editingGuide ? "Edit Tour Guide Profile" : "Promote User to Tour Guide"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500">
                <XCircle size={22} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              {!editingGuide ? (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Select Registered User *
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => {
                      const uid = e.target.value;
                      setSelectedUserId(uid);
                      const found = candidateUsers.find((c) => c.id === uid);
                      if (found) {
                        setFormData((prev) => ({
                          ...prev,
                          name: found.full_name || "",
                          contact_info: found.phone || "",
                        }));
                      }
                    }}
                    className="w-full border border-gray-300 p-2.5 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    required
                  >
                    <option value="">-- Choose a user to promote --</option>
                    {candidateUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || "Unnamed User"} ({u.phone || "No phone"}) [{u.role}]
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  required type="text" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Experience (Years)
                  </label>
                  <input
                    required type="number" min="0" value={formData.experience_years}
                    onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Contact Phone
                  </label>
                  <input
                    required type="text" value={formData.contact_info}
                    onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                    className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Accreditation / Certifications
                </label>
                <input
                  type="text" placeholder="e.g. First Aid Certified, DENR Eco-Guide"
                  value={formData.certifications}
                  onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Bio / Specialties
                </label>
                <textarea
                  rows={2} value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Photo URL (Optional)
                </label>
                <input
                  type="url" value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox" id="active" checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="active" className="text-xs font-medium text-gray-700 cursor-pointer">
                  Guide is active and immediately available for assignments
                </label>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                >
                  {editingGuide ? "Save Changes" : "Confirm Accreditation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
