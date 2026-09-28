import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Upload, FileCheck, X, ShieldCheck } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("trekker");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const uploadGuideId = async (userId: string): Promise<string | null> => {
    if (!guideIdFile) return null;

    const ext = guideIdFile.name.split(".").pop();
    const path = `guide-credentials/${userId}/id-certificate.${ext}`;

    setUploadProgress(30);

    const { error: uploadError } = await supabase.storage
      .from("guide-documents")
      .upload(path, guideIdFile, { upsert: true, contentType: guideIdFile.type });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // Try fallback bucket name
      const { error: fallbackError } = await supabase.storage
        .from("avatars")
        .upload(path, guideIdFile, { upsert: true, contentType: guideIdFile.type });

      if (fallbackError) {
        console.error("Fallback upload error:", fallbackError);
        return null;
      }

      setUploadProgress(80);
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setUploadProgress(100);
      return data?.publicUrl || null;
    }

    setUploadProgress(80);
    const { data } = supabase.storage.from("guide-documents").getPublicUrl(path);
    setUploadProgress(100);
    return data?.publicUrl || null;
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

    if (isRegister && role === "guide" && !guideIdFile) {
      return setError(
        "Please upload your Guide ID or accreditation certificate. This is required for Tour Guide registration."
      );
    }

    setLoading(true);

    try {
      if (isRegister) {
        // Step 1: Create the auth account
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone,
              role,
              guide_application_status: role === "guide" ? "pending" : "none",
            },
          },
        });

        if (signUpError) throw signUpError;

        const userId = signUpData?.user?.id;

        // Step 2: Upload guide ID/certificate if applicable
        let guideIdUrl: string | null = null;
        if (role === "guide" && guideIdFile && userId) {
          guideIdUrl = await uploadGuideId(userId);
        }

        // Step 3: Update the profile with guide_id_url & pending status (wait a moment for trigger to create profile)
        if (role === "guide" && userId) {
          await new Promise((r) => setTimeout(r, 1500));
          await supabase
            .from("profiles")
            .update({
              guide_id_url: guideIdUrl,
              guide_application_status: "pending",
              is_available: false,
            } as any)
            .eq("id", userId);

          // Notify admins that a new guide applicant has registered
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
              await supabase.from("notifications").insert(notifications);
            }
          } catch (notifErr) {
            console.warn("Could not notify admin about new guide applicant:", notifErr);
          }
        }

        setSuccess(
          role === "guide"
            ? "✅ Tour Guide account created! Your application (with ID/Certificate) is pending review by the Park Administrator."
            : "✅ Account created! Check your email to verify your address."
        );
        setIsRegister(false);
        removeFile();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

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
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 border rounded-lg"
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

          {!isRegister && (
            <div className="text-right text-sm">
              <Link to="/forgot-password" className="text-green-600 hover:underline">
                Forgot password?
              </Link>
            </div>
          )}

          <button
            id="submit-btn"
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
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
    </div>
  );
}
