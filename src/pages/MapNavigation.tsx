import { useState } from "react";
import { MapPin, Navigation, Compass, ExternalLink, Mountain, AlertCircle, ArrowRight } from "lucide-react";
import { NNNP_TRAILS_METADATA } from "@/lib/trailData";
import { WeatherWidget } from "@/components/WeatherWidget";
import { Link } from "react-router-dom";

export default function MapNavigation() {
  const [selectedTrailKey, setSelectedTrailKey] = useState<string>("mt-mandalagan");
  const trail = NNNP_TRAILS_METADATA[selectedTrailKey];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100/70 px-3.5 py-1.5 rounded-full mb-3 shadow-2xs">
            <Navigation className="w-3.5 h-3.5" /> Trailhead Wayfinding & GPS
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight">
            Trailhead Navigation & Meeting Points
          </h1>
          <p className="text-sm md:text-base text-gray-600 mt-2">
            Get accurate turn-by-turn driving directions to official DENR ranger stations and orientation checkpoints across Northern Negros.
          </p>
        </div>

        {/* Trail Selector Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(NNNP_TRAILS_METADATA).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setSelectedTrailKey(key)}
              className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col gap-2 ${
                selectedTrailKey === key
                  ? "border-emerald-600 bg-emerald-50/60 shadow-md ring-2 ring-emerald-600/20"
                  : "border-gray-200 hover:border-emerald-300 bg-white"
              }`}
            >
              <div className="h-28 w-full rounded-xl overflow-hidden bg-slate-100">
                <img src={t.imageUrl} alt={t.name} className="w-full h-full object-cover object-center" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  {t.mountain}
                </span>
                <h3 className="font-bold text-gray-900 text-xs mt-0.5 truncate">{t.alias || t.name}</h3>
                <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" /> {t.city}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Trail Details & Live Weather */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Meeting Point Card */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-200 space-y-6">
            {/* Trail Photo Banner */}
            <div className="relative h-48 sm:h-60 rounded-2xl overflow-hidden shadow-xs">
              <img
                src={trail.imageUrl}
                alt={trail.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-5">
                <div>
                  <span className="text-xs font-bold text-white bg-emerald-700/90 px-3 py-1 rounded-full uppercase tracking-wider">
                    {trail.difficulty} • {trail.elevation}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5 drop-shadow-sm">{trail.name}</h2>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                  Official Meeting Point
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  GPS: {trail.lat.toFixed(4)}° N, {trail.lng.toFixed(4)}° E
                </span>
              </div>
              <h2 className="text-2xl font-black text-gray-900">{trail.meetingPoint.name}</h2>
              <p className="text-sm text-gray-600 mt-1">{trail.meetingPoint.address}</p>
            </div>

            {/* Landmark Box */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 text-xs space-y-1">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-700" />
                Key Navigation Landmark:
              </div>
              <p className="text-gray-700">{trail.meetingPoint.landmark}</p>
              <p className="text-gray-500 italic mt-1">{trail.meetingPoint.description}</p>
            </div>

            {/* One-Click Navigation Links */}
            <div className="flex flex-wrap gap-3">
              <a
                href={trail.navigationUrls.googleMaps}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 px-5 rounded-2xl text-xs transition shadow-md"
              >
                Open in Google Maps <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Interactive Embedded Map Preview */}
            <div className="rounded-2xl overflow-hidden border border-gray-200 h-64 relative bg-slate-100 shadow-inner">
              <iframe
                title="Trailhead OpenStreetMap Location"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight={0}
                marginWidth={0}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${trail.lng - 0.04}%2C${trail.lat - 0.04}%2C${trail.lng + 0.04}%2C${trail.lat + 0.04}&layer=mapnik&marker=${trail.lat}%2C${trail.lng}`}
              />
            </div>

            {/* Trail Quick Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 block font-semibold">Elevation</span>
                <span className="font-bold text-gray-900">{trail.elevation}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 block font-semibold">Difficulty</span>
                <span className="font-bold text-gray-900">{trail.difficulty}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 block font-semibold">Trail Length</span>
                <span className="font-bold text-gray-900">{trail.distance}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 block font-semibold">Est. Duration</span>
                <span className="font-bold text-gray-900">{trail.duration}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Weather & Book Button */}
          <div className="space-y-6">
            <WeatherWidget
              lat={trail.lat}
              lng={trail.lng}
              trailName={trail.name}
            />

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">
                Trail Safety Guidelines
              </h3>
              <ul className="space-y-2 text-xs text-gray-600">
                {trail.safetyGuidelines.map((g, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-2">
                <Link
                  to={`/booking`}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md"
                >
                  Book Permit for this Trail <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
