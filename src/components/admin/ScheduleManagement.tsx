import { useState, useMemo } from "react";
import { Calendar as CalendarIcon, Clock, Users, ShieldAlert, CheckCircle2, XCircle, Plus, Edit2 } from "lucide-react";
import { TIME_SLOTS, NNNP_TRAILS_METADATA } from "@/lib/trailData";
import { Button } from "@/components/ui/button";

interface ScheduleProps {
  bookings: any[];
  trails: any[];
}

export const ScheduleManagement = ({ bookings, trails }: ScheduleProps) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() + 86400000 * 14).toISOString().split("T")[0] // default 2 weeks ahead
  );
  const [customLimits, setCustomLimits] = useState<Record<string, number>>({});
  const [closedSlots, setClosedSlots] = useState<Set<string>>(new Set());

  const toggleSlotClosure = (slotKey: string) => {
    setClosedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slotKey)) {
        next.delete(slotKey);
      } else {
        next.add(slotKey);
      }
      return next;
    });
  };

  const setCapacityLimit = (slotKey: string, newLimit: number) => {
    setCustomLimits((prev) => ({
      ...prev,
      [slotKey]: Math.max(1, newLimit),
    }));
  };

  // Compute bookings for the chosen date
  const dateBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        (b.climb_date || b.trekking_date) === selectedDate &&
        b.status !== "cancelled" &&
        b.status !== "rejected"
    );
  }, [bookings, selectedDate]);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-emerald-700" />
            <h3 className="text-xl font-black text-slate-900">Trekking Schedule & Slot Management</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive carrying capacity control and staggered slot monitor for DENR rangers.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600">Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Date Summary */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="font-bold text-emerald-900">
            Selected Date: {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
          <p className="text-emerald-700 mt-0.5">
            Total active bookings on this date: <strong>{dateBookings.length}</strong> (
            {dateBookings.reduce((sum, b) => sum + (b.group_size || 1), 0)} trekkers)
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split("T")[0]);
            }}
            className="rounded-xl text-xs"
          >
            Previous Day
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split("T")[0]);
            }}
            className="rounded-xl text-xs"
          >
            Next Day
          </Button>
        </div>
      </div>

      {/* Trail Slots Grid */}
      <div className="space-y-6">
        {trails.map((trail) => {
          const metaKey = trail.name.toLowerCase().includes("mandalagan")
            ? "mt-mandalagan"
            : trail.name.toLowerCase().includes("silay")
            ? "mt-silay"
            : trail.name.toLowerCase().includes("marapara")
            ? "mt-marapara"
            : "kumalisikis";
          const meta = NNNP_TRAILS_METADATA[metaKey];

          // Bookings for this trail on this date
          const trailBookings = dateBookings.filter((b) => b.trail_id === trail.id);

          return (
            <div key={trail.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h4 className="text-base font-black text-slate-900">{trail.name}</h4>
                  <span className="text-xs text-slate-500">
                    Max capacity default: {meta?.maxCapacityPerSlot || 20} trekkers / slot
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full self-start sm:self-auto">
                  {trailBookings.reduce((sum, b) => sum + (b.group_size || 1), 0)} Trekkers Scheduled
                </span>
              </div>

              {/* Time Slots row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {TIME_SLOTS.map((slot) => {
                  const slotKey = `${trail.id}_${selectedDate}_${slot}`;
                  const isClosed = closedSlots.has(slotKey);
                  const maxCap = customLimits[slotKey] || meta?.maxCapacityPerSlot || 20;

                  // Find bookings in this slot
                  const slotBookings = trailBookings.filter(
                    (b) => !b.notes || b.notes.includes(slot)
                  );
                  const bookedCount = slotBookings.reduce((sum, b) => sum + (b.group_size || 1), 0);
                  const remaining = Math.max(0, maxCap - bookedCount);

                  return (
                    <div
                      key={slot}
                      className={`rounded-xl p-4 border transition-all ${
                        isClosed
                          ? "bg-gray-100 border-gray-300 opacity-70"
                          : remaining === 0
                          ? "bg-red-50 border-red-200"
                          : "bg-white border-slate-200 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-700" />
                          {slot.split(" - ")[0]}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isClosed
                              ? "bg-gray-200 text-gray-700"
                              : remaining === 0
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isClosed ? "Closed" : remaining === 0 ? "Full" : "Open"}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 mb-2">
                        <span>Booked: <strong>{bookedCount}</strong> / {maxCap}</span>
                        <span className="text-slate-400 block text-[11px]">
                          ({remaining} slots left)
                        </span>
                      </div>

                      {/* Progress */}
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full ${
                            isClosed ? "bg-gray-400" : remaining === 0 ? "bg-red-500" : "bg-emerald-600"
                          }`}
                          style={{ width: `${Math.min(100, (bookedCount / maxCap) * 100)}%` }}
                        />
                      </div>

                      {/* Admin Controls */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <button
                          onClick={() => toggleSlotClosure(slotKey)}
                          className={`font-bold hover:underline ${
                            isClosed ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {isClosed ? "Reopen Slot" : "Suspend Slot"}
                        </button>

                        <button
                          onClick={() => {
                            const val = prompt("Enter new max participant capacity for this slot:", String(maxCap));
                            if (val && !isNaN(Number(val))) {
                              setCapacityLimit(slotKey, Number(val));
                            }
                          }}
                          className="text-slate-600 hover:text-slate-900 font-semibold"
                        >
                          Edit Cap ({maxCap})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
