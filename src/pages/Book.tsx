import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { 
  UploadCloud, CheckCircle2, FileText, X, ArrowRight, ArrowLeft, 
  MapPin, Mountain, Calendar, Clock, Users, ShieldAlert, Plus, Trash2,
  Compass, CheckCircle, AlertCircle, ExternalLink, Download
} from "lucide-react";
import { WeatherWidget } from "@/components/WeatherWidget";
import { BookingVoucherModal } from "@/components/BookingVoucherModal";
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
}

function DocumentUploadField({ label, file, onChange, accept, downloadUrl, downloadLabel }: DocumentUploadFieldProps) {
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
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[120px] ${
          file 
            ? "border-emerald-400 bg-emerald-50/50" 
            : "border-gray-200 hover:border-emerald-500 hover:bg-gray-50 bg-white"
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
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mb-2" />
            <span className="text-sm font-medium text-emerald-800 truncate w-full px-2" title={file.name}>
              {file.name}
            </span>
            <span className="text-xs text-emerald-600 mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
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

export default function Book() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTrailId = searchParams.get("trailId");

  const [step, setStep] = useState(1);

  // Trails state - ⚡ INSTANT CACHED LOAD
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
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[0]);
  const [slotCapacity, setSlotCapacity] = useState<{ booked: number; available: number; isFull: boolean } | null>(null);
  const [checkingCapacity, setCheckingCapacity] = useState(false);

  // Guide selection state
  const [guideId, setGuideId] = useState("");
  const [guides, setGuides] = useState<any[]>([]);
  const [fetchingGuides, setFetchingGuides] = useState(false);
  const [autoAssignGuide, setAutoAssignGuide] = useState(false);

  // Group Information & Participants
  const [groupSize, setGroupSize] = useState(1);
  const [foreignCount, setForeignCount] = useState(0);
  const [organization, setOrganization] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");

  const [participants, setParticipants] = useState<ParticipantInput[]>([
    {
      fullName: "",
      age: 25,
      gender: "Male",
      contactNumber: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      medicalConditions: "None",
    },
  ]);

  // Documents
  const [validIdFile, setValidIdFile] = useState<File | null>(null);
  const [waiverFile, setWaiverFile] = useState<File | null>(null);
  const [medicalCertFile, setMedicalCertFile] = useState<File | null>(null);

  // Submission state & Voucher modal
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [createdVoucher, setCreatedVoucher] = useState<any | null>(null);
  const [showVoucherModal, setShowVoucherModal] = useState(false);

  // Lead time requirement: at least 14 days in advance
  const getMinDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split("T")[0];
  };
  const minAllowedDate = getMinDate();

  // 1. Fetch Trails
  useEffect(() => {
    const fetchTrails = async () => {
      const cached = getCached<Trail[]>("nnnp_trails");
      if (cached && cached.length > 0) {
        setTrails(cached);
        if (!initialTrailId && !trailId) setTrailId(cached[0].id);
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
          if (data.length > 0 && !initialTrailId && !trailId) setTrailId(data[0].id);
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
  };

  const updateParticipant = (index: number, field: keyof ParticipantInput, value: any) => {
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const uploadFile = async (file: File, type: string) => {
    if (!user) throw new Error("Not authenticated");
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}_${Date.now()}_${type}.${fileExt}`;
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
        alert("Please choose a climb date.");
        return false;
      }
      if (climbDate < minAllowedDate) {
        alert("DENR policy requires booking at least 2 weeks in advance.");
        return false;
      }
      if (slotCapacity && slotCapacity.isFull) {
        alert("This time slot is fully booked. Please select another date or time slot.");
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      if (!autoAssignGuide && !guideId) {
        alert("Please choose a tour guide, or check 'Request DENR Auto-Assignment'.");
        return false;
      }
      return true;
    }

    if (currentStep === 4) {
      if (!emergencyName || !emergencyPhone) {
        alert("Please enter the primary emergency contact name and phone number.");
        return false;
      }
      // Check participant names
      for (let i = 0; i < participants.length; i++) {
        if (!participants[i].fullName.trim()) {
          alert(`Please fill in the full name for participant #${i + 1}.`);
          return false;
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

    if (!validIdFile || !waiverFile || !medicalCertFile) {
      alert("Please upload all three required documents: Valid ID, Signed Waiver, and Medical Certificate.");
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      const validIdUrl = await uploadFile(validIdFile, "valid_id");
      const waiverUrl = await uploadFile(waiverFile, "waiver");
      const medicalCertUrl = await uploadFile(medicalCertFile, "medical_cert");

      setUploading(false);

      const chosenGuide = guides.find((g) => g.id === guideId);

      const bookingRecord = await createOnlineBooking({
        userId: user!.id,
        trailId,
        trailName: selectedTrailObj?.name || trailMeta.name,
        trekkingDate: climbDate,
        timeSlot: selectedTimeSlot,
        participantsCount: groupSize,
        guideId: autoAssignGuide ? null : guideId || null,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
        medicalNotes: medicalNotes,
        participants: participants,
        validIdUrl,
        waiverUrl,
        medicalCertUrl,
      });

      // Prepare confirmation voucher
      setCreatedVoucher({
        referenceNumber: bookingRecord.reference_number || `NNNP-${new Date().getFullYear()}-REF`,
        trailName: selectedTrailObj?.name || trailMeta.name,
        climbDate,
        timeSlot: selectedTimeSlot,
        groupSize,
        guideName: autoAssignGuide ? "DENR Auto-Assigned Guide" : chosenGuide?.full_name || "Assigned Guide",
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
        participants,
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
              { num: 5, label: "Review & Docs" },
            ].map((s) => (
              <div
                key={s.num}
                onClick={() => s.num < step && setStep(s.num)}
                className={`flex flex-col items-center gap-1.5 transition-all ${
                  s.num <= step ? "text-emerald-700" : "text-gray-400"
                } ${s.num < step ? "cursor-pointer hover:opacity-80" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    s.num === step
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
                  Choose your protected trail. Review trailhead elevation, difficulty, and live atmospheric conditions.
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
                      className={`cursor-pointer rounded-2xl overflow-hidden border-2 transition-all text-left flex flex-col justify-between ${
                        isSelected
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
                        <div className="absolute top-3 left-3">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs ${
                              meta.difficulty === "Challenging"
                                ? "bg-red-600 text-white"
                                : meta.difficulty === "Moderate"
                                ? "bg-amber-600 text-white"
                                : "bg-emerald-600 text-white"
                            }`}
                          >
                            {meta.difficulty}
                          </span>
                        </div>
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
                  DENR regulations require a minimum 2-week advance booking notice for environmental safety and guide scheduling.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Trekking Date *
                  </label>
                  <input
                    type="date"
                    min={minAllowedDate}
                    value={climbDate}
                    onChange={(e) => setClimbDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-xs text-sm"
                    required
                  />
                  <span className="text-xs text-gray-500 mt-1.5 block">
                    Earliest available date: <strong>{new Date(minAllowedDate).toLocaleDateString()}</strong> (14-day lead requirement)
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Designated Time Slot *
                  </label>
                  <select
                    value={selectedTimeSlot}
                    onChange={(e) => setSelectedTimeSlot(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-3.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-xs text-sm"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-500 mt-1.5 block">
                    Departures are strictly staggered to minimize wildlife disturbance.
                  </span>
                </div>
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
                        </span>
                        <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${
                          slotCapacity.isFull ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {slotCapacity.available} slots remaining / Max {trailMeta.maxCapacityPerSlot}
                        </span>
                      </div>

                      <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            slotCapacity.isFull ? "bg-red-500" : "bg-emerald-600"
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
                  Choose a licensed DENR-accredited local guide, or opt for DENR automatic dispatch.
                </p>
              </div>

              {/* Auto-assign toggle */}
              <div
                onClick={() => {
                  setAutoAssignGuide(!autoAssignGuide);
                  if (!autoAssignGuide) setGuideId("");
                }}
                className={`cursor-pointer border-2 rounded-2xl p-4 transition-all flex items-center justify-between ${
                  autoAssignGuide
                    ? "border-emerald-600 bg-emerald-50/60 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                    autoAssignGuide ? "bg-emerald-600 border-emerald-600 text-white" : "border-gray-300"
                  }`}>
                    {autoAssignGuide && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">
                      Request DENR Automatic Guide Assignment
                    </h4>
                    <p className="text-xs text-gray-500">
                      The park administration will assign an accredited certified guide suited to your group size and schedule.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-full shrink-0">
                  Recommended
                </span>
              </div>

              {!autoAssignGuide && (
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
                        All independent guides have active treks scheduled for this date. You can enable 
                        <strong> "Request DENR Automatic Guide Assignment"</strong> above to have an on-duty ranger assigned.
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
                                setAutoAssignGuide(false);
                              }
                            }}
                            className={`rounded-2xl p-4 border-2 transition-all flex flex-col justify-between ${
                              !isAvail
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
              )}

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
                    <input
                      type="tel"
                      placeholder="+63 9XX XXX XXXX"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                      required
                    />
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
                  {participants.map((p, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs relative"
                    >
                      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                          Participant #{idx + 1} {idx === 0 ? "(Lead Trekker)" : ""}
                        </span>
                        {participants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleGroupSizeChange(groupSize - 1)}
                            className="text-gray-400 hover:text-red-500 p-1"
                            title="Remove participant"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="sm:col-span-2">
                          <label className="block text-gray-600 font-semibold mb-1">Full Name *</label>
                          <input
                            type="text"
                            placeholder="Full name as shown on ID"
                            value={p.fullName}
                            onChange={(e) => updateParticipant(idx, "fullName", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                            required
                          />
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
                          <input
                            type="tel"
                            placeholder="09XXXXXXXXX"
                            value={p.contactNumber}
                            onChange={(e) => updateParticipant(idx, "contactNumber", e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
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
                    </div>
                  ))}
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
                  Next: Review & Documents <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 5: DOCUMENT UPLOAD & FINAL SUMMARY REVIEW */}
          {/* ======================================================== */}
          {step === 5 && (
            <form onSubmit={handleFinalSubmit} className="space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-emerald-700" />
                  5. Document Requirements & Final Review
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Upload required permits documentation and review booking details before submitting.
                </p>
              </div>

              {/* Waiver Download Notice Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                    <FileText className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">Official DENR Trekking Waiver Form</h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Need the blank waiver form? Download it here, complete and sign it with all participants, then upload the file below.
                    </p>
                  </div>
                </div>
                <a
                  href="/DENR_NNNP_Trekking_Waiver.docx"
                  download="DENR_NNNP_Trekking_Waiver.docx"
                  className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm shrink-0 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  Download Waiver (.docx)
                </a>
              </div>

              {/* Uploads */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <DocumentUploadField
                  label="1. Valid Government ID *"
                  file={validIdFile}
                  onChange={setValidIdFile}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                <DocumentUploadField
                  label="2. Signed DENR Waiver *"
                  file={waiverFile}
                  onChange={setWaiverFile}
                  accept=".pdf,.jpg,.jpeg,.png"
                  downloadUrl="/DENR_NNNP_Trekking_Waiver.docx"
                  downloadLabel="Download (.docx)"
                />
                <DocumentUploadField
                  label="3. Fit-to-Climb Med Cert *"
                  file={medicalCertFile}
                  onChange={setMedicalCertFile}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
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
                      Elevation: {trailMeta.elevation} • Difficulty: {trailMeta.difficulty}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-emerald-300 font-semibold uppercase">Date & Staggered Slot</span>
                    <p className="font-bold text-base text-white">{climbDate}</p>
                    <p className="text-xs text-emerald-200 mt-0.5">{selectedTimeSlot}</p>
                  </div>

                  <div>
                    <span className="text-xs text-emerald-300 font-semibold uppercase">Tour Guide Assignment</span>
                    <p className="font-bold text-white">
                      {autoAssignGuide
                        ? "DENR Auto-Assigned Guide"
                        : guides.find((g) => g.id === guideId)?.full_name || "Assigned Guide"}
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
                  {validIdFile && waiverFile && medicalCertFile ? (
                    <span className="text-emerald-200 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> All 3 Files Ready
                    </span>
                  ) : (
                    <span className="text-amber-300 font-bold flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-amber-400" /> Files Pending
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
