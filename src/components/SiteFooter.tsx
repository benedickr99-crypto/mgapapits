import { Link } from "react-router-dom";
import { Mail, MapPin } from "lucide-react";

const SiteFooter = () => {
  return (
    <footer className="bg-black text-white border-t border-white/10">
      
      <div className="max-w-7xl mx-auto px-6 py-12 grid gap-10 md:grid-cols-3">

        {/* BRAND */}
        <div>
          <div className="flex items-center gap-2.5 text-lg font-semibold text-white">
            <img
              src="/takazz-logo.png"
              alt="TAKAZZ Logo"
              className="w-8 h-8 object-contain rounded-full bg-white p-0.5"
            />
            TAKAZZ
          </div>

          <p className="mt-4 text-sm text-white/70 max-w-sm">
            Official online booking for TAKAZZ.
            Promoting safe, sustainable, and responsible trekking.
          </p>
        </div>

        {/* QUICK LINKS */}
        <div>
          <h3 className="font-semibold mb-4">Quick Links</h3>

          <div className="flex flex-col gap-2 text-sm text-white/70">
            <Link to="/" className="hover:text-yellow-400 transition">
              Home
            </Link>
            <Link to="/trails" className="hover:text-yellow-400 transition">
              Trails
            </Link>
            <Link to="/process" className="hover:text-yellow-400 transition">
              Process
            </Link>
            <Link to="/booking" className="hover:text-yellow-400 transition">
              Book
            </Link>
          </div>
        </div>

        {/* CONTACT */}
        <div>
          <h3 className="font-semibold mb-4">Contact</h3>

          <div className="space-y-2 text-sm text-white/70">
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              <span>DENR – PENRO Negros Occidental</span>
            </div>

            <div className="flex items-center gap-2">
              <Mail size={16} />
              <span>penro.negros@denr.gov.ph</span>
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM BAR */}
      <div className="border-t border-white/10 text-center text-sm text-white/50 py-4">
        © {new Date().getFullYear()} TAKAZZ. All rights reserved.
      </div>

    </footer>
  );
};

export default SiteFooter;