import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit2, CheckCircle, XCircle, UserCheck, ShieldAlert, Award, Phone, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

type GuideProfile = {
  id: string;
  full_name: string | null;
  experience_years: number | null;
  phone: string | null;
  bio: string | null;
  certifications?: string | null;
  image_url: string | null;
  is_available: boolean | null;
  role: string | null;
  guide_application_status?: string | null;
  created_at?: string;
};

type RegisteredUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
};

export default function AdminGuides() {
  const [guides, setGuides] = useState<GuideProfile[]>([]);
  const [pendingApplicants, setPendingApplicants] = useState<GuideProfile[]>([]);
  const [candidateUsers, setCandidateUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGuide, setEditingGuide] = useState<GuideProfile | null>(null);

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
      // 1. Fetch all profiles that are guides or have pending application
      const { data: allProfiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

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

        // Candidates eligible for direct promotion
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
      }
    } catch (err) {
      console.error("Error fetching guides:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuides();
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

  // Accept a pending applicant
  const handleAcceptApplicant = async (applicant: GuideProfile) => {
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

      // Send notification to applicant
      try {
        await supabase.from("notifications").insert({
          user_id: applicant.id,
          title: "🎉 Tour Guide Application Approved!",
          message:
            "Congratulations! Your application to become an Accredited NNNP Tour Guide has been APPROVED by DENR NNNP Admin. You can now access your Guide Dashboard to view assignments.",
          type: "guide_approval",
          link: "/guide-dashboard",
        });
      } catch (notifErr) {
        console.warn("Could not notify applicant:", notifErr);
      }

      toast.success(`${applicant.full_name || "Applicant"} is now an Accredited Tour Guide!`);
      fetchGuides();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve applicant";
      toast.error(message);
    }
  };

  // Decline a pending applicant
  const handleDeclineApplicant = async (applicant: GuideProfile) => {
    if (!confirm(`Are you sure you want to decline ${applicant.full_name || "this applicant"}'s tour guide application?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          role: "trekker" as any,
          is_available: false,
          guide_application_status: "rejected",
        })
        .eq("id", applicant.id);

      if (error) throw error;

      // Send notification to applicant
      try {
        await supabase.from("notifications").insert({
          user_id: applicant.id,
          title: "Tour Guide Application Update",
          message:
            "Your application for Tour Guide accreditation was reviewed and could not be approved at this time. You may contact DENR Headquarters for accreditation requirements.",
          type: "guide_rejection",
          link: "/profile",
        });
      } catch (notifErr) {
        console.warn("Could not notify applicant:", notifErr);
      }

      toast.info(`Application for ${applicant.full_name || "Applicant"} was declined.`);
      fetchGuides();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to decline applicant";
      toast.error(message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGuide) {
        // Updating existing guide
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
        // Promoting selected registered user to Guide
        if (!selectedUserId) {
          toast.error("Please select an existing registered user to promote to Tour Guide.");
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

        // Send notification to the promoted user
        try {
          await supabase.from("notifications").insert({
            user_id: selectedUserId,
            title: "🎉 Promoted to Accredited Tour Guide!",
            message: "The Park Administrator has approved your accreditation as an Official NNNP Tour Guide.",
            type: "guide_approval",
            link: "/guide-dashboard",
          });
        } catch (notifErr) {
          console.warn("Could not notify user:", notifErr);
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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading tour guides...</div>;

  return (
    <div className="space-y-8">
      {/* ================= PENDING APPLICANTS SECTION ================= */}
      {pendingApplicants.length > 0 && (
        <div className="bg-amber-50/70 rounded-3xl border-2 border-amber-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-amber-500 text-white rounded-xl">
                <Clock size={20} />
              </span>
              <div>
                <h3 className="text-lg font-black text-amber-950">
                  Pending Tour Guide Applications ({pendingApplicants.length})
                </h3>
                <p className="text-xs text-amber-700">
                  Review applicant mountaineering credentials and click Accept to grant guide privileges.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-200/80 text-amber-900 rounded-full text-xs font-bold uppercase tracking-wider">
              Requires Review
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingApplicants.map((applicant) => (
              <div
                key={applicant.id}
                className="bg-white rounded-2xl p-5 border border-amber-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 font-black text-xl flex items-center justify-center border-2 border-amber-200">
                        {applicant.full_name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{applicant.full_name || "Applicant"}</h4>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Phone size={12} /> {applicant.phone || "No phone provided"}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md text-[10px] font-black uppercase">
                      Applicant
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl mb-4">
                    <p>
                      <strong className="text-gray-900">Experience:</strong>{" "}
                      {applicant.experience_years || 0} years mountaineering/guiding
                    </p>
                    {applicant.certifications && (
                      <p>
                        <strong className="text-gray-900">Certifications:</strong> {applicant.certifications}
                      </p>
                    )}
                    {applicant.bio && (
                      <p className="italic text-gray-700 mt-1 line-clamp-3">"{applicant.bio}"</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleDeclineApplicant(applicant)}
                    className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                  >
                    <XCircle size={14} /> Decline
                  </button>
                  <button
                    onClick={() => handleAcceptApplicant(applicant)}
                    className="flex-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <CheckCircle size={14} /> Accept & Approve Guide
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= ACTIVE GUIDES SECTION ================= */}
      <div className="bg-white rounded-3xl shadow-xs border border-gray-200 p-6">
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
              No tour guides accredited yet. Accept pending applicants above or promote registered users.
            </div>
          )}
        </div>
      </div>

      {/* ================= ADD / EDIT GUIDE MODAL ================= */}
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
            <form onSubmit={handleSave} className="p-6 space-y-4">
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
                  <p className="text-[11px] text-gray-400 mt-1">
                    Promoting a user gives them Tour Guide access and includes them in trail assignments.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
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
                    required
                    type="number"
                    min="0"
                    value={formData.experience_years}
                    onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
                    className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Contact Phone
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.contact_info}
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
                  type="text"
                  placeholder="e.g. First Aid Certified, DENR Eco-Guide"
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
                  rows={2}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Photo URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="active" className="text-xs font-medium text-gray-700 cursor-pointer">
                  Guide is active and immediately available for assignments
                </label>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
