import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";

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

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
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

    setLoading(true);

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
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

        if (error) throw error;

        setSuccess(
          role === "guide"
            ? "Tour Guide account created! Your application is pending review and approval by the Park Administrator."
            : "Account created! Check your email to verify."
        );
        setIsRegister(false);
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
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-green-700 px-4">
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
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-2 rounded-lg mb-4 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3 border rounded-lg"
                required
              />

              <input
                type="tel"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-3 border rounded-lg"
              />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 ml-1">I am a:</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-white"
                >
                  <option value="trekker">Trekker</option>
                  <option value="guide">Tour Guide</option>
                </select>
              </div>
            </>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-lg"
            required
          />

          <div className="relative">
            <input
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
              <Link
                to="/forgot-password"
                className="text-green-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={18} />}
            {loading
              ? "Processing..."
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
                onClick={() => setIsRegister(false)}
                className="text-green-600 font-semibold"
              >
                Login
              </button>
            </>
          ) : (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => setIsRegister(true)}
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
