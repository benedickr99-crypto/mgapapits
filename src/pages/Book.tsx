import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import {
  UploadCloud, CheckCircle2, FileText, X, ArrowRight, ArrowLeft,
  MapPin, Mountain, Calendar, Clock, Users, ShieldAlert, Plus, Trash2,
  Compass, CheckCircle, AlertCircle, ExternalLink, Download, Eye,
  ChevronLeft, ChevronRight, ScanText, Sparkles, Loader2, Check, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { WeatherWidget } from "@/components/WeatherWidget";
import { BookingVoucherModal } from "@/components/BookingVoucherModal";
import { OcrInspectionModal } from "@/components/OcrInspectionModal";
import { runTesseractOcr, checkIdNameMatch, type OcrExtractedData } from "@/lib/ocrService";
import {
  NNNP_TRAILS_METADATA,
  getTrailMetadata,
  TIME_SLOTS
} from "@/lib/trailData";
import {
  checkSlotCapacity,
  fetchAvailableGuides,
  createOnlineBooking,
  type ParticipantInput
} from "@/lib/bookingService";
import { getCached, setCached } from "@/lib/cache";

type Trail = Tables<"trails">;

interface DocumentUploadFieldProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accept: string;
  downloadUrl?: string;
  downloadLabel?: string;
  onScanOcr?: () => void;
  statusVariant?: "default" | "success" | "error";
  statusMessage?: string;
}

