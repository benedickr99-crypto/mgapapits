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
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);

  const logout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="sticky top-0 z-50">
      <AnnouncementsBanner />
      <header className="backdrop-blur-xl bg-white/80 border-b border-white/20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* LEFT SIDE: Hamburger + Logo */}
        <div className="flex items-center gap-1 md:gap-0">
          {/* MOBILE BUTTON */}
          <button
            className="md:hidden p-2 -ml-2 mr-1 rounded-lg hover:bg-gray-100 text-gray-700"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* LOGO */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-green-700 hover:opacity-90 transition-opacity"
          >
            <img
              src="/takazz-logo.png"
              alt="TAKAZZ Logo"
              className="w-10 h-10 object-contain"
            />
            <span>TAKAZZ</span>
          </Link>
        </div>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-2 bg-white/60 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-white/20">
          {navLinks.map((link) => {
            const active = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${active
                    ? "bg-green-600 text-white shadow"
                    : "text-gray-600 hover:bg-gray-100"
                  }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3">

          {/* USER ACTIONS */}
          {user ? (
            <div className="flex items-center gap-1 md:gap-3">
              <NotificationBell />

              <div className="relative ml-1" ref={dropdownRef}>
                <button
                  onClick={() => setOpen(!open)}
                  className="flex items-center gap-2 bg-white/70 backdrop-blur px-3 py-2 rounded-full shadow-sm border border-white/20 hover:shadow-md transition"
                >
                  <div className="h-8 w-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">
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

                  <ChevronDown size={16} />
                </button>

                {/* DROPDOWN */}
                <div
                  className={`absolute right-0 mt-3 w-56 transition-all duration-200 ${open
                      ? "opacity-100 scale-100 translate-y-0"
                      : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                    }`}
                >
                  <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-2">
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
              className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-700 shadow-sm"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {/* MOBILE MENU */}
      <div
        className={`md:hidden transition-all duration-300 overflow-hidden ${mobile ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
          }`}
      >
        <div className="px-4 pb-4 space-y-2 bg-white/80 backdrop-blur border-t">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobile(false)}
              className="block px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 text-sm"
            >
              {link.name}
            </Link>
          ))}
          {user && isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMobile(false)}
              className="block px-3 py-2 rounded-lg text-red-600 font-medium hover:bg-red-50 text-sm"
            >
              Admin Panel
            </Link>
          )}
          {user && isGuide && (
            <Link
              to="/guide"
              onClick={() => setMobile(false)}
              className="block px-3 py-2 rounded-lg text-amber-600 font-medium hover:bg-amber-50 text-sm"
            >
              Guide Dashboard
            </Link>
          )}
        </div>
      </div>
    </header>
  </div>
  );
}