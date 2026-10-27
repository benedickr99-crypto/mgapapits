import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Upload, FileCheck, X, ShieldCheck, Shield, FileText, CheckCircle2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function Login() {
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState("trekker");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Terms and Conditions & Privacy Policy state
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [policyModalType, setPolicyModalType] = useState<"terms" | "privacy" | null>(null);

  // Guide credential upload states
  const [guideIdFile, setGuideIdFile] = useState<File | null>(null);
  const [guideIdPreview, setGuideIdPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Maximum size is 5MB.");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setError("Only JPG, PNG, WEBP, or PDF files are accepted.");
      return;
    }

    setError("");
    setGuideIdFile(file);

    // Preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setGuideIdPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setGuideIdPreview(null); // PDF — no visual preview
    }
  };

  const removeFile = () => {
    setGuideIdFile(null);
    setGuideIdPreview(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadGuideId = async (idPrefix: string): Promise<string | null> => {
    if (!guideIdFile) return null;

    const ext = guideIdFile.name.split(".").pop() || "jpg";
    const path = `guide-credentials/${idPrefix}/id-certificate-${Date.now()}.${ext}`;

    setUploadProgress(25);

    // 1. Try primary "guide-documents" bucket
    try {
      const { error: uploadError } = await supabase.storage
        .from("guide-documents")
        .upload(path, guideIdFile, { upsert: true, contentType: guideIdFile.type });

      if (!uploadError) {
        setUploadProgress(100);
        const { data } = supabase.storage.from("guide-documents").getPublicUrl(path);
        return data?.publicUrl || null;
      }
      console.warn("Upload to guide-documents failed, trying fallback:", uploadError);
    } catch (e) {
      console.warn("guide-documents bucket exception:", e);
    }

    setUploadProgress(50);

    // 2. Try "requirements" bucket (active in production)
    try {
      const { error: reqError } = await supabase.storage
        .from("requirements")
        .upload(path, guideIdFile, { upsert: true, contentType: guideIdFile.type });

      if (!reqError) {
        setUploadProgress(100);
        const { data } = supabase.storage.from("requirements").getPublicUrl(path);
        return data?.publicUrl || null;
      }
      console.warn("requirements bucket fallback failed, trying avatars:", reqError);
    } catch (e) {
      console.warn("requirements bucket exception:", e);
    }

    setUploadProgress(75);

    // 3. Try "avatars" bucket
    try {
      const { error: avatarError } = await supabase.storage
        .from("avatars")
        .upload(path, guideIdFile, { upsert: true, contentType: guideIdFile.type });

      if (!avatarError) {
        setUploadProgress(100);
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        return data?.publicUrl || null;
      }
      console.error("avatars fallback failed:", avatarError);
    } catch (e) {
      console.error("avatars bucket exception:", e);
    }

    setUploadProgress(100);
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateEmail(email)) {
      return setError("Invalid email format");
    }

    if (!validatePassword(password)) {
      return setError("Password must be at least 6 characters");
    }

    if (!agreedToTerms) {
      return setError(
        isRegister
          ? "Please click the button to agree to the Terms and Conditions and Privacy Policy before creating your account."
          : "Please click the button to agree to the Terms and Conditions and Privacy Policy before logging in."
      );
    }

    if (isRegister) {
      if (!fullName.trim()) {
        return setError("Please enter your full name");
      }
      if (role === "guide" && !phone.trim()) {
        return setError("Please enter your phone number");
      }
      if (!address.trim()) {
        return setError("Please enter your home address");
      }
      if (password !== confirmPassword) {
        return setError("Passwords do not match");
      }
    }

    if (isRegister && role === "guide" && !guideIdFile) {
      return setError(
        "Please upload your Guide ID or accreditation certificate. This is required for Tour Guide registration."
      );
    }

    setLoading(true);

    try {
      if (isRegister) {
        // Step 1: Pre-upload the accreditation certificate if guide
        let guideIdUrl: string | null = null;
        if (role === "guide" && guideIdFile) {
          const tempPrefix = `applicant-${Date.now()}`;
          guideIdUrl = await uploadGuideId(tempPrefix);
        }

        // Step 2: Create the auth account with all metadata
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
              address: address.trim(),
              email: email.trim(),
              role,
              guide_id_url: guideIdUrl,
              guide_application_status: role === "guide" ? "pending" : "none",
            },
          },
        });

        if (signUpError) throw signUpError;

        const userId = signUpData?.user?.id;

        // Step 3: Explicitly update the profile if userId is available
        if (role === "guide" && userId) {
          try {
            await supabase
              .from("profiles")
              .update({
                address: address.trim(),
                phone: phone.trim(),
                email: email.trim(),
                guide_id_url: guideIdUrl,
                guide_application_status: "pending",
                is_available: false,
              } as any)
              .eq("id", userId);
          } catch (profErr) {
            console.warn("Direct profile update skipped (handled by trigger):", profErr);
          }

          // Step 4: Notify admins that a new guide applicant has registered
          try {
            const { data: admins } = await supabase
              .from("profiles")
              .select("id")
              .eq("role", "admin");

            if (admins && admins.length > 0) {
              const notifications = admins.map((admin) => ({
                user_id: admin.id,
                title: "📋 New Tour Guide Application",
                message: `${fullName || "A new applicant"} has submitted credentials for Tour Guide accreditation and is waiting for your review.`,
                type: "guide_application_submitted",
                link: "/admin?tab=guides",
                entity_id: userId,
              }));
              const { error: notifErr } = await supabase.from("notifications").insert(notifications);
              if (notifErr) {
                const fallbackNotifications = notifications.map((n) => ({ ...n, type: "booking_created" }));
                await supabase.from("notifications").insert(fallbackNotifications);
              }
            }
          } catch (notifErr) {
            console.warn("Could not notify admin about new guide applicant:", notifErr);
          }
        }

        setSuccess(
          role === "guide"
            ? "✅ Tour Guide application submitted successfully! Your accreditation certificate is pending review by the Park Administrator."
            : "✅ Account created! Check your email to verify your address."
        );
        setIsRegister(false);
        setAgreedToTerms(false);
        setFullName("");
        setPhone("");
        setAddress("");
        setPassword("");
        setConfirmPassword("");
        removeFile();
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Smart role redirect based on actual database role
        if (signInData.user) {
          try {
            const { data: prof } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", signInData.user.id)
              .maybeSingle();

            if (prof?.role === "admin") {
              navigate("/admin");
              return;
            } else if (prof?.role === "guide") {
              navigate("/guide");
              return;
            }
          } catch {
            // Default to home on lookup error
          }
        }

        navigate("/");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-700 px-4 py-8">
      <div className="bg-white/95 backdrop-blur p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-800">
          {isRegister ? "Create Account" : "Welcome Back"}
        </h2>
        <p className="text-gray-500 mb-6 text-sm">
          {isRegister
            ? "Start your trekking journey today"
            : "Login to your account"}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <input
                id="reg-fullname"
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3 border rounded-lg"
                required
              />

              <input
                id="reg-phone"
                type="tel"
                placeholder={role === "guide" ? "Phone Number *" : "Phone Number"}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 border rounded-lg"
                required={role === "guide"}
              />

              <input
                id="reg-address"
                type="text"
                placeholder="Home Address *"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-3 border rounded-lg"
                required
              />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 ml-1">I am a:</label>
                <select
                  id="reg-role"
                  value={role}
                  onChange={(e) => { setRole(e.target.value); removeFile(); setError(""); }}
                  className="w-full p-3 border rounded-lg bg-white"
                >
                  <option value="trekker">Trekker</option>
                  <option value="guide">Tour Guide</option>
                </select>
              </div>

              {/* ==================== GUIDE CREDENTIALS UPLOAD ==================== */}
              {role === "guide" && (
                <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        Guide ID / Accreditation Certificate <span className="text-red-500">*</span>
                      </p>
                      <p className="text-[10px] text-amber-700 leading-tight">
                        Required for Tour Guide registration. Upload your DENR/LGU accreditation, government-issued guide ID, or any certificate proving you are a licensed tour guide.
                      </p>
                    </div>
                  </div>

                  {/* Upload area */}
                  {!guideIdFile ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-white hover:bg-amber-50 transition cursor-pointer"
                    >
                      <Upload size={24} className="text-amber-500" />
                      <span className="text-xs font-semibold text-amber-700">
                        Click to upload ID / Certificate
                      </span>
                      <span className="text-[10px] text-gray-400">
                        JPG, PNG, WEBP or PDF · Max 5MB
                      </span>
                    </button>
                  ) : (
                    <div className="bg-white rounded-xl border border-amber-200 p-3 relative">
                      <button
                        type="button"
                        onClick={removeFile}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition"
                        title="Remove file"
                      >
                        <X size={16} />
                      </button>

                      {guideIdPreview ? (
                        <img
                          src={guideIdPreview}
                          alt="Preview"
                          className="w-full max-h-36 object-contain rounded-lg mb-2 border border-gray-100"
                        />
                      ) : (
                        <div className="flex items-center gap-2 mb-2">
                          <FileCheck size={28} className="text-amber-500" />
                          <span className="text-xs font-semibold text-gray-700 truncate max-w-[220px]">
                            {guideIdFile.name}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <FileCheck size={14} className="text-green-600" />
                        <span className="text-[11px] text-green-700 font-semibold">
                          {guideIdFile.name} ({(guideIdFile.size / 1024).toFixed(1)} KB) — Ready to upload
                        </span>
                      </div>

                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    id="guide-id-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}
            </>
          )}

          <input
            id="login-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-lg"
            required
          />

          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded-lg pr-12"
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-500"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {isRegister && (
            <div className="relative">
              <input
                id="reg-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password *"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 border rounded-lg pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-gray-500"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          {!isRegister && (
            <div className="text-right text-sm">
              <Link to="/forgot-password" className="text-green-600 hover:underline">
                Forgot password?
              </Link>
            </div>
          )}

          {/* Interactive Agreement Checkbox Card */}
          <div
            id="terms-agreement-card"
            onClick={() => {
              setAgreedToTerms(!agreedToTerms);
              if (!agreedToTerms) setError("");
            }}
            role="button"
            tabIndex={0}
            className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
              agreedToTerms
                ? "bg-emerald-50/90 border-emerald-500 shadow-xs text-emerald-950"
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
            }`}
          >
            <div
              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                agreedToTerms
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                  : "bg-white border-slate-300"
              }`}
            >
              {agreedToTerms && <Check size={12} className="stroke-[3]" />}
            </div>
            <div className="text-xs leading-snug">
              <span className={agreedToTerms ? "font-bold text-emerald-900" : "font-medium text-slate-700"}>
                {agreedToTerms ? "I have agreed to the " : "I agree to the "}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPolicyModalType("terms");
                }}
                className="text-green-700 font-bold hover:underline inline"
              >
                Terms and Conditions
              </button>
              <span className={agreedToTerms ? "font-bold text-emerald-900" : "font-medium text-slate-700"}>
                {" "}and{" "}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPolicyModalType("privacy");
                }}
                className="text-green-700 font-bold hover:underline inline"
              >
                Privacy Policy
              </button>
              <span className="text-red-500 font-bold"> *</span>
            </div>
          </div>

          <button
            id="submit-btn"
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-xs transition"
          >
            {loading && <Loader2 className="animate-spin" size={18} />}
            {loading
              ? isRegister && role === "guide" && guideIdFile
                ? "Uploading & Creating Account..."
                : "Processing..."
              : isRegister
              ? "Create Account"
              : "Login"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setIsRegister(false); removeFile(); setError(""); }}
                className="text-green-600 font-semibold"
              >
                Login
              </button>
            </>
          ) : (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => { setIsRegister(true); setError(""); }}
                className="text-green-600 font-semibold"
              >
                Sign Up
              </button>
            </>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-gray-400 text-sm hover:text-gray-600">
            Back to Home
          </Link>
        </div>
      </div>

      {/* Terms & Privacy Policy Modal */}
      {policyModalType && (
        <Dialog open={!!policyModalType} onOpenChange={() => setPolicyModalType(null)}>
          <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white rounded-2xl shadow-2xl">
            {/* Header with Switcher Tabs */}
            <div className="bg-slate-900 text-white p-5">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  TAKAZZ • DENR NNNP Protected Area Policy
                </span>
              </div>
              <DialogHeader className="text-left space-y-1">
                <DialogTitle className="text-xl font-bold text-white">
                  {policyModalType === "terms" ? "Terms & Conditions" : "Privacy Policy"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300">
                  {policyModalType === "terms"
                    ? "Guidelines, safety regulations, and environmental conservation rules."
                    : "How we protect your personal information under Republic Act No. 10173."}
                </DialogDescription>
              </DialogHeader>

              {/* Subtab Switcher */}
              <div className="flex gap-2 mt-4 bg-slate-800/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPolicyModalType("terms")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    policyModalType === "terms"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Terms & Conditions
                </button>
                <button
                  type="button"
                  onClick={() => setPolicyModalType("privacy")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    policyModalType === "privacy"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Privacy Policy
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed max-h-[50vh]">
              {policyModalType === "terms" ? (
                <>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-medium">
                    ⚠️ By registering an account or logging in to TAKAZZ, you enter into a binding agreement to adhere to all Northern Negros Natural Park (NNNP) laws and DENR Administrative Orders.
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm">1. Protected Area & "Leave No Trace"</h4>
                    <p>
                      Northern Negros Natural Park is a declared protected watershed and habitat. Trekkers must practice strict Zero-Waste principles: pack it in, pack it out. Littering, vandalism of natural structures, picking of orchids/flora, and disturbing wildlife are strictly punishable by law.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm">2. Mandatory Tour Guide Ratio</h4>
                    <p>
                      Under Protected Area Management Board (PAMB) guidelines, a mandatory ratio of <strong>1 accredited tour guide for every 5 trekkers (1:5)</strong> must be strictly followed. Trekkers are not allowed to venture onto trails without an assigned, verified guide.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm">3. Bookings, Permits & Fee Settlement</h4>
                    <p>
                      An online booking submission is a reservation request. Permits are only valid once approved and settled with the official fee payments at the designated DENR NNNP Outpost or PENRO Office. Quotas are strictly enforced according to trail capacity limits.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm">4. Medical Fitness & Assumption of Risk</h4>
                    <p>
                      High-altitude trekking carries inherent hazards. Every participant must ensure physical readiness and provide a genuine Medical Certificate (Fit to Climb). Trekkers climb under their own assumption of risk and execute a signed liability waiver.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm">5. Account Authenticity & Responsible Use</h4>
                    <p>
                      Users agree to provide accurate, genuine personal identification. Fraudulent document uploads or creation of duplicate accounts may result in permanent blacklisting from all protected areas.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-medium">
                    🔒 TAKAZZ and the DENR NNNP Protected Area Management Office are committed to protecting your personal information under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm">1. What Information We Collect</h4>
                    <p>
                      We collect personal details necessary to safeguard mountain climbers: Full Name, Contact Number, Email Address, Residential Address, Government-Issued ID, Signed Waiver Form, Emergency Contact details, and Medical Certificate.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm">2. Purpose of Data Collection</h4>
                    <p>
                      Your information is collected solely for:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 pl-2 text-slate-600">
                      <li>Verifying hiker identity and tourist legitimacy</li>
                      <li>Issuing entry permits and calculating carrying capacities</li>
                      <li>Assigning accredited tour guides to your group</li>
                      <li>Search and Rescue (SAR) and medical emergency operations</li>
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm">3. Security & Non-Disclosure</h4>
                    <p>
                      Your data is stored securely using industry-standard encryption. We never sell, monetize, or disclose your personal information to third-party commercial marketers. Access is restricted exclusively to authorized DENR NNNP Park Superintendents, Rangers, and assigned medical teams.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm">4. Your Data Subject Rights</h4>
                    <p>
                      Under R.A. 10173, you have the right to access, review, modify, or request deletion of your account and personal records once all active bookings and legal reporting requirements have concluded.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 border-t p-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPolicyModalType(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  setAgreedToTerms(true);
                  setError("");
                  setPolicyModalType(null);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                I Agree & Accept
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
