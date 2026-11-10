import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Loader2,
  Upload,
  FileCheck,
  X,
  ShieldCheck,
  Shield,
  FileText,
  CheckCircle2,
  Check,
  Mail,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";

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

  // OTP Verification state for post-registration & login
  const [isOtpVerification, setIsOtpVerification] = useState(false);
  const [isLoginOtp, setIsLoginOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  // Cached registration data for completing setup after OTP
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingRole, setPendingRole] = useState("trekker");
  const [pendingFullName, setPendingFullName] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [pendingAddress, setPendingAddress] = useState("");
  const [pendingGuideIdUrl, setPendingGuideIdUrl] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Terms and Conditions & Privacy Policy state
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [policyModalType, setPolicyModalType] = useState<"terms" | "privacy" | null>(null);

  // Guide credential upload states
  const [guideIdFile, setGuideIdFile] = useState<File | null>(null);
  const [guideIdPreview, setGuideIdPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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

        // Save pending details for OTP verification
        const targetEmail = email.trim();
        setPendingEmail(targetEmail);
        setPendingPassword(password);
        setPendingRole(role);
        setPendingFullName(fullName.trim());
        setPendingPhone(phone.trim());
        setPendingAddress(address.trim());
        setPendingGuideIdUrl(guideIdUrl);
        setPendingUserId(userId || null);

        // If email confirmation is disabled and session already exists, proceed immediately
        if (signUpData.session) {
          toast.success("Account created successfully!");
          if (role === "guide") {
            navigate("/guide-dashboard");
          } else {
            navigate("/");
          }
          return;
        }

        // Send 6-digit OTP code to email
        const { error: otpErr } = await supabase.auth.signInWithOtp({
          email: targetEmail,
        });
        if (otpErr) {
          // If signInWithOtp throws, try resend fallback
          const { error: resendErr } = await supabase.auth.resend({
            type: "signup",
            email: targetEmail,
          });
          if (resendErr) {
            console.warn("Could not send initial signup OTP:", resendErr);
          }
        }

        // Switch to OTP verification view for registration
        setIsOtpVerification(true);
        setIsLoginOtp(false);
        setOtp("");
        setResendCooldown(60);
        setError("");
        setSuccess(`A 6-digit OTP has been sent to ${targetEmail}. Please check your email inbox and enter the code below to complete registration.`);
      } else {
        const targetEmail = email.trim();

        // 1. Validate email and password credentials
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });

        if (signInErr) {
          // If email not confirmed, still allow OTP flow to proceed
          if (!signInErr.message?.toLowerCase().includes("email not confirmed")) {
            throw signInErr;
          }
          // For unconfirmed accounts, fall through to OTP verification below
        }

        // 2. Sign out temporary session so user must enter OTP to finalize login
        try {
          await supabase.auth.signOut();
        } catch {}

        // 3. Send 6-digit OTP code to email
        const { error: otpErr } = await supabase.auth.signInWithOtp({
          email: targetEmail,
        });
        if (otpErr) {
          throw new Error("Failed to send OTP to email: " + otpErr.message);
        }

        // 4. Switch to OTP view
        setPendingEmail(targetEmail);
        setPendingPassword(password);
        setIsOtpVerification(true);
        setIsLoginOtp(true);
        setOtp("");
        setResendCooldown(60);
        setError("");
        setSuccess(`Login credentials verified! A 6-digit OTP has been sent to ${targetEmail}. Please check your inbox and enter it below to complete sign-in.`);
        return;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.trim().length < 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const cleanToken = otp.trim();
      const targetEmail = (pendingEmail || email).trim();
      const targetPhone = pendingPhone.trim();

      // Verify OTP (try email first, with type fallback)
      let verifyRes;
      if (isLoginOtp) {
        verifyRes = await supabase.auth.verifyOtp({
          email: targetEmail,
          token: cleanToken,
          type: "email",
        });
        if (verifyRes.error) {
          const fallback = await supabase.auth.verifyOtp({
            email: targetEmail,
            token: cleanToken,
            type: "signup",
          });
          if (!fallback.error) verifyRes = fallback;
        }
      } else {
        verifyRes = await supabase.auth.verifyOtp({
          email: targetEmail,
          token: cleanToken,
          type: "signup",
        });
        if (verifyRes.error) {
          const fallback = await supabase.auth.verifyOtp({
            email: targetEmail,
            token: cleanToken,
            type: "email",
          });
          if (!fallback.error) verifyRes = fallback;
        }
      }

      // If phone OTP was used as fallback
      if (verifyRes.error && targetPhone) {
        const phoneFallback = await supabase.auth.verifyOtp({
          phone: targetPhone,
          token: cleanToken,
          type: "sms",
        });
        if (!phoneFallback.error) verifyRes = phoneFallback;
      }

      // If OTP verification failed, throw the error directly
      if (verifyRes.error) {
        throw verifyRes.error;
      }

      const verifiedUser = verifyRes.data?.user;

      // Handle Login OTP flow
      if (isLoginOtp) {
        toast.success("Welcome back! Login verified.");
        setIsOtpVerification(false);
        setIsLoginOtp(false);
        setPassword("");
        setPendingPassword("");

        const currentUserId = verifiedUser?.id;
        if (currentUserId) {
          try {
            const { data: prof } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", currentUserId)
              .maybeSingle();

            if (prof?.role === "admin") {
              navigate("/admin");
              return;
            } else if (prof?.role === "guide") {
              navigate("/guide-dashboard");
              return;
            }
          } catch {}
        }
        navigate("/");
        return;
      }

      // Handle Registration flow
      const finalUserId = verifiedUser?.id || pendingUserId;

      // Post-verification for Tour Guides: update profile and alert admin
      if (pendingRole === "guide" && finalUserId) {
        try {
          await supabase
            .from("profiles")
            .update({
              address: pendingAddress.trim(),
              phone: pendingPhone.trim(),
              email: targetEmail,
              guide_id_url: pendingGuideIdUrl,
              guide_application_status: "pending",
              is_available: false,
            } as any)
            .eq("id", finalUserId);
        } catch (profErr) {
          console.warn("Direct profile update skipped:", profErr);
        }

        try {
          const { data: admins } = await supabase
            .from("profiles")
            .select("id")
            .eq("role", "admin");

          if (admins && admins.length > 0) {
            const notifications = admins.map((admin) => ({
              user_id: admin.id,
              title: "New Tour Guide Application",
              message: `${pendingFullName || "A new applicant"} has submitted credentials for Tour Guide accreditation and is waiting for your review.`,
              type: "guide_application_submitted",
              link: "/admin?tab=guides",
              entity_id: finalUserId,
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

      toast.success("Registration complete! Welcome to TAKAZZ.");

      // Clear state
      setIsOtpVerification(false);
      setIsLoginOtp(false);
      setFullName("");
      setPhone("");
      setAddress("");
      setPassword("");
      setConfirmPassword("");
      setPendingPassword("");
      removeFile();

      // Smart redirect based on role
      if (pendingRole === "guide") {
        navigate("/guide-dashboard");
      } else {
        navigate("/");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid or expired OTP.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const targetEmail = (pendingEmail || email).trim();
    if (!targetEmail || resendCooldown > 0 || resending) return;

    setResending(true);
    setError("");

    try {
      if (isLoginOtp) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: targetEmail,
        });
        if (otpError) throw otpError;
      } else {
        const { error: resendError } = await supabase.auth.resend({
          type: "signup",
          email: targetEmail,
        });
        if (resendError) {
          const { error: fallbackErr } = await supabase.auth.signInWithOtp({
            email: targetEmail,
          });
          if (fallbackErr) throw resendError;
        }
      }

      toast.success(`A new 6-digit OTP has been sent to ${targetEmail}.`);
      setResendCooldown(60);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resend OTP.";
      setError(message);
    } finally {
      setResending(false);
    }
  };

  const handleDirectActivate = async (targetEmail: string) => {
    if (!targetEmail) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Send OTP to the email and switch to OTP view for verification
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: targetEmail,
      });
      if (otpErr) throw otpErr;

      setIsLoginOtp(true);
      setOtp("");
      setResendCooldown(60);
      setSuccess(`A 6-digit OTP has been sent to ${targetEmail}. Enter it to verify and log in.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send OTP.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 px-4 py-8">
      <div className="bg-white/95 backdrop-blur p-8 rounded-2xl w-full max-w-md shadow-2xl">
        {isOtpVerification ? (
          <div>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">
                {isLoginOtp ? "Login OTP Verification" : "Registration OTP Verification"}
              </h2>
              <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
                {isLoginOtp
                  ? "Enter the 6-digit OTP sent to your email to complete login:"
                  : "Enter the 6-digit One-Time Password (OTP) sent to your email:"}
              </p>
              <p className="font-bold text-gray-800 text-sm mt-0.5 break-all">
                {pendingEmail || email}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg mb-4 text-xs font-medium">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-lg mb-4 text-xs font-medium">
                {success}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="flex justify-center my-3">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={(val) => {
                    setOtp(val);
                    if (error) setError("");
                  }}
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} className="w-11 h-12 text-lg font-bold border-2 rounded-xl text-center bg-white" />
                    <InputOTPSlot index={1} className="w-11 h-12 text-lg font-bold border-2 rounded-xl text-center bg-white" />
                    <InputOTPSlot index={2} className="w-11 h-12 text-lg font-bold border-2 rounded-xl text-center bg-white" />
                    <InputOTPSlot index={3} className="w-11 h-12 text-lg font-bold border-2 rounded-xl text-center bg-white" />
                    <InputOTPSlot index={4} className="w-11 h-12 text-lg font-bold border-2 rounded-xl text-center bg-white" />
                    <InputOTPSlot index={5} className="w-11 h-12 text-lg font-bold border-2 rounded-xl text-center bg-white" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {loading && <Loader2 className="animate-spin" size={18} />}
                {loading
                  ? "Verifying OTP..."
                  : isLoginOtp
                  ? "Verify OTP & Log In"
                  : "Verify OTP & Complete Registration"}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-gray-500 space-y-3">
              <div>
                Didn't receive the OTP?{" "}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || resending}
                  className="text-emerald-700 font-bold hover:underline disabled:text-gray-400 disabled:no-underline cursor-pointer"
                >
                  {resending ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                </button>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-[11px] text-gray-500 mb-2">Wrong email or not receiving?</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOtpVerification(false);
                    setIsLoginOtp(false);
                    setOtp("");
                    setError("");
                    setSuccess("");
                  }}
                  disabled={loading}
                  className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <ArrowLeft size={15} className="text-emerald-700" />
                  Back to Login
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOtpVerification(false);
                    setOtp("");
                    setError("");
                    setSuccess("");
                  }}
                  className="text-gray-500 hover:text-gray-800 transition inline-flex items-center gap-1 font-medium cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-gray-800">
              {isRegister ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-gray-500 mb-6 text-sm">
              {isRegister
                ? "Start your trekking journey today"
                : "Login to your account"}
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-xs font-medium space-y-2.5">
                <p>{error}</p>
                {error.toLowerCase().includes("email not confirmed") && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={async () => {
                      const targetEmail = (pendingEmail || email).trim();
                      if (!targetEmail) {
                        setError("Please enter your email address first.");
                        return;
                      }
                      setLoading(true);
                      setError("");
                      try {
                        const { error: otpErr } = await supabase.auth.signInWithOtp({ email: targetEmail });
                        if (otpErr) throw otpErr;
                        setPendingEmail(targetEmail);
                        setIsOtpVerification(true);
                        setIsLoginOtp(true);
                        setOtp("");
                        setResendCooldown(60);
                        setSuccess(`A 6-digit OTP has been sent to ${targetEmail}. Please check your inbox or spam folder.`);
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : "Failed to send OTP";
                        setError(msg);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <Mail size={14} />}
                    Send 6-digit OTP to Verify & Sign In
                  </button>
                )}
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-4 text-sm">
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
                        <FileCheck size={14} className="text-emerald-600" />
                        <span className="text-[11px] text-emerald-700 font-semibold">
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
              <Link to="/forgot-password" className="text-emerald-600 hover:underline">
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
                className="text-emerald-700 font-bold hover:underline inline"
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
                className="text-emerald-700 font-bold hover:underline inline"
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
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
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
                onClick={() => {
                  setIsRegister(false);
                  setIsOtpVerification(false);
                  removeFile();
                  setError("");
                  setSuccess("");
                }}
                className="text-emerald-600 font-semibold cursor-pointer"
              >
                Login
              </button>
            </>
          ) : (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => {
                  setIsRegister(true);
                  setIsOtpVerification(false);
                  setError("");
                  setSuccess("");
                }}
                className="text-emerald-600 font-semibold cursor-pointer"
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
      </>
    )}
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
                    By registering an account or logging in to TAKAZZ, you enter into a binding agreement to adhere to all Northern Negros Natural Park (NNNP) laws and DENR Administrative Orders.
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
                    TAKAZZ and the DENR NNNP Protected Area Management Office are committed to protecting your personal information under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
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
