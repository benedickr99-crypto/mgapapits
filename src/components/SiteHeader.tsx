import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Menu,
  X,
  User,
  Calendar,
  LogOut,
  Shield,
  MapPin,
  Bell,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";

export default function SiteHeader() {
  const { user, profile, signOut, role, isAdmin, isGuide } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Trails", path: "/trails" },
    { name: "Maps & Directions", path: "/navigation" },
    { name: "Advisories", path: "/announcements" },
    { name: "Process", path: "/process" },
    { name: "FAQ", path: "/faq" },
  ];

  const displayName =
    profile?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string)?.trim() ||
    user?.email?.split("@")[0] ||
    "User";

  const rawInitialsSource =
    profile?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string)?.trim();

  const initials = rawInitialsSource
    ? rawInitialsSource
        .split(/\s+/)
        .map((n: string) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "U";

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on ESC
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMobile(false);
      }
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);

  // Auto-close menus on route change
  useEffect(() => {
    setMobile(false);
    setOpen(false);
  }, [location.pathname]);

  const logout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="sticky top-0 z-50">
      <AnnouncementsBanner />
      <header className="backdrop-blur-xl bg-white/90 border-b border-gray-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">

        {/* LEFT SIDE: Hamburger + Logo */}
        <div className="flex items-center gap-2 shrink-0">
          {/* MOBILE BUTTON */}
          <button
            className="md:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-700 transition-colors flex items-center justify-center focus:outline-none"
            onClick={() => setMobile(!mobile)}
            aria-label="Toggle navigation menu"
          >
            {mobile ? <X size={22} className="stroke-[2.2]" /> : <Menu size={22} className="stroke-[2.2]" />}
          </button>

          {/* LOGO */}
          <Link
            to="/"
            onClick={() => setMobile(false)}
            className="flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight text-green-700 hover:opacity-90 transition-opacity"
          >
            <img
              src="/takazz-logo.png"
              alt="TAKAZZ Logo"
              className="w-9 h-9 object-contain"
            />
            <span className="font-extrabold tracking-tight">TAKAZZ</span>
          </Link>
        </div>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-1.5 bg-gray-50/80 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-gray-200/60 shadow-xs">
          {navLinks.map((link) => {
            const active = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${active
                    ? "bg-green-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80"
                  }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          {/* USER ACTIONS */}
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-3">
              <NotificationBell />

              <div className="relative ml-0.5 sm:ml-1" ref={dropdownRef}>
                <button
                  onClick={() => setOpen(!open)}
                  className="flex items-center gap-2 bg-white/90 backdrop-blur px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full shadow-xs border border-gray-200/70 hover:shadow-md transition cursor-pointer"
                >
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-green-600 text-white flex items-center justify-center text-xs sm:text-sm font-bold shadow-xs">
                    {initials}
                  </div>

                  <div className="hidden sm:flex flex-col text-left max-w-[140px]">
                    <span className="text-xs font-bold text-gray-800 leading-none truncate">
                      {displayName}
                    </span>
                    {role && (
                      <span className={`text-[10px] mt-1 font-semibold px-1.5 py-0.5 rounded w-max leading-none ${isAdmin ? 'bg-red-100 text-red-700' :
                          isGuide ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                        }`}>
                        {isAdmin ? 'Admin' : (isGuide ? 'Tour Guide' : (role === 'user' ? 'User' : 'Trekker'))}
                      </span>
                    )}
                  </div>

                  <ChevronDown size={15} className="text-gray-500" />
                </button>

                {/* DROPDOWN */}
                <div
                  className={`absolute right-0 mt-3 w-56 transition-all duration-200 z-50 ${open
                      ? "opacity-100 scale-100 translate-y-0"
                      : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                    }`}
                >
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-2">
                    <div className="px-3 py-2 border-b border-gray-100 mb-1">
                      <p className="text-xs font-bold text-gray-900 truncate">{displayName}</p>
                      <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
                    </div>

                    {isAdmin && (
                      <>
                        <Link
                          to="/admin"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 font-medium text-sm transition"
                        >
                          <Shield size={16} /> Admin Panel
                        </Link>
                        <div className="my-1 border-t" />
                      </>
                    )}

                    {isGuide && (
                      <>
                        <Link
                          to="/guide"
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-amber-50 text-amber-600 font-medium text-sm transition"
                        >
                          <Shield size={16} /> Guide Dashboard
                        </Link>
                        <div className="my-1 border-t" />
                      </>
                    )}

                    <Link
                      to="/my-bookings"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100 text-sm transition"
                    >
                      <Calendar size={16} /> My Bookings
                    </Link>

                    <Link
                      to="/profile"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100 text-sm transition"
                    >
                      <User size={16} /> Profile
                    </Link>

                    <div className="my-1 border-t" />

                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 text-sm transition"
                    >
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 shadow-xs transition"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {/* MOBILE MENU */}
      <div
        className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden ${
          mobile ? "max-h-[85vh] opacity-100 border-b border-gray-200 shadow-xl" : "max-h-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="px-4 py-3 space-y-1 bg-white/95 backdrop-blur-xl max-h-[calc(85vh-4rem)] overflow-y-auto">
          {navLinks.map((link) => {
            const active = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobile(false)}
                className={`flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? "bg-green-600 text-white shadow-xs"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {link.name}
              </Link>
            );
          })}

          {user && isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMobile(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-red-600 font-bold hover:bg-red-50 text-sm transition-colors"
            >
              <Shield size={16} /> Admin Panel
            </Link>
          )}

          {user && isGuide && (
            <Link
              to="/guide"
              onClick={() => setMobile(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-amber-600 font-bold hover:bg-amber-50 text-sm transition-colors"
            >
              <Shield size={16} /> Guide Dashboard
            </Link>
          )}

        </div>
      </div>
    </header>
  </div>
  );
}