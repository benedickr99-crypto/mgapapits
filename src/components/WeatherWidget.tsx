import { useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, Wind, Droplets, AlertTriangle, CheckCircle2, ShieldAlert, RefreshCw } from "lucide-react";
import { fetchTrailWeather, type TrailheadWeather } from "@/lib/weather";

interface WeatherWidgetProps {
  lat: number;
  lng: number;
  trailName: string;
  compact?: boolean;
}

export const WeatherWidget = ({ lat, lng, trailName, compact = false }: WeatherWidgetProps) => {
  const [weather, setWeather] = useState<TrailheadWeather | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchTrailWeather(lat, lng, trailName);
    setWeather(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [lat, lng, trailName]);

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur border rounded-xl p-4 animate-pulse flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-gray-400 animate-bounce" />
          <span>Fetching trailhead live weather...</span>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  const { current, forecast } = weather;

  if (compact) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs hover:shadow-sm transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {current.weatherCode >= 51 ? (
              <CloudRain className="w-5 h-5 text-blue-500" />
            ) : current.weatherCode === 0 ? (
              <Sun className="w-5 h-5 text-amber-500" />
            ) : (
              <Cloud className="w-5 h-5 text-slate-500" />
            )}
            <div>
              <span className="font-semibold text-gray-900">{current.temperature}°C</span>
              <span className="text-xs text-gray-500 ml-1.5 font-normal">{current.condition}</span>
            </div>
          </div>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${current.advisory.badgeColor}`}>
            {current.advisory.level}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden border border-slate-700">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Live Trailhead Forecast
            </span>
            <span className="text-[10px] bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded-full">
              Open-Meteo
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-0.5">{trailName}</h3>
        </div>
        <button
          onClick={loadData}
          title="Refresh weather"
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 relative z-10">
        <div className="bg-slate-800/80 backdrop-blur rounded-xl p-3 border border-slate-700/60">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            {current.weatherCode >= 51 ? (
              <CloudRain className="w-4 h-4 text-blue-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
            Temperature
          </div>
          <div className="text-2xl font-black text-white">{current.temperature}°C</div>
          <div className="text-[11px] text-slate-400">Feels like {current.apparentTemperature}°C</div>
        </div>

        <div className="bg-slate-800/80 backdrop-blur rounded-xl p-3 border border-slate-700/60">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Droplets className="w-4 h-4 text-sky-400" />
            Humidity
          </div>
          <div className="text-2xl font-black text-white">{current.humidity}%</div>
          <div className="text-[11px] text-slate-400">Relative humidity</div>
        </div>

        <div className="bg-slate-800/80 backdrop-blur rounded-xl p-3 border border-slate-700/60">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Wind className="w-4 h-4 text-teal-400" />
            Wind
          </div>
          <div className="text-2xl font-black text-white">{current.windSpeed} <span className="text-xs font-normal">km/h</span></div>
          <div className="text-[11px] text-slate-400">Ridge speed</div>
        </div>

        <div className="bg-slate-800/80 backdrop-blur rounded-xl p-3 border border-slate-700/60 flex flex-col justify-center">
          <div className="text-xs text-slate-400 mb-1">Condition</div>
          <div className="text-sm font-semibold text-white leading-tight">{current.condition}</div>
        </div>
      </div>

      {/* Safety Advisory Banner */}
      <div className={`p-3 rounded-xl mb-4 flex items-start gap-2.5 text-xs border ${
        current.advisory.level === "Safe" 
          ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200" 
          : current.advisory.level === "Caution" 
          ? "bg-amber-950/60 border-amber-500/40 text-amber-200" 
          : "bg-red-950/60 border-red-500/40 text-red-200"
      }`}>
        {current.advisory.level === "Safe" ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        ) : current.advisory.level === "Caution" ? (
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        )}
        <div>
          <span className="font-bold mr-1.5">[{current.advisory.level} Advisory]:</span>
          {current.advisory.message}
        </div>
      </div>

      {/* 5-Day Outlook */}
      <div>
        <div className="text-xs font-semibold text-slate-400 mb-2">Upcoming Days Forecast</div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {forecast.slice(0, 5).map((f, i) => (
            <div key={i} className="bg-slate-800/50 rounded-lg p-2 text-center border border-slate-700/30">
              <div className="text-[10px] text-slate-400 font-medium">
                {i === 0 ? "Today" : new Date(f.date).toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div className="text-xs font-bold text-white my-1">
                {f.maxTemp}° / <span className="text-slate-400 font-normal">{f.minTemp}°</span>
              </div>
              <div className="text-[10px] text-blue-300 flex items-center justify-center gap-0.5">
                <Droplets className="w-2.5 h-2.5" />
                {f.precipitationProb}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
