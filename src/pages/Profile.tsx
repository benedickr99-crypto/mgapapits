import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Compass, Clock, CheckCircle, Shield, Award, Phone, FileText, X } from "lucide-react";

export default function Profile() {
  const { user, role, signOut, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentRole, setCurrentRole] = useState("trekker");
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);

  // Profile data
  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    nationality: "Filipino",
    experience_years: 0,
    certifications: "",
    bio: "",
  });

  // Tour Guide application modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyForm, setApplyForm] = useState({
    experience_years: 1,
    certifications: "",
    bio: "",
    phone: "",
  });

  // Load profile
  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, phone, nationality, role, experience_years, certifications, bio, guide_application_status")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile({
          full_name: profileData.full_name || "",
          phone: profileData.phone || "",
          nationality: profileData.nationality || "Filipino",
          experience_years: profileData.experience_years || 0,
          certifications: profileData.certifications || "",
          bio: profileData.bio || "",
        });
        if (profileData.role) {
          setCurrentRole(profileData.role);
        }
        setApplicationStatus(profileData.guide_application_status || null);
        setApplyForm({
          experience_years: profileData.experience_years || 1,
          certifications: profileData.certifications || "Standard Mountaineering Guide",
          bio: profileData.bio || "",
          phone: profileData.phone || "",
        });
      }
    } catch (err) {
      console.warn("Could not load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handle input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  // Save profile
  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const targetRole =
        user.email?.toLowerCase() === "benedickluiser@gmail.com"
          ? currentRole
          : currentRole === "admin"
          ? "trekker"
          : currentRole;

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: profile.full_name || null,
        phone: profile.phone || null,
        nationality: profile.nationality || null,
        role: targetRole as any,
      });

      if (error) throw error;
      await refreshProfile();
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error("Error saving profile: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Submit Tour Guide application for Admin review
  const handleApplyGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setApplying(true);
    try {
      const { error } = await supabase.from("profiles").update({
        phone: applyForm.phone || profile.phone,
        experience_years: applyForm.experience_years,
        certifications: applyForm.certifications,
        bio: applyForm.bio,
        is_available: false, // Inactive until approved by admin
        guide_application_status: "pending",
      }).eq("id", user.id);

      if (error) throw error;

      // Send notification to all Admins
      try {
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin");

        if (admins && admins.length > 0) {
          const notifications = admins.map((admin) => ({
            user_id: admin.id,
            title: "📋 New Tour Guide Application",
            message: `${profile.full_name || "A trekker"} has applied to become an Accredited Tour Guide. Please review under Tour Guides.`,
            type: "guide_application",
            link: "/admin?tab=guides",
            entity_id: user.id,
          }));
          await supabase.from("notifications").insert(notifications);
        }
      } catch (notifErr) {
        console.warn("Could not notify admin:", notifErr);
      }

      toast.success("Tour Guide application submitted! Admin will review your credentials.");
      setShowApplyModal(false);
      setApplicationStatus("pending");
      await loadData();
      await refreshProfile();
    } catch (err: any) {
      toast.error("Failed to submit application: " + err.message);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="p-10 text-center">
        <p className="text-gray-500 mb-4">Please log in to view your profile.</p>
        <Link to="/login" className="text-green-600 hover:underline">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your account credentials and tour guide accreditation status
          <span
            className={`ml-2 px-3 py-0.5 rounded-full text-xs font-bold capitalize ${
              role === "admin"
                ? "bg-red-100 text-red-700"
                : role === "guide"
                ? "bg-blue-100 text-blue-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {role || "trekker"}
          </span>
        </p>
      </div>

      {/* TOUR GUIDE APPLICATION / ACCREDITATION STATUS CARD */}
      {role === "guide" ? (
        <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-emerald-700 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-950">Accredited NNNP Tour Guide</h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                Your credentials are authenticated. You can accept trek assignments and file incident reports.
              </p>
            </div>
          </div>
          <Link
            to="/guide-dashboard"
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition shadow-sm whitespace-nowrap"
          >
            Guide Dashboard →
          </Link>
        </div>
      ) : applicationStatus === "pending" ? (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl flex items-start gap-4 shadow-xs">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
            <Clock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-amber-950">Tour Guide Application Under Review</h3>
              <span className="px-2.5 py-0.5 bg-amber-200/80 text-amber-900 rounded-full text-[10px] font-black uppercase">
                Pending Admin Approval
              </span>
            </div>
            <p className="text-xs text-amber-800 mt-1">
              Your application with {profile.experience_years} years experience has been submitted to DENR NNNP Park Administrator. You will receive an on-site notification once your accreditation is approved.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
          <div>
            <h3 className="text-base font-bold text-emerald-950 flex items-center gap-2">
              <Compass className="text-emerald-700" size={20} /> Apply as an Accredited Tour Guide
            </h3>
            <p className="text-xs text-emerald-800 mt-1 max-w-xl">
              Experienced in trekking Mount Mandalagan or Silay trails? Submit your application to become an accredited NNNP Tour Guide and guide trekking groups.
            </p>
          </div>
          <button
            onClick={() => setShowApplyModal(true)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm transition whitespace-nowrap"
          >
            Apply to be a Guide
          </button>
        </div>
      )}

      {/* PROFILE FORM */}
      <div className="bg-white rounded-3xl shadow-xs border border-gray-200 p-6 space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              value={user.email || ""}
              disabled
              className="w-full border border-gray-200 p-3 rounded-xl bg-gray-50 text-gray-500 text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <input
              name="full_name"
              value={profile.full_name}
              onChange={handleChange}
              placeholder="Full Name"
              className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Phone Number
            </label>
            <input
              name="phone"
              value={profile.phone}
              onChange={handleChange}
              placeholder="09XX XXX XXXX"
              className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Nationality
            </label>
            <input
              name="nationality"
              value={profile.nationality}
              onChange={handleChange}
              placeholder="Nationality"
              className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-medium"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition disabled:opacity-50 shadow-sm"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>

          <button
            onClick={signOut}
            className="bg-red-50 hover:bg-red-100 text-red-600 px-5 py-2.5 rounded-xl font-bold text-xs transition"
          >
            Log Out
          </button>
        </div>
      </div>

      {/* APPLICATION MODAL */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Apply as Accredited Tour Guide</h3>
                <p className="text-xs text-gray-500 mt-0.5">Northern Negros Natural Park (NNNP) Eco-Tourism</p>
              </div>
              <button onClick={() => setShowApplyModal(false)} className="text-gray-400 hover:text-red-500">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApplyGuide} className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-xs text-emerald-800">
                Your application will be forwarded directly to the DENR NNNP Admin for credential verification.
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Contact Phone *
                </label>
                <input
                  required
                  type="text"
                  placeholder="09XX XXX XXXX"
                  value={applyForm.phone}
                  onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Mountaineering / Guiding Experience (Years) *
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  max="50"
                  value={applyForm.experience_years}
                  onChange={(e) => setApplyForm({ ...applyForm, experience_years: parseInt(e.target.value) || 0 })}
                  className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  First Aid / Ranger Certifications
                </label>
                <input
                  type="text"
                  placeholder="e.g. Philippine Red Cross First Aid, DOT Tour Guide Accreditation"
                  value={applyForm.certifications}
                  onChange={(e) => setApplyForm({ ...applyForm, certifications: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Statement of Capability / Trail Familiarity *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Tell the administrator about your familiarity with NNNP trails (e.g., Tinagong Dagat, Gintubdan, Campuestohan), wilderness safety training, and motivation..."
                  value={applyForm.bio}
                  onChange={(e) => setApplyForm({ ...applyForm, bio: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applying}
                  className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {applying ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
