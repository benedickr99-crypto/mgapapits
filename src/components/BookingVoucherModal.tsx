import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Printer, MapPin, Calendar, Clock, Users, Compass, ExternalLink, ShieldCheck, Download } from "lucide-react";
import { getTrailMetadata } from "@/lib/trailData";
import { Link } from "react-router-dom";

interface BookingVoucherProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    referenceNumber: string;
    trailName: string;
    climbDate: string;
    timeSlot: string;
    groupSize: number;
    guideName?: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    participants?: Array<{ fullName: string; age?: number; contactNumber?: string }>;
  };
}

export const BookingVoucherModal = ({ isOpen, onClose, booking }: BookingVoucherProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const metadata = getTrailMetadata(booking.trailName);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-white">
        <div ref={printRef} className="p-6 md:p-8 space-y-6">
          {/* Header Badge */}
          <div className="text-center pb-4 border-b border-gray-100">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 rounded-full text-emerald-600 mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              Official Booking Confirmation Voucher
            </span>
            <h2 className="text-2xl font-bold text-gray-900 mt-2">
              Northern Negros Natural Park
            </h2>
            <p className="text-xs text-gray-500">
              Department of Environment and Natural Resources (DENR) - Region VI
            </p>
          </div>

          {/* Reference Card */}
          <div className="bg-gradient-to-r from-emerald-800 to-green-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div>
              <span className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">
                Booking Reference No.
              </span>
              <div className="text-2xl font-mono font-black tracking-widest text-emerald-100 mt-0.5">
                {booking.referenceNumber}
              </div>
              <p className="text-xs text-emerald-200/80 mt-1">
                Present this reference code upon arrival at the DENR outpost.
              </p>
            </div>
            <div className="text-right sm:border-l sm:border-emerald-700/60 sm:pl-4">
              <span className="text-xs text-emerald-200 uppercase tracking-wider font-semibold">Status</span>
              <div className="text-sm font-bold bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full border border-amber-400/30 inline-block mt-1">
                Pending Verification
              </div>
            </div>
          </div>

          {/* Booking Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2.5">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase">
                <Compass className="w-4 h-4 text-emerald-600" />
                Trail & Mountain
              </div>
              <div className="font-bold text-gray-900 text-base">{booking.trailName}</div>
              <div className="text-xs text-gray-600">
                {metadata.mountain} • Elevation: {metadata.elevation}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2.5">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Date & Schedule
              </div>
              <div className="font-bold text-gray-900 text-base">
                {new Date(booking.climbDate).toLocaleDateString("en-US", {
                  weekday: "short",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div className="text-xs text-gray-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" /> {booking.timeSlot}
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2.5">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase">
                <Users className="w-4 h-4 text-emerald-600" />
                Group & Guide
              </div>
              <div className="font-bold text-gray-900">
                {booking.groupSize} {booking.groupSize > 1 ? "Trekkers" : "Trekker"}
              </div>
              <div className="text-xs text-gray-600">
                Guide: <span className="font-semibold text-gray-800">{booking.guideName || "DENR Designated Guide"}</span>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2.5">
              <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Emergency Contact
              </div>
              <div className="font-bold text-gray-900">{booking.emergencyContactName}</div>
              <div className="text-xs text-gray-600">{booking.emergencyContactPhone}</div>
            </div>
          </div>

          {/* Meeting Point & Navigation Links */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1">
              <MapPin className="w-4 h-4 text-emerald-700" />
              Designated Trailhead Meeting Point
            </div>
            <p className="text-xs font-semibold text-gray-900">{metadata.meetingPoint.name}</p>
            <p className="text-xs text-gray-600 mt-0.5">{metadata.meetingPoint.address}</p>
            <p className="text-xs text-emerald-700 italic mt-1">{metadata.meetingPoint.landmark}</p>

            <div className="flex flex-wrap gap-2 mt-3">
              <a
                href={metadata.navigationUrls.googleMaps}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-100/60 transition shadow-xs"
              >
                Google Maps <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Participant Roster if available */}
          {booking.participants && booking.participants.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Registered Participant Roster ({booking.participants.length})
              </h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 text-xs">
                {booking.participants.map((p, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between bg-white">
                    <span className="font-semibold text-gray-800">
                      {idx + 1}. {p.fullName} {p.age ? `(${p.age} yrs)` : ""}
                    </span>
                    <span className="text-gray-500 font-mono text-[11px]">{p.contactNumber || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Important Rules */}
          <div className="border-t border-gray-200 pt-4 text-[11px] text-gray-500 space-y-1">
            <p className="font-semibold text-gray-700">Important Reminders:</p>
            <p>1. Arrive at least 30 minutes prior to your designated time slot for orientation.</p>
            <p>2. Bring valid government-issued ID matching this voucher.</p>
            <p>3. Strictly follow DENR "Leave No Trace" principles. No single-use plastics along the trail.</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handlePrint}
              variant="outline"
              className="flex-1 flex items-center justify-center gap-2 border-gray-300"
            >
              <Printer className="w-4 h-4" />
              Print / Save Voucher
            </Button>
            <Button
              asChild
              className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <Link to="/my-bookings">
                Go to My Bookings
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