function DocumentUploadField({
  label,
  file,
  onChange,
  accept,
  downloadUrl,
  downloadLabel,
  onScanOcr,
  statusVariant = "default",
  statusMessage,
}: DocumentUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onChange(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isError = statusVariant === "error";
  const isSuccess = statusVariant === "success";

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <label className="block text-sm font-semibold text-gray-700">
          {label}
        </label>
        {downloadUrl && (
          <a
            href={downloadUrl}
            download="DENR_NNNP_Trekking_Waiver.docx"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-bold hover:underline shrink-0"
            title="Download official form template"
          >
            <Download className="w-3 h-3" />
            {downloadLabel || "Download Template"}
          </a>
        )}
      </div>

      <div
        onClick={() => !file && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[120px] ${!file
            ? "border-gray-200 hover:border-emerald-500 hover:bg-gray-50 bg-white"
            : isError
              ? "border-red-500 bg-red-50/70 ring-2 ring-red-200 shadow-xs"
              : isSuccess
                ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200 shadow-xs"
                : "border-emerald-400 bg-emerald-50/50"
          }`}
      >
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          accept={accept}
          onChange={handleFileChange}
        />

        {file ? (
          <div className="flex flex-col items-center w-full">
            {isError ? (
              <AlertCircle className="h-8 w-8 text-red-500 mb-2 animate-bounce" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mb-2" />
            )}
            <span
              className={`text-sm font-semibold truncate w-full px-2 ${isError ? "text-red-900" : "text-emerald-800"
                }`}
              title={file.name}
            >
              {file.name}
            </span>
            <span
              className={`text-xs mt-1 ${isError ? "text-red-600 font-medium" : "text-emerald-600"
                }`}
            >
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>

            {isError && (
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 border border-red-200 text-red-700 text-[11px] font-bold">
                <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                <span>{statusMessage || "ID Mismatch • Must Be Visible"}</span>
              </div>
            )}
            {isSuccess && (
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-bold">
                <Check className="w-3 h-3 text-emerald-700 shrink-0" />
                <span>{statusMessage || "Name Matches ID ✓"}</span>
              </div>
            )}

            {onScanOcr && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onScanOcr();
                }}
                className={`mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 text-white rounded-lg text-[11px] font-bold shadow-xs transition ${isError
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-emerald-700 hover:bg-emerald-800"
                  }`}
              >
                <ScanText className={`w-3 h-3 ${isError ? "text-red-200" : "text-emerald-200"}`} />
                Tesseract OCR Scan
              </button>
            )}
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1 bg-white rounded-full text-gray-400 hover:text-red-500 shadow-sm transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-gray-500">
            <UploadCloud className="h-8 w-8 mb-2 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Click to upload document</span>
            <span className="text-xs text-gray-400 mt-1">PDF, JPG, PNG (Max 5MB)</span>
          </div>
        )}
      </div>
      {!file && (
        <span className="text-xs text-amber-600 mt-1 font-medium">* Required for DENR permit validation</span>
      )}
    </div>
  );
}

interface DocumentReviewCardProps {
  label: string;
  file: File | null;
  onPreview: (file: File, label: string) => void;
  onChangeFile?: (file: File | null) => void;
  onScanOcr?: () => void;
  accept?: string;
}

function DocumentReviewCard({
  label,
  file,
  onPreview,
  onChangeFile,
  onScanOcr,
  accept = ".pdf,.jpg,.jpeg,.png",
}: DocumentReviewCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const isImage = file?.type?.startsWith("image/");

  useEffect(() => {
    if (file && isImage) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setObjectUrl(null);
    }
  }, [file, isImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onChangeFile) {
      onChangeFile(e.target.files[0]);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 transition-all hover:border-emerald-300 hover:shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2.5 gap-2">
          <span className="text-xs font-bold text-gray-800 line-clamp-1">{label}</span>
          {file ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Attached
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <AlertCircle className="w-3 h-3 text-amber-500" /> Pending
            </span>
          )}
        </div>

        {file ? (
          <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-gray-200/80 mb-3 shadow-2xs">
            {isImage && objectUrl ? (
              <img
                src={objectUrl}
                alt={label}
                onClick={() => onPreview(file, label)}
                className="w-12 h-12 rounded-lg object-cover border border-emerald-200 shrink-0 cursor-pointer hover:opacity-80 transition"
                title="Click to zoom preview"
              />
            ) : (
              <div
                onClick={() => onPreview(file, label)}
                className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100 cursor-pointer hover:bg-emerald-100 transition"
                title="Click to review file"
              >
                <FileText className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-900 truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || "Document"}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-white rounded-xl text-center text-xs text-gray-400 mb-3 border border-dashed border-gray-200">
            No document attached
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
        {file && (
          <button
            type="button"
            onClick={() => onPreview(file, label)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition shadow-xs"
          >
            <Eye className="w-3.5 h-3.5" /> Review Document
          </button>
        )}
        {file && onScanOcr && (
          <button
            type="button"
            onClick={onScanOcr}
            className="inline-flex items-center justify-center gap-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs py-2 px-2.5 rounded-xl transition shadow-2xs"
            title="Scan with Tesseract OCR"
          >
            <ScanText className="w-3.5 h-3.5 text-emerald-600" /> OCR
          </button>
        )}
        {onChangeFile && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              accept={accept}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`text-xs font-semibold py-2 px-3 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 transition ${!file ? "w-full bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-white"}`}
            >
              {file ? "Change" : "Upload File"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Date Helper functions
const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDateKey = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface GoogleCalendarSelectorProps {
  isKumaliskisTrail: boolean;
  climbDate: string;
  descentDate?: string;
  onSelectDate: (dateStr: string) => void;
  onSelectDescentDate: (dateStr: string) => void;
  minAllowedDate: string;
  availableWeeks: { startDate: string; endDate: string; label: string; fullLabel: string }[];
}

function GoogleCalendarSelector({
  isKumaliskisTrail,
  climbDate,
  descentDate,
  onSelectDate,
  onSelectDescentDate,
  minAllowedDate,
  availableWeeks,
}: GoogleCalendarSelectorProps) {
  const [selectionMode, setSelectionMode] = useState<"climb" | "descent">("climb");

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    if (climbDate) {
      const parts = climbDate.split("-").map(Number);
      if (parts.length === 3) return new Date(parts[0], parts[1] - 1, 1);
    }
    const parts = minAllowedDate.split("-").map(Number);
    if (parts.length === 3) return new Date(parts[0], parts[1] - 1, 1);
    return new Date();
  });

  const [hoveredWeekStart, setHoveredWeekStart] = useState<string | null>(null);

  useEffect(() => {
    if (climbDate) {
      const parts = climbDate.split("-").map(Number);
      if (parts.length === 3) {
        setCurrentMonthDate(new Date(parts[0], parts[1] - 1, 1));
      }
    }
  }, [climbDate]);

  const prevMonth = () => {
    setCurrentMonthDate((curr) => new Date(curr.getFullYear(), curr.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate((curr) => new Date(curr.getFullYear(), curr.getMonth() + 1, 1));
  };

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const monthName = currentMonthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDayIndex = firstDay.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const result: {
      date: Date;
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isDisabled: boolean;
      weekStartKey: string;
      isMonday: boolean;
      isSunday: boolean;
    }[] = [];

    // Previous month overflow days
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const key = formatDateKey(d);
      const mon = getMonday(d);
      result.push({
        date: d,
        dateKey: key,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isDisabled: key < minAllowedDate,
        weekStartKey: formatDateKey(mon),
        isMonday: d.getDay() === 1,
        isSunday: d.getDay() === 0,
      });
    }

    // Current month days
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const d = new Date(year, month, dNum);
      const key = formatDateKey(d);
      const mon = getMonday(d);
      result.push({
        date: d,
        dateKey: key,
        dayNumber: dNum,
        isCurrentMonth: true,
        isDisabled: key < minAllowedDate,
        weekStartKey: formatDateKey(mon),
        isMonday: d.getDay() === 1,
        isSunday: d.getDay() === 0,
      });
    }

    // Next month overflow days
    const remaining = (7 - (result.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const key = formatDateKey(d);
      const mon = getMonday(d);
      result.push({
        date: d,
        dateKey: key,
        dayNumber: i,
        isCurrentMonth: false,
        isDisabled: key < minAllowedDate,
        weekStartKey: formatDateKey(mon),
        isMonday: d.getDay() === 1,
        isSunday: d.getDay() === 0,
      });
    }

    return result;
  }, [year, month, minAllowedDate]);

  const effectiveDescentDate = descentDate || climbDate;

  const diffDays = useMemo(() => {
    if (!climbDate) return 1;
    const start = new Date(climbDate).getTime();
    const end = new Date(effectiveDescentDate).getTime();
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  }, [climbDate, effectiveDescentDate]);

  const currentWeekInfo = useMemo(() => {
    if (isKumaliskisTrail || !climbDate) return null;
    return availableWeeks.find((w) => w.startDate === climbDate);
  }, [isKumaliskisTrail, climbDate, availableWeeks]);

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Starting Climb & Descent Date Dual Selection Tabs (Available for All 4 Protected Trails) */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
          {/* 1. Starting Climb Date Tab */}
          <button
            type="button"
            onClick={() => setSelectionMode("climb")}
            className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer ${
              selectionMode === "climb"
                ? "border-emerald-600 bg-emerald-50/80 shadow-xs ring-2 ring-emerald-500/20"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Mountain className="w-3.5 h-3.5 text-emerald-600" />
                1. Starting Climb Date
              </span>
              {selectionMode === "climb" && (
                <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-full uppercase">
                  Selecting
                </span>
              )}
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {climbDate ? (
                new Date(climbDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
              ) : (
                <span className="text-slate-400 font-normal">Click a date on calendar</span>
              )}
            </div>
          </button>

          {/* 2. Date to Go Down (Descent) Tab */}
          <button
            type="button"
            onClick={() => {
              if (!climbDate) {
                toast.info("Please pick your starting climb date first.");
                setSelectionMode("climb");
              } else {
                setSelectionMode("descent");
              }
            }}
            className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer ${
              selectionMode === "descent"
                ? "border-blue-600 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-600" />
                2. Date to Go Down (Descent)
              </span>
              {selectionMode === "descent" && (
                <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-full uppercase">
                  Selecting
                </span>
              )}
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {effectiveDescentDate ? (
                new Date(effectiveDescentDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
              ) : climbDate ? (
                <span className="text-slate-400 font-normal">Pick descent date</span>
              ) : (
                <span className="text-slate-400 font-normal">Pick start date first</span>
              )}
            </div>
          </button>
        </div>

        {/* Quick Duration Shortcuts */}
        {climbDate && (
          <div className="flex flex-wrap items-center gap-1.5 py-1 px-1 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Presets:</span>
            <button
              type="button"
              onClick={() => {
                onSelectDescentDate(climbDate);
                setSelectionMode("climb");
                toast.success("Set to 1-Day Same-Day Dayhike.");
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                effectiveDescentDate === climbDate
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Same-Day Dayhike (1 Day)
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date(climbDate);
                d.setDate(d.getDate() + 1);
                const nextDateKey = formatDateKey(d);
                onSelectDescentDate(nextDateKey);
                setSelectionMode("descent");
                toast.success("Set to 2 Days / 1 Night (Overnight Trek).");
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                effectiveDescentDate && Math.round((new Date(effectiveDescentDate).getTime() - new Date(climbDate).getTime()) / 86400000) === 1
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              2 Days / 1 Night
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date(climbDate);
                d.setDate(d.getDate() + 2);
                const nextDateKey = formatDateKey(d);
                onSelectDescentDate(nextDateKey);
                setSelectionMode("descent");
                toast.success("Set to 3 Days / 2 Nights.");
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                effectiveDescentDate && Math.round((new Date(effectiveDescentDate).getTime() - new Date(climbDate).getTime()) / 86400000) === 2
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              3 Days / 2 Nights
            </button>
          </div>
        )}
      </div>

      {/* Google Calendar Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg text-gray-700 hover:text-gray-900 hover:bg-white transition cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-lg text-gray-700 hover:text-gray-900 hover:bg-white transition cursor-pointer"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h3 className="text-base font-extrabold text-gray-900 tracking-tight">
            {monthName}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
            Daily Schedule
          </span>
        </div>
      </div>

      {/* Weekday Labels (SUN, MON, TUE, WED, THU, FRI, SAT) */}
      <div className="grid grid-cols-7 mb-2 text-center">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
          <div key={d} className="text-[11px] font-black text-gray-400 py-1 tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid (Daily for all 4 trails) */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((item, index) => {
          const isClickable = !item.isDisabled;

          // Date state checks
          const isStart = climbDate === item.dateKey;
          const isDescent = effectiveDescentDate === item.dateKey;
          const isInRange = climbDate && effectiveDescentDate
            ? item.dateKey >= climbDate && item.dateKey <= effectiveDescentDate
            : false;

          return (
            <div
              key={index}
              onClick={() => {
                if (!isClickable) return;
                const targetKey = item.dateKey;

                if (selectionMode === "climb") {
                  onSelectDate(targetKey);
                  if (!descentDate || descentDate < targetKey) {
                    onSelectDescentDate(targetKey);
                  }
                  setSelectionMode("descent");
                  toast.success(`Starting climb set to ${targetKey}. Now click your date to go down (descent).`);
                } else {
                  // Descent mode
                  if (targetKey < climbDate) {
                    onSelectDate(targetKey);
                    onSelectDescentDate(targetKey);
                    toast.info(`Updated starting climb date to ${targetKey}.`);
                  } else {
                    onSelectDescentDate(targetKey);
                    const daysSpan = Math.round((new Date(targetKey).getTime() - new Date(climbDate).getTime()) / 86400000) + 1;
                    toast.success(
                      daysSpan === 1
                        ? "Same-day dayhike selected!"
                        : `Date to go down set to ${targetKey} (${daysSpan} Days / ${daysSpan - 1} Night${daysSpan - 1 > 1 ? "s" : ""}).`
                    );
                  }
                }
              }}
              className={`relative h-10 sm:h-11 flex items-center justify-center text-xs font-semibold select-none transition-all ${
                !item.isCurrentMonth ? "opacity-35" : ""
              } ${
                !isClickable
                  ? "text-gray-300 cursor-not-allowed"
                  : isStart || isDescent
                  ? "cursor-pointer"
                  : "cursor-pointer text-gray-800 hover:text-emerald-900"
              } ${
                isInRange && !isStart && !isDescent
                  ? "bg-emerald-100 text-emerald-950 font-bold"
                  : ""
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex flex-col items-center justify-center transition-all ${
                  isStart && isDescent
                    ? "bg-emerald-600 text-white font-black shadow-xs ring-4 ring-emerald-100"
                    : isStart
                    ? "bg-emerald-600 text-white font-black shadow-xs ring-4 ring-emerald-100"
                    : isDescent
                    ? "bg-blue-600 text-white font-black shadow-xs ring-4 ring-blue-100"
                    : isInRange
                    ? "bg-transparent text-emerald-950 font-bold"
                    : isClickable
                    ? "hover:bg-emerald-100 text-gray-800"
                    : "text-gray-300"
                }`}
                title={
                  isStart && isDescent
                    ? `Starting Climb & Date to Go Down (Dayhike): ${item.dateKey}`
                    : isStart
                    ? `Starting Climb Date: ${item.dateKey}`
                    : isDescent
                    ? `Date to Go Down (Descent): ${item.dateKey}`
                    : item.dateKey
                }
              >
                <span className="leading-none">{item.dayNumber}</span>
                {(isStart || isDescent) && (
                  <span className="text-[7px] leading-none uppercase font-black tracking-tight mt-0.5">
                    {isStart && isDescent ? "1-Day" : isStart ? "Start" : "Down"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Date Summary Banner (without 14-day notice requirement text) */}
      <div className="mt-4 pt-3.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
          <div className="flex flex-wrap items-center gap-1.5 text-gray-800">
            {climbDate ? (
              <>
                <span className="font-semibold text-gray-500">Starting:</span>
                <strong className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                  {new Date(climbDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </strong>
                <span className="text-gray-400 font-bold">→</span>
                <span className="font-semibold text-gray-500">Going Down:</span>
                <strong className="text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md font-bold">
                  {new Date(effectiveDescentDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </strong>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-extrabold rounded-full text-[11px] border border-slate-200">
                  {diffDays === 1 ? "1-Day Dayhike" : `${diffDays} Days / ${diffDays - 1} Night${diffDays - 1 > 1 ? "s" : ""}`}
                </span>
              </>
            ) : (
              <span className="text-gray-500">Select starting climb date and date to go down</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Book() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTrailId = searchParams.get("trailId");

  const [step, setStep] = useState(1);

  // Trails state - INSTANT CACHED LOAD
  const [trails, setTrails] = useState<Trail[]>(() => {
    return getCached<Trail[]>("nnnp_trails") || [];
  });
  const [trailId, setTrailId] = useState<string>(() => {
    if (initialTrailId) return initialTrailId;
    const cached = getCached<Trail[]>("nnnp_trails");
    return cached && cached.length > 0 ? cached[0].id : "";
  });
  const [fetchingTrails, setFetchingTrails] = useState<boolean>(() => {
    return (getCached<Trail[]>("nnnp_trails")?.length || 0) === 0;
  });

  // Date & Time Slot state
  const [climbDate, setClimbDate] = useState("");
  const [descentDate, setDescentDate] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[0]);
  const [slotCapacity, setSlotCapacity] = useState<{ booked: number; available: number; isFull: boolean } | null>(null);
  const [checkingCapacity, setCheckingCapacity] = useState(false);

  // Guide selection state
  const [guideId, setGuideId] = useState("");
  const [guides, setGuides] = useState<any[]>([]);
  const [fetchingGuides, setFetchingGuides] = useState(false);

  // Group Information & Participants
  const [groupSize, setGroupSize] = useState(1);
  const [foreignCount, setForeignCount] = useState(0);
  const [organization, setOrganization] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");

  const [participants, setParticipants] = useState<ParticipantInput[]>(() => {
    let initialName = "";
    let initialPhone = "";
    if (typeof window !== "undefined") {
      try {
        const rawProfile = localStorage.getItem("nnnp_auth_profile");
        if (rawProfile) {
          const p = JSON.parse(rawProfile);
          if (p.full_name) initialName = p.full_name;
          if (p.phone) initialPhone = p.phone.replace(/\D/g, '').replace(/^0/, '').slice(0, 10);
        }
        const rawUser = localStorage.getItem("nnnp_auth_user");
        if (rawUser) {
          const u = JSON.parse(rawUser);
          if (!initialName && u.user_metadata?.full_name) initialName = u.user_metadata.full_name;
          if (!initialName && u.user_metadata?.name) initialName = u.user_metadata.name;
          if (!initialPhone && (u.phone || u.user_metadata?.phone)) initialPhone = u.phone || u.user_metadata.phone;
        }
      } catch { }
    }
    return [
      {
        fullName: initialName,
        age: 25,
        gender: "Male",
        contactNumber: initialPhone,
        emergencyContactName: "",
        emergencyContactPhone: "",
        medicalConditions: "None",
      },
    ];
  });

  // Automatically fill Participant #1 with logged-in trekker's information
  useEffect(() => {
    const trekkerName =
      profile?.full_name?.trim() ||
      (user?.user_metadata?.full_name as string)?.trim() ||
      (user?.user_metadata?.name as string)?.trim() ||
      "";
    const rawTrekkerPhone =
      profile?.phone?.trim() ||
      (user?.user_metadata?.phone as string)?.trim() ||
      user?.phone?.trim() ||
      "";
    const trekkerPhone = rawTrekkerPhone.replace(/\D/g, '').replace(/^0/, '').slice(0, 10);

    if (trekkerName || trekkerPhone) {
      setParticipants((prev) => {
        if (prev.length === 0) {
          return [
            {
              fullName: trekkerName,
              age: 25,
              gender: "Male",
              contactNumber: trekkerPhone,
              emergencyContactName: emergencyName || "",
              emergencyContactPhone: emergencyPhone || "",
              medicalConditions: "None",
            },
          ];
        }

        const first = prev[0];
        if (!first.fullName || !first.contactNumber) {
          const updatedFirst: ParticipantInput = {
            ...first,
            fullName: first.fullName || trekkerName,
            contactNumber: first.contactNumber || trekkerPhone,
            age: first.age || 25,
            medicalConditions: first.medicalConditions || "None",
          };
          return [updatedFirst, ...prev.slice(1)];
        }
        return prev;
      });
    }
  }, [user, profile]);

  // Documents per participant
  const [participantDocs, setParticipantDocs] = useState<{
    validId: File | null;
    waiver: File | null;
    medCert: File | null;
  }[]>([
    { validId: null, waiver: null, medCert: null },
  ]);

  // Tesseract OCR modal & scanning states
  const [ocrModal, setOcrModal] = useState<{
    isOpen: boolean;
    file: File | null;
    participantIdx: number;
    label: string;
    expectedName?: string;
  } | null>(null);

  const [ocrScanningState, setOcrScanningState] = useState<{
    [idx: number]: {
      isScanning: boolean;
      progress: number;
      status: string;
      detectedName?: string;
      detectedAge?: number;
      detectedGender?: "Male" | "Female";
      detectedIdType?: string;
      detectedIdNumber?: string;
      rawText?: string;
      confidence?: number;
      hasScanned?: boolean;
      isMatch?: boolean;
    };
  }>({});

  const autoScanValidId = async (idx: number, idFile: File) => {
    const isImage = idFile.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp|gif)$/i.test(idFile.name);
    if (!isImage) return;

    setOcrScanningState((prev) => ({
      ...prev,
      [idx]: {
        isScanning: true,
        progress: 0,
        status: "Starting Tesseract OCR...",
        hasScanned: false,
      },
    }));

    try {
      const result = await runTesseractOcr(idFile, (p, status) => {
        setOcrScanningState((prev) => ({
          ...prev,
          [idx]: { isScanning: true, progress: p, status, hasScanned: false },
        }));
      });

      // Find current participant name
      const currentParticipantName = participants[idx]?.fullName?.trim() || "";
      const matchCheck = checkIdNameMatch(
        currentParticipantName || result.detectedName || "",
        result.detectedName,
        result.rawText
      );

      setOcrScanningState((prev) => ({
        ...prev,
        [idx]: {
          isScanning: false,
          progress: 100,
          status: matchCheck.isMatch ? "Verified" : "Mismatch",
          detectedName: result.detectedName,
          detectedAge: result.detectedAge,
          detectedGender: result.detectedGender,
          detectedIdType: result.detectedIdType,
          detectedIdNumber: result.detectedIdNumber,
          rawText: result.rawText,
          confidence: result.confidence,
          hasScanned: true,
          isMatch: matchCheck.isMatch,
        },
      }));

      // Auto-fill participant fields and record verified OCR metadata in state
      const ocrVerificationData = {
        verified: matchCheck.isMatch,
        confidence: result.confidence,
        detectedName: result.detectedName,
        detectedIdType: result.detectedIdType,
        detectedIdNumber: result.detectedIdNumber,
        detectedAge: result.detectedAge,
        detectedGender: result.detectedGender,
        verifiedAt: new Date().toISOString(),
        rawTextPreview: result.rawText ? result.rawText.slice(0, 300) : "",
      };

      setParticipants((prev) => {
        const copy = [...prev];
        if (copy[idx]) {
          const hasExistingName = !!copy[idx].fullName.trim();
          copy[idx] = {
            ...copy[idx],
            // Preserve entered name if already typed; only auto-fill if empty
            fullName: hasExistingName ? copy[idx].fullName : (result.detectedName || copy[idx].fullName),
            age: result.detectedAge || copy[idx].age,
            gender: result.detectedGender || copy[idx].gender,
            ocrVerification: ocrVerificationData,
          };
        }
        return copy;
      });

      if (matchCheck.isMatch) {
        toast.success(
          `Participant #${idx + 1} ID Verified: Name matches "${currentParticipantName || result.detectedName}" ✓`,
          { id: `id-verify-${idx}`, duration: 5000 }
        );
      } else {
        toast.error(
          `Participant #${idx + 1}: The government ID must be visible and match "${currentParticipantName || "the participant"}". Please upload a clear and legible ID.`,
          { id: `id-verify-${idx}`, duration: 7000 }
        );
      }
    } catch (err) {
      console.warn("Tesseract auto-scan skipped:", err);
      setOcrScanningState((prev) => ({
        ...prev,
        [idx]: {
          isScanning: false,
          progress: 0,
          status: "Error",
          hasScanned: true,
          isMatch: false,
        },
      }));
      toast.error(
        `Participant #${idx + 1}: The government ID must be clearly visible and legible.`,
        { id: `id-verify-${idx}`, duration: 7000 }
      );
    }
  };

  const updateParticipantDoc = (
    index: number,
    docType: "validId" | "waiver" | "medCert",
    file: File | null
  ) => {
    setParticipantDocs((prev) => {
      const copy = [...prev];
      while (copy.length <= index) {
        copy.push({ validId: null, waiver: null, medCert: null });
      }
      copy[index] = { ...copy[index], [docType]: file };
      return copy;
    });

    if (docType === "validId" && file) {
      autoScanValidId(index, file);
    }
  };

  // Submission state & Voucher modal
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [createdVoucher, setCreatedVoucher] = useState<any | null>(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);

  // Document preview review modal state
  const [previewDoc, setPreviewDoc] = useState<{
    file: File;
    label: string;
    url: string;
    isImage: boolean;
  } | null>(null);

  const handleOpenPreview = (file: File, label: string) => {
    const url = URL.createObjectURL(file);
    const isImage = file.type.startsWith("image/");
    setPreviewDoc({ file, label, url, isImage });
  };

  const handleClosePreview = () => {
    if (previewDoc?.url) {
      URL.revokeObjectURL(previewDoc.url);
    }
    setPreviewDoc(null);
  };

  // Helper: Get Monday of a week
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const formatDateKey = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Allowed booking dates start from today onwards
  const getMinDate = () => {
    const date = new Date();
    return formatDateKey(date);
  };
  const minAllowedDate = getMinDate();

  // 1. Fetch Trails
  useEffect(() => {
    const fetchTrails = async () => {
      const cached = getCached<Trail[]>("nnnp_trails");
      if (cached && cached.length > 0) {
        setTrails(cached);
        if (!initialTrailId) setTrailId((curr) => curr || cached[0].id);
        setFetchingTrails(false);
      }

      try {
        const { data, error } = await supabase
          .from("trails")
          .select("*")
          .eq("active", true)
          .order("name");

        if (!error && data) {
          setTrails(data);
          setCached("nnnp_trails", data, 15 * 60 * 1000);
          if (data.length > 0) {
            setTrailId((curr) => (!initialTrailId && !curr ? data[0].id : curr));
          }
        }
      } catch (err) {
        console.warn("Trails fetch failed:", err);
      } finally {
        setFetchingTrails(false);
      }
    };

    fetchTrails();
  }, [initialTrailId]);

  // Active trail metadata
  const selectedTrailObj = trails.find((t) => t.id === trailId);
  const trailMeta = getTrailMetadata(selectedTrailObj?.name);

  // Check if selected trail is Kumaliskis Trail (daily trail) vs other mountain trails (weekly trails)
  const isKumaliskisTrail = useMemo(() => {
    const name = (selectedTrailObj?.name || "").toLowerCase();
    return name.includes("kumaliskis") || name.includes("kumalisikis");
  }, [selectedTrailObj]);

  // Generate available upcoming 16 weeks starting at least 14 days in advance
  const availableWeeks = useMemo(() => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 14);
    const earliestMonday = getMonday(minDate);
    if (earliestMonday < minDate) {
      earliestMonday.setDate(earliestMonday.getDate() + 7);
    }

    const weeks: { startDate: string; endDate: string; label: string; fullLabel: string }[] = [];
    for (let i = 0; i < 16; i++) {
      const monday = new Date(earliestMonday);
      monday.setDate(earliestMonday.getDate() + i * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const startStr = formatDateKey(monday);
      const endStr = formatDateKey(sunday);
      const label = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      const fullLabel = `Week of ${label}`;

      weeks.push({
        startDate: startStr,
        endDate: endStr,
        label,
        fullLabel,
      });
    }
    return weeks;
  }, []);

  // Sync climbDate when switching between Kumaliskis and weekly trails
  useEffect(() => {
    if (!isKumaliskisTrail && availableWeeks.length > 0) {
      const isCurrentInWeeks = availableWeeks.some((w) => w.startDate === climbDate);
      if (!isCurrentInWeeks) {
        setClimbDate(availableWeeks[0].startDate);
        setDescentDate(availableWeeks[0].startDate);
      }
    }
  }, [isKumaliskisTrail, availableWeeks, climbDate]);

  const handleSelectClimbDate = (newDate: string) => {
    setClimbDate(newDate);
    if (!descentDate || descentDate < newDate) {
      setDescentDate(newDate);
    }
  };

  const handleSelectDescentDate = (newDate: string) => {
    setDescentDate(newDate);
  };

  // 2. Fetch slot capacity whenever trail, climbDate, or timeSlot changes
  useEffect(() => {
    if (!trailId || !climbDate) {
      setSlotCapacity(null);
      return;
    }

    const checkCapacity = async () => {
      setCheckingCapacity(true);
      const cap = await checkSlotCapacity(trailId, climbDate, selectedTimeSlot, trailMeta.maxCapacityPerSlot);
      setSlotCapacity(cap);
      setCheckingCapacity(false);
    };

    checkCapacity();
  }, [trailId, climbDate, selectedTimeSlot, trailMeta.maxCapacityPerSlot]);

  // 3. Fetch guides when climbDate changes
  useEffect(() => {
    if (!climbDate) {
      setGuides([]);
      setGuideId("");
      return;
    }

    const loadGuides = async () => {
      setFetchingGuides(true);
      const availableGuides = await fetchAvailableGuides(climbDate, selectedTimeSlot);
      setGuides(availableGuides);
      setFetchingGuides(false);
    };

    loadGuides();
  }, [climbDate, selectedTimeSlot]);

  // Sync participants list length with groupSize
  const handleGroupSizeChange = (newSize: number) => {
    const clamped = Math.max(1, Math.min(trailMeta.maxCapacityPerSlot, newSize));
    setGroupSize(clamped);

    setParticipants((prev) => {
      if (prev.length < clamped) {
        const added: ParticipantInput[] = Array.from({ length: clamped - prev.length }).map(() => ({
          fullName: "",
          age: 25,
          gender: "Male",
          contactNumber: "",
          emergencyContactName: emergencyName || "",
          emergencyContactPhone: emergencyPhone || "",
          medicalConditions: "None",
        }));
        return [...prev, ...added];
      } else if (prev.length > clamped) {
        return prev.slice(0, clamped);
      }
      return prev;
    });

    setParticipantDocs((prev) => {
      if (prev.length < clamped) {
        const addedDocs = Array.from({ length: clamped - prev.length }).map(() => ({
          validId: null,
          waiver: null,
          medCert: null,
        }));
        return [...prev, ...addedDocs];
      } else if (prev.length > clamped) {
        return prev.slice(0, clamped);
      }
      return prev;
    });
  };

  const removeParticipant = (index: number) => {
    if (participants.length <= 1) return;
    const newSize = participants.length - 1;
    setGroupSize(newSize);
    setParticipants((prev) => prev.filter((_, i) => i !== index));
    setParticipantDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: keyof ParticipantInput, value: any) => {
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const uploadFile = async (file: File, type: string, index?: number) => {
    if (!user) throw new Error("Not authenticated");
    const fileExt = file.name.split(".").pop();
    const prefix = index !== undefined ? `p${index + 1}_` : "";
    const fileName = `${user.id}_${prefix}${Date.now()}_${type}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("requirements")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("requirements").getPublicUrl(filePath);
    return data.publicUrl;
  };

  // Step validation
  const validateStep = (currentStep: number) => {
    if (!user) {
      alert("Please log in to proceed with booking.");
      navigate("/login");
      return false;
    }

    if (currentStep === 1) {
      if (!trailId) {
        alert("Please select a trekking trail.");
        return false;
      }
      return true;
    }

    if (currentStep === 2) {
      if (!climbDate) {
        alert("Please choose your starting climb date.");
        return false;
      }
      if (descentDate && descentDate < climbDate) {
        alert("Date to go down (descent date) cannot be earlier than your starting climb date.");
        return false;
      }
      if (slotCapacity && slotCapacity.isFull) {
        alert("This time slot is fully booked. Please select another date or time slot.");
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      if (!guideId) {
        alert("Please choose a tour guide.");
        return false;
      }
      return true;
    }

    if (currentStep === 4) {
      if (!emergencyName || !emergencyPhone) {
        alert("Please enter the primary emergency contact name and phone number.");
        return false;
      }
      // Check participant names and all 3 required documents for each participant
      for (let i = 0; i < participants.length; i++) {
        if (!participants[i].fullName.trim()) {
          alert(`Please fill in the full name for Participant #${i + 1}.`);
          return false;
        }
        const docs = participantDocs[i];
        if (!docs?.validId || !docs?.waiver || !docs?.medCert) {
          alert(`Please upload all 3 required documents for Participant #${i + 1}: Valid Government ID, Signed DENR Waiver, and Fit-to-Climb Medical Certificate.`);
          return false;
        }

        const ocrState = ocrScanningState[i];
        if (ocrState?.isScanning) {
          toast.info(`Participant #${i + 1} ID is currently being scanned. Please wait a moment.`);
          return false;
        }

        if (ocrState?.hasScanned) {
          const matchCheck = checkIdNameMatch(
            participants[i].fullName,
            ocrState.detectedName,
            ocrState.rawText
          );
          if (!matchCheck.isMatch) {
            toast.error(
              `Participant #${i + 1}: The government ID must be visible and match "${participants[i].fullName}". Please ensure the ID is clearly visible.`,
              { duration: 7000 }
            );
            return false;
          }
        }
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(5, s + 1));
    }
  };

  const handlePrev = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    for (let i = 0; i < participants.length; i++) {
      const docs = participantDocs[i];
      if (!docs?.validId || !docs?.waiver || !docs?.medCert) {
        alert(`Please upload all 3 required documents for Participant #${i + 1}: Valid Government ID, Signed DENR Waiver, and Fit-to-Climb Medical Certificate.`);
        return;
      }
    }

    setLoading(true);
    setUploading(true);

    try {
      // Upload all documents for each participant
      const enrichedParticipants: ParticipantInput[] = await Promise.all(
        participants.map(async (p, idx) => {
          const docs = participantDocs[idx];
          const [validIdUrl, waiverUrl, medicalCertUrl] = await Promise.all([
            docs?.validId ? uploadFile(docs.validId, "valid_id", idx) : Promise.resolve(undefined),
            docs?.waiver ? uploadFile(docs.waiver, "waiver", idx) : Promise.resolve(undefined),
            docs?.medCert ? uploadFile(docs.medCert, "medical_cert", idx) : Promise.resolve(undefined),
          ]);
          return {
            ...p,
            validIdUrl,
            waiverUrl,
            medicalCertUrl,
            ocrVerification: p.ocrVerification,
          };
        })
      );

      setUploading(false);

      const scheduleLabel = isKumaliskisTrail
        ? climbDate
        : availableWeeks.find((w) => w.startDate === climbDate)?.fullLabel || `Week of ${climbDate}`;

      const primaryDocs = enrichedParticipants[0] || {};

      const bookingRecord = await createOnlineBooking({
        userId: user!.id,
        trailId,
        trailName: selectedTrailObj?.name || trailMeta.name,
        trekkingDate: climbDate,
        descentDate: isKumaliskisTrail ? (descentDate || climbDate) : climbDate,
        timeSlot: selectedTimeSlot,
        participantsCount: groupSize,
        guideId: guideId || null,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
        medicalNotes: isKumaliskisTrail
          ? `${descentDate && descentDate !== climbDate ? `Trek Dates: ${climbDate} to ${descentDate} | ` : ""}${medicalNotes || ""}`
          : `Schedule: ${scheduleLabel}${medicalNotes ? " | " + medicalNotes : ""}`,
        participants: enrichedParticipants,
        validIdUrl: primaryDocs.validIdUrl,
        waiverUrl: primaryDocs.waiverUrl,
        medicalCertUrl: primaryDocs.medicalCertUrl,
      });

      // Prepare confirmation voucher
      setCreatedVoucher({
        referenceNumber: bookingRecord?.reference_number || `NNNP-${new Date().getFullYear()}-REF`,
        trailName: selectedTrailObj?.name || trailMeta.name,
        climbDate: scheduleLabel,
        descentDate: isKumaliskisTrail ? (descentDate || climbDate) : undefined,
        timeSlot: selectedTimeSlot,
        groupSize,
        guideName: guides.find((g) => g.id === guideId)?.full_name || "Assigned Guide",
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
        participants: enrichedParticipants,
      });

      setShowVoucherModal(true);
    } catch (err: any) {
      console.error("Booking error:", err);
      alert("Error submitting booking: " + (err.message || "Please check connection and try again."));
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  if (fetchingTrails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-emerald-800">
          <Mountain className="w-10 h-10 animate-bounce" />
          <p className="font-semibold">Loading NNNP Trails & Weather Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100/80 px-3.5 py-1.5 rounded-full mb-3 shadow-xs">
            <Compass className="w-4 h-4" /> TAKAZZ Trekking Portal
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
            Online Trekking Booking & Permit
          </h1>
          <p className="text-sm md:text-base text-gray-600 max-w-xl mx-auto mt-2">
            Multi-step reservation for protected mountain trails with real-time slot monitoring, accredited guides, and participant safety registration.
          </p>
        </div>

        {/* 5-STEP WIZARD PROGRESS BAR */}
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 mb-8">
          <div className="grid grid-cols-5 gap-2 text-center text-xs font-semibold">
            {[
              { num: 1, label: "Trail & Weather" },
              { num: 2, label: "Date & Slot" },
              { num: 3, label: "Tour Guide" },
              { num: 4, label: "Participants" },
              { num: 5, label: "Review & Submit" },
            ].map((s) => (
              <div
                key={s.num}
                onClick={() => s.num < step && setStep(s.num)}
                className={`flex flex-col items-center gap-1.5 transition-all ${s.num <= step ? "text-emerald-700" : "text-gray-400"
                  } ${s.num < step ? "cursor-pointer hover:opacity-80" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${s.num === step
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-sm"
                    : s.num < step
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-gray-100 text-gray-400"
                    }`}
                >
                  {s.num < step ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="w-full bg-gray-100 h-2 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP CONTENT CONTAINER */}
        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-md border border-gray-100">

          {/* ======================================================== */}
          {/* STEP 1: TRAIL SELECTION & LIVE WEATHER FORECAST */}
          {/* ======================================================== */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Mountain className="w-6 h-6 text-emerald-700" />
                  1. Select Trekking Trail Destination
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Choose your protected trail. Review trailhead elevation and live atmospheric conditions.
                </p>
              </div>

              {/* Trails Selection Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trails.map((trail) => {
                  const meta = getTrailMetadata(trail.name);
                  const isSelected = trail.id === trailId;
                  return (
                    <div
                      key={trail.id}
                      onClick={() => setTrailId(trail.id)}
                      className={`cursor-pointer rounded-2xl overflow-hidden border-2 transition-all text-left flex flex-col justify-between ${isSelected
                        ? "border-emerald-600 bg-emerald-50/40 shadow-md ring-2 ring-emerald-600/20"
                        : "border-gray-200 hover:border-emerald-300 bg-white"
                        }`}
                    >
                      <div className="relative h-32 w-full overflow-hidden bg-slate-100">
                        <img
                          src={meta.imageUrl}
                          alt={trail.name}
                          className="w-full h-full object-cover"
                        />

                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
                          Max {meta.maxCapacityPerSlot} / slot
                        </div>
                      </div>

                      <div className="p-4 flex-grow flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900 text-base">{trail.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {trail.barangay || meta.barangay}, {trail.city || meta.city}
                          </p>
                          <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                            {trail.description || "Pristine mountain trek within Northern Negros Natural Park."}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                          <span>Elevation: <strong>{meta.elevation}</strong></span>
                          <span>Duration: <strong>{meta.duration}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Trail Live Weather Widget */}
              {trailMeta && (
                <div className="mt-6">
                  <WeatherWidget
                    lat={trailMeta.lat}
                    lng={trailMeta.lng}
                    trailName={selectedTrailObj?.name || trailMeta.name}
                  />
                </div>
              )}

              {/* Designated Meeting Point & Navigation Links */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  Designated Trailhead Meeting Point
                </div>
                <div className="text-xs text-gray-900 font-bold mt-1">{trailMeta.meetingPoint.name}</div>
                <p className="text-xs text-gray-600 mt-0.5">{trailMeta.meetingPoint.address}</p>
                <p className="text-xs text-emerald-800 italic mt-0.5">{trailMeta.meetingPoint.landmark}</p>
                <div className="flex gap-2 mt-3">
                  <a
                    href={trailMeta.navigationUrls.googleMaps}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold bg-white text-emerald-800 border border-emerald-300 px-3 py-1 rounded-lg hover:bg-emerald-100 transition shadow-xs"
                  >
                    Google Maps <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Navigation button */}
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-sm"
                >
                  Next: Date & Time Slot <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: DATE & TIME SLOT SELECTION WITH CAPACITY CHECK */}
          {/* ======================================================== */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-emerald-700" />
                  2. Select Trekking Date & Time Slot
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Select your starting climb date, date to go down (descent), and preferred staggered departure time slot.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Interactive Google Calendar Selector */}
                <div className="lg:col-span-7">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Select Starting Climb & Date to Go Down *
                    </label>
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
                      Daily Schedule
                    </span>
                  </div>

                  <GoogleCalendarSelector
                    isKumaliskisTrail={isKumaliskisTrail}
                    climbDate={climbDate}
                    descentDate={descentDate}
                    onSelectDate={handleSelectClimbDate}
                    onSelectDescentDate={handleSelectDescentDate}
                    minAllowedDate={minAllowedDate}
                    availableWeeks={availableWeeks}
                  />
                </div>

                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs">
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                      Designated Time Slot *
                    </label>
                    <select
                      value={selectedTimeSlot}
                      onChange={(e) => setSelectedTimeSlot(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl p-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-xs text-sm font-semibold text-gray-800 bg-white"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-gray-500 mt-2 block">
                      Departures are strictly staggered to minimize wildlife disturbance.
                    </span>
                  </div>

                  {/* Slot Capacity Live Monitor */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-700" />
                        Slot Capacity Monitor
                      </span>
                      {checkingCapacity && (
                        <span className="text-xs text-emerald-600 animate-pulse">
                          Updating capacity...
                        </span>
                      )}
                    </div>

                    {climbDate ? (
                      slotCapacity ? (
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="font-semibold text-gray-800">
                              {selectedTrailObj?.name} on {climbDate}
                              {descentDate && descentDate !== climbDate ? ` (Down: ${descentDate})` : ""}
                            </span>
                            <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${slotCapacity.isFull ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"
                              }`}>
                              {slotCapacity.available} slots remaining / Max {trailMeta.maxCapacityPerSlot}
                            </span>
                          </div>

                          <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${slotCapacity.isFull ? "bg-red-500" : "bg-emerald-600"
                                }`}
                              style={{
                                width: `${Math.min(100, (slotCapacity.booked / trailMeta.maxCapacityPerSlot) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            {slotCapacity.isFull
                              ? "This time slot is completely booked. Please choose an alternate date or time."
                              : "Slots are currently open. Proceed to tour guide selection."}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Checking slot availability...</p>
                      )
                    ) : (
                      <p className="text-xs text-gray-500">Select a climb date above to check real-time slot capacity.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-sm"
                >
                  Next: Select Tour Guide <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 3: TOUR GUIDE SELECTION */}
          {/* ======================================================== */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Compass className="w-6 h-6 text-emerald-700" />
                  3. Tour Guide Selection & Assignment
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Choose a licensed DENR-accredited local guide for your trek.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">
                  Available Accredited Guides for {climbDate}
                </h3>

                {fetchingGuides ? (
                  <div className="bg-gray-50 rounded-2xl p-8 text-center text-sm text-gray-500 animate-pulse">
                    Checking guide schedules and conflict prevention...
                  </div>
                ) : guides.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    <h4 className="font-bold text-amber-900 text-sm">No Independent Guides Available</h4>
                    <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto">
                      All independent guides have active treks scheduled for this date. Please select another climb date or slot.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {guides.map((guide) => {
                      const isSelected = guideId === guide.id;
                      const isAvail = guide.isAvailable;
                      return (
                        <div
                          key={guide.id}
                          onClick={() => {
                            if (isAvail) {
                              setGuideId(guide.id);
                            }
                          }}
                          className={`rounded-2xl p-4 border-2 transition-all flex flex-col justify-between ${!isAvail
                            ? "opacity-60 bg-gray-50 border-gray-200 cursor-not-allowed"
                            : isSelected
                              ? "border-emerald-600 bg-emerald-50/50 shadow-md cursor-pointer ring-2 ring-emerald-600/20"
                              : "border-gray-200 hover:border-emerald-300 bg-white cursor-pointer"
                            }`}
                        >
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 border border-emerald-200">
                                {(guide.full_name || "G").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 text-sm">{guide.full_name}</div>
                                <div className="text-xs text-gray-500">
                                  {guide.experience_years || 3}+ years trail experience
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                              {guide.bio || "Certified DENR Mountain Guide for Northern Negros protected areas."}
                            </p>
                          </div>

                          <div className="mt-4 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                            {isAvail ? (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Available on date
                              </span>
                            ) : (
                              <span className="text-red-500 font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" /> Booked / On Trek
                              </span>
                            )}

                            {isSelected && (
                              <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full text-[10px]">
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-sm"
                >
                  Next: Group Participants <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 4: GROUP PARTICIPANTS & EMERGENCY CONTACTS */}
          {/* ======================================================== */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-6 h-6 text-emerald-700" />
                  4. Group Participants & Safety Registration
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Add all participant details for search-and-rescue readiness and DENR park ranger rosters.
                </p>
              </div>

              {/* Group Size Selector */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Total Group Size (1 - {trailMeta.maxCapacityPerSlot}) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={trailMeta.maxCapacityPerSlot}
                      value={groupSize}
                      onChange={(e) => handleGroupSizeChange(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Foreign Trekkers Count
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={groupSize}
                      value={foreignCount}
                      onChange={(e) => setForeignCount(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Mountaineering Club / Org
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bacolod Hikers Club"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Primary Emergency Contact */}
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-700" />
                  Primary Emergency Contact (Not in group) *
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Emergency Contact Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Maria Santos"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Emergency Phone Number *
                    </label>
                    <div className={`flex items-center gap-2 border-2 rounded-xl px-3 py-2.5 transition-colors bg-white ${emergencyPhone.replace(/\D/g, '').length === 10
                      ? 'border-green-500'
                      : emergencyPhone.length > 0
                        ? 'border-red-400'
                        : 'border-gray-300'
                      }`}>
                      <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">+63</span>
                      <div className="w-px h-4 bg-gray-300" />
                      <input
                        type="tel"
                        placeholder="9XX XXX XXXX"
                        value={emergencyPhone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').replace(/^0/, '').slice(0, 10);
                          setEmergencyPhone(digits);
                        }}
                        maxLength={10}
                        className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Participants Roster Builder */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Participant Roster ({participants.length} / {groupSize})
                  </h3>
                  {participants.length < trailMeta.maxCapacityPerSlot && (
                    <button
                      type="button"
                      onClick={() => handleGroupSizeChange(groupSize + 1)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Participant
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {participants.map((p, idx) => {
                    const ocrState = ocrScanningState[idx];
                    const hasValidIdFile = !!participantDocs[idx]?.validId;
                    const validIdMatchStatus = (hasValidIdFile && ocrState && !ocrState.isScanning && ocrState.hasScanned)
                      ? checkIdNameMatch(p.fullName, ocrState.detectedName, ocrState.rawText)
                      : null;

                    return (
                      <div
                        key={idx}
                        className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs relative"
                      >
                        <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                            Participant #{idx + 1}
                          </span>
                          {participants.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeParticipant(idx)}
                              className="text-gray-400 hover:text-red-500 p-1"
                              title="Remove participant"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="sm:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-gray-600 font-semibold text-xs">Full Name *</label>
                              {validIdMatchStatus && (
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${validIdMatchStatus.isMatch
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : "bg-red-100 text-red-800 border-red-300 animate-pulse"
                                    }`}
                                >
                                  {validIdMatchStatus.isMatch ? "✓ Matches ID" : "⚠️ Does not match ID"}
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              placeholder="Full name as shown on ID"
                              value={p.fullName}
                              onChange={(e) => updateParticipant(idx, "fullName", e.target.value)}
                              className={`w-full border rounded-lg p-2 text-xs transition-colors outline-none focus:ring-2 ${!validIdMatchStatus
                                  ? "border-gray-300 focus:ring-emerald-500"
                                  : validIdMatchStatus.isMatch
                                    ? "border-emerald-500 bg-emerald-50/25 text-emerald-950 focus:ring-emerald-500"
                                    : "border-red-500 bg-red-50/25 text-red-950 focus:ring-red-400"
                                }`}
                              required
                            />
                            {validIdMatchStatus && !validIdMatchStatus.isMatch && (
                              <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                The government ID must be visible and match this name.
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-gray-600 font-semibold mb-1">Age *</label>
                            <input
                              type="number"
                              min={10}
                              max={85}
                              value={p.age}
                              onChange={(e) => updateParticipant(idx, "age", Number(e.target.value))}
                              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-gray-600 font-semibold mb-1">Contact Number</label>
                            <div className={`flex items-center gap-2 border-2 rounded-xl px-3 py-2 transition-colors bg-white ${p.contactNumber.replace(/\D/g, '').length === 10
                              ? 'border-green-500'
                              : p.contactNumber.length > 0
                                ? 'border-red-400'
                                : 'border-gray-300'
                              }`}>
                              <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">+63</span>
                              <div className="w-px h-4 bg-gray-300" />
                              <input
                                type="tel"
                                placeholder="9XX XXX XXXX"
                                value={p.contactNumber}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/\D/g, '').replace(/^0/, '').slice(0, 10);
                                  updateParticipant(idx, "contactNumber", digits);
                                }}
                                maxLength={10}
                                className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
                              />
                            </div>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-gray-600 font-semibold mb-1">
                              Medical Conditions / Allergies / Notes
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Asthma, hypertension, none"
                              value={p.medicalConditions}
                              onChange={(e) => updateParticipant(idx, "medicalConditions", e.target.value)}
                              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* 3 Required Documents for Participant #{idx + 1} */}
                        <div className="mt-5 pt-4 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-emerald-700" />
                              Participant #{idx + 1} Required Documents
                            </span>
                            <a
                              href="/DENR_NNNP_Trekking_Waiver.docx"
                              download="DENR_NNNP_Trekking_Waiver.docx"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                            >
                              <Download className="w-3 h-3" />
                              Download Waiver (.docx)
                            </a>
                          </div>

                          {/* Tesseract OCR live banner for participant */}
                          {ocrState?.isScanning && (
                            <div className="mt-2 mb-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs animate-pulse">
                              <span className="flex items-center gap-2 font-bold text-emerald-950">
                                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                                Tesseract OCR Scanning ID: {ocrState.status}
                              </span>
                              <span className="font-extrabold text-emerald-700 tabular-nums">
                                {ocrState.progress}%
                              </span>
                            </div>
                          )}

                          {!ocrState?.isScanning && (ocrState?.detectedName || ocrState?.detectedIdType || ocrState?.hasScanned) && (
                            <div
                              className={`mt-2 mb-3 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs border ${validIdMatchStatus?.isMatch
                                  ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 text-emerald-950"
                                  : "bg-gradient-to-r from-red-50 to-rose-50 border-red-300 text-red-950"
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                {validIdMatchStatus?.isMatch ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                                )}
                                <div>
                                  <span className={`font-bold ${validIdMatchStatus?.isMatch ? "text-emerald-900" : "text-red-900"}`}>
                                    {validIdMatchStatus?.isMatch ? "✓ ID Verified & Matched: " : "⚠️ ID Name Mismatch: "}
                                  </span>
                                  <span className="font-semibold">
                                    {ocrState.detectedName || "Valid ID"}
                                  </span>
                                  {ocrState.detectedIdType && (
                                    <span className={validIdMatchStatus?.isMatch ? "text-slate-600 font-medium" : "text-red-700/80 font-medium"}>
                                      {" "}• {ocrState.detectedIdType}
                                    </span>
                                  )}
                                  {ocrState.detectedAge && (
                                    <span className={validIdMatchStatus?.isMatch ? "text-slate-600 font-medium" : "text-red-700/80 font-medium"}>
                                      {" "}• {ocrState.detectedAge} yrs old
                                    </span>
                                  )}
                                  {!validIdMatchStatus?.isMatch && (
                                    <span className="text-red-700 font-semibold block sm:inline sm:ml-1">
                                      • The ID must be visible, legible, and match "{p.fullName}".
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setOcrModal({
                                    isOpen: true,
                                    file: participantDocs[idx]?.validId || null,
                                    participantIdx: idx,
                                    label: `Participant #${idx + 1} Valid Government ID`,
                                    expectedName: p.fullName,
                                  })
                                }
                                className={`text-[11px] font-bold underline flex items-center gap-1 ${validIdMatchStatus?.isMatch
                                    ? "text-emerald-800 hover:text-emerald-950"
                                    : "text-red-800 hover:text-red-950"
                                  }`}
                              >
                                <ScanText className="w-3.5 h-3.5" /> Inspect OCR Stream
                              </button>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                            <DocumentUploadField
                              label="1. Valid Government ID *"
                              file={participantDocs[idx]?.validId || null}
                              onChange={(f) => updateParticipantDoc(idx, "validId", f)}
                              onScanOcr={() =>
                                setOcrModal({
                                  isOpen: true,
                                  file: participantDocs[idx]?.validId || null,
                                  participantIdx: idx,
                                  label: `Participant #${idx + 1} Valid Government ID`,
                                  expectedName: p.fullName,
                                })
                              }
                              statusVariant={
                                !validIdMatchStatus
                                  ? "default"
                                  : validIdMatchStatus.isMatch
                                    ? "success"
                                    : "error"
                              }
                              statusMessage={
                                !validIdMatchStatus
                                  ? undefined
                                  : validIdMatchStatus.isMatch
                                    ? "Name Matches ID ✓"
                                    : "ID Mismatch • Must Be Visible"
                              }
                              accept=".pdf,.jpg,.jpeg,.png"
                            />
                            <DocumentUploadField
                              label="2. Signed DENR Waiver *"
                              file={participantDocs[idx]?.waiver || null}
                              onChange={(f) => updateParticipantDoc(idx, "waiver", f)}
                              accept=".pdf,.jpg,.jpeg,.png"
                              downloadUrl="/DENR_NNNP_Trekking_Waiver.docx"
                              downloadLabel="Download (.docx)"
                            />
                            <DocumentUploadField
                              label="3. Fit-to-Climb Med Cert *"
                              file={participantDocs[idx]?.medCert || null}
                              onChange={(f) => updateParticipantDoc(idx, "medCert", f)}
                              onScanOcr={() =>
                                setOcrModal({
                                  isOpen: true,
                                  file: participantDocs[idx]?.medCert || null,
                                  participantIdx: idx,
                                  label: `Participant #${idx + 1} Fit-to-Climb Med Cert`,
                                  expectedName: p.fullName,
                                })
                              }
                              accept=".pdf,.jpg,.jpeg,.png"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  General Group Trekking Notes or Special Equipment Requests
                </label>
                <textarea
                  rows={2}
                  placeholder="Any special accommodations or questions for the DENR outpost ranger..."
                  value={medicalNotes}
                  onChange={(e) => setMedicalNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-sm"
                >
                  Next: Review & Submit <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 5: DOCUMENT REVIEW & FINAL CONFIRMATION */}
          {/* ======================================================== */}
          {step === 5 && (
            <form onSubmit={handleFinalSubmit} className="space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-emerald-700" />
                  5. Document Review & Final Submission
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Review the 3 required documents for each trekker and verify booking details before finalizing.
                </p>
              </div>

              {/* Participant Documents Review Section (Waiver banner removed) */}
              <div className="space-y-4">
                {participants.map((p, idx) => {
                  const docs = participantDocs[idx];
                  const hasAllDocs = docs?.validId && docs?.waiver && docs?.medCert;
                  return (
                    <div key={idx} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs">
                      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2.5">
                        <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-700" />
                          Participant #{idx + 1}: {p.fullName || "Unnamed Trekker"}
                        </span>
                        {hasAllDocs ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> All 3 Files Ready
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600" /> Incomplete
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <DocumentReviewCard
                          label="1. Valid Government ID *"
                          file={docs?.validId || null}
                          onPreview={handleOpenPreview}
                          onChangeFile={(f) => updateParticipantDoc(idx, "validId", f)}
                          onScanOcr={() =>
                            setOcrModal({
                              isOpen: true,
                              file: docs?.validId || null,
                              participantIdx: idx,
                              label: `Participant #${idx + 1} Valid Government ID`,
                              expectedName: p.fullName,
                            })
                          }
                          accept=".pdf,.jpg,.jpeg,.png"
                        />
                        <DocumentReviewCard
                          label="2. Signed DENR Waiver *"
                          file={docs?.waiver || null}
                          onPreview={handleOpenPreview}
                          onChangeFile={(f) => updateParticipantDoc(idx, "waiver", f)}
                          onScanOcr={() =>
                            setOcrModal({
                              isOpen: true,
                              file: docs?.waiver || null,
                              participantIdx: idx,
                              label: `Participant #${idx + 1} Signed DENR Waiver`,
                              expectedName: p.fullName,
                            })
                          }
                          accept=".pdf,.jpg,.jpeg,.png"
                        />
                        <DocumentReviewCard
                          label="3. Fit-to-Climb Med Cert *"
                          file={docs?.medCert || null}
                          onPreview={handleOpenPreview}
                          onChangeFile={(f) => updateParticipantDoc(idx, "medCert", f)}
                          onScanOcr={() =>
                            setOcrModal({
                              isOpen: true,
                              file: docs?.medCert || null,
                              participantIdx: idx,
                              label: `Participant #${idx + 1} Fit-to-Climb Med Cert`,
                              expectedName: p.fullName,
                            })
                          }
                          accept=".pdf,.jpg,.jpeg,.png"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Card */}
              <div className="bg-emerald-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <h3 className="text-lg font-black tracking-tight text-white mb-4 border-b border-emerald-800 pb-2">
                  Booking Summary Review
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-emerald-300 font-semibold uppercase">Trail Destination</span>
                    <p className="font-bold text-base text-white">{selectedTrailObj?.name || trailMeta.name}</p>
                    <p className="text-xs text-emerald-200 mt-0.5">
                      Elevation: {trailMeta.elevation}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-emerald-300 font-semibold uppercase">
                      Starting Climb & Descent Date
                    </span>
                    <p className="font-bold text-base text-white">
                      {descentDate && descentDate !== climbDate
                        ? `${climbDate} → ${descentDate}`
                        : `${climbDate} (1-Day Dayhike)`}
                    </p>
                    <p className="text-xs text-emerald-200 mt-0.5">
                      {selectedTimeSlot}
                      <span>
                        {" • "}
                        {descentDate && descentDate !== climbDate
                          ? `${Math.max(2, Math.round((new Date(descentDate).getTime() - new Date(climbDate).getTime()) / 86400000) + 1)} Days / ${Math.max(1, Math.round((new Date(descentDate).getTime() - new Date(climbDate).getTime()) / 86400000))}N`
                          : "Same-Day Dayhike"}
                      </span>
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-emerald-300 font-semibold uppercase">Tour Guide Assignment</span>
                    <p className="font-bold text-white">
                      {guides.find((g) => g.id === guideId)?.full_name || "Assigned Guide"}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-emerald-300 font-semibold uppercase">Total Participants</span>
                    <p className="font-bold text-white">
                      {groupSize} Trekkers {foreignCount > 0 ? `(${foreignCount} foreign)` : ""}
                    </p>
                    <p className="text-xs text-emerald-200 mt-0.5">
                      Emergency: {emergencyName} ({emergencyPhone})
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-emerald-800 flex items-center justify-between text-xs">
                  <span className="text-emerald-300">
                    Required Documents Status:
                  </span>
                  {participants.every((_, i) => participantDocs[i]?.validId && participantDocs[i]?.waiver && participantDocs[i]?.medCert) ? (
                    <span className="text-emerald-200 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> All {participants.length * 3} Files Ready ({participants.length} pax)
                    </span>
                  ) : (
                    <span className="text-amber-300 font-bold flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      {participants.filter((_, i) => participantDocs[i]?.validId && participantDocs[i]?.waiver && participantDocs[i]?.medCert).length} / {participants.length} Trekkers Ready
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={loading || uploading}
                  className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl transition flex justify-center items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={loading || uploading}
                  className="w-2/3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-xl transition flex justify-center items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <UploadCloud className="w-5 h-5 animate-pulse" />
                      Uploading Documents...
                    </>
                  ) : loading ? (
                    "Processing Booking..."
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Confirm & Submit Booking
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* TREKKER DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={handleClosePreview}
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50/80">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 text-base line-clamp-1">{previewDoc.label}</h3>
                  <p className="text-xs text-gray-500 truncate">
                    {previewDoc.file.name} • {(previewDoc.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClosePreview}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition shrink-0 ml-3"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-900/5 flex items-center justify-center min-h-[300px]">
              {previewDoc.isImage ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.label}
                  className="max-h-[65vh] max-w-full rounded-xl object-contain shadow-sm border border-gray-200"
                />
              ) : (
                <div className="w-full h-[65vh] flex flex-col items-center justify-center gap-4 bg-white rounded-2xl p-4 border border-gray-200">
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.label}
                    className="w-full h-full rounded-xl border border-gray-200"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-100 bg-white">
              <span className="text-xs text-gray-500 font-medium hidden sm:inline">
                Official Trekker Document Review
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <a
                  href={previewDoc.url}
                  download={previewDoc.file.name}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TESSERACT OCR INSPECTION & AUTO-FILL MODAL */}
      {ocrModal && (
        <OcrInspectionModal
          isOpen={ocrModal.isOpen}
          onClose={() => setOcrModal(null)}
          imageSource={ocrModal.file}
          documentTitle={ocrModal.label}
          expectedName={ocrModal.expectedName}
          onApplyExtracted={(data) => {
            if (ocrModal.participantIdx !== undefined) {
              const idx = ocrModal.participantIdx;
              const pName = participants[idx]?.fullName || "";
              const matchCheck = checkIdNameMatch(
                pName || data.detectedName || "",
                data.detectedName,
                data.rawText
              );

              setOcrScanningState((prev) => ({
                ...prev,
                [idx]: {
                  isScanning: false,
                  progress: 100,
                  status: matchCheck.isMatch ? "Verified" : "Mismatch",
                  detectedName: data.detectedName,
                  detectedAge: data.detectedAge,
                  detectedGender: data.detectedGender,
                  detectedIdType: data.detectedIdType,
                  detectedIdNumber: data.detectedIdNumber,
                  rawText: data.rawText,
                  confidence: data.confidence,
                  hasScanned: true,
                  isMatch: matchCheck.isMatch,
                },
              }));

              setParticipants((prev) => {
                const copy = [...prev];
                if (copy[idx]) {
                  copy[idx] = {
                    ...copy[idx],
                    fullName: data.detectedName || copy[idx].fullName,
                    age: data.detectedAge || copy[idx].age,
                    gender: data.detectedGender || copy[idx].gender,
                    ocrVerification: {
                      verified: matchCheck.isMatch,
                      confidence: data.confidence,
                      detectedName: data.detectedName,
                      detectedIdType: data.detectedIdType,
                      detectedIdNumber: data.detectedIdNumber,
                      detectedAge: data.detectedAge,
                      detectedGender: data.detectedGender,
                      verifiedAt: new Date().toISOString(),
                      rawTextPreview: data.rawText ? data.rawText.slice(0, 300) : "",
                    },
                  };
                }
                return copy;
              });

              if (matchCheck.isMatch) {
                toast.success(`Participant #${idx + 1} ID verified! Name matches profile ✓`);
              } else {
                toast.error(
                  `Participant #${idx + 1}: The government ID must be visible and match "${pName}". Please upload a legible ID.`,
                  { duration: 7000 }
                );
              }
            }
          }}
        />
      )}

      {/* CONFIRMATION VOUCHER MODAL */}
      {createdVoucher && (
        <BookingVoucherModal
          isOpen={showVoucherModal}
          onClose={() => {
            setShowVoucherModal(false);
            navigate("/my-bookings");
          }}
          booking={createdVoucher}
        />
      )}
    </div>
  );
}
