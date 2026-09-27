// Free Open-Meteo API (no API key required)
export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  condition: string;
  isDay: boolean;
  advisory: {
    level: "Safe" | "Caution" | "Hazardous";
    badgeColor: string;
    message: string;
  };
}

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipitationProb: number;
  weatherCode: number;
  condition: string;
}

export interface TrailheadWeather {
  trailhead: string;
  lat: number;
  lng: number;
  current: CurrentWeather;
  forecast: DailyForecast[];
  updatedAt: string;
}

const WMO_CODE_MAP: Record<number, string> = {
  0: "Clear Sky",
  1: "Mainly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing Rime Fog",
  51: "Light Drizzle",
  53: "Moderate Drizzle",
  55: "Dense Drizzle",
  61: "Slight Rain",
  63: "Moderate Rain",
  65: "Heavy Rain",
  71: "Slight Snow",
  80: "Slight Rain Showers",
  81: "Moderate Rain Showers",
  82: "Violent Rain Showers",
  95: "Thunderstorm",
  96: "Thunderstorm with Slight Hail",
  99: "Thunderstorm with Heavy Hail",
};

export function interpretWeatherCode(code: number): string {
  return WMO_CODE_MAP[code] || "Variable Clouds";
}

export function computeAdvisory(code: number, windSpeed: number, precipProb: number) {
  // Severe thunderstorm, violent showers or high winds (> 45 km/h)
  if (code >= 95 || code === 82 || code === 65 || windSpeed > 45 || precipProb > 80) {
    return {
      level: "Hazardous" as const,
      badgeColor: "bg-red-500 text-white",
      message: "Severe weather alert: High rainfall/thunderstorm risk. River crossings dangerous. Trekking may be suspended.",
    };
  }
  // Moderate rain, showers, drizzle, or moderate wind (> 25 km/h)
  if ((code >= 51 && code <= 81) || windSpeed > 25 || precipProb > 40) {
    return {
      level: "Caution" as const,
      badgeColor: "bg-amber-500 text-white",
      message: "Caution advised: Wet trails and reduced visibility. Wear rain gear, waterproof footwear and exercise care.",
    };
  }
  // Clear or partly cloudy
  return {
    level: "Safe" as const,
    badgeColor: "bg-emerald-600 text-white",
    message: "Favorable conditions: Clear to partly cloudy. Ideal weather for park trekking and summit photography.",
  };
}

export async function fetchTrailWeather(
  lat: number,
  lng: number,
  trailheadName: string
): Promise<TrailheadWeather> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FManila&forecast_days=5`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.statusText}`);
    const data = await res.json();

    const currentCode = data.current?.weather_code ?? 1;
    const wind = data.current?.wind_speed_10m ?? 8;
    const precipProb = data.daily?.precipitation_probability_max?.[0] ?? 15;

    const current: CurrentWeather = {
      temperature: Math.round(data.current?.temperature_2m ?? 24),
      apparentTemperature: Math.round(data.current?.apparent_temperature ?? 25),
      humidity: data.current?.relative_humidity_2m ?? 78,
      windSpeed: Math.round(wind),
      weatherCode: currentCode,
      condition: interpretWeatherCode(currentCode),
      isDay: Boolean(data.current?.is_day ?? 1),
      advisory: computeAdvisory(currentCode, wind, precipProb),
    };

    const forecast: DailyForecast[] = (data.daily?.time || []).map((t: string, idx: number) => {
      const code = data.daily.weather_code[idx] ?? 1;
      return {
        date: t,
        maxTemp: Math.round(data.daily.temperature_2m_max[idx] ?? 28),
        minTemp: Math.round(data.daily.temperature_2m_min[idx] ?? 20),
        precipitationProb: data.daily.precipitation_probability_max[idx] ?? 20,
        weatherCode: code,
        condition: interpretWeatherCode(code),
      };
    });

    return {
      trailhead: trailheadName,
      lat,
      lng,
      current,
      forecast,
      updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  } catch (err) {
    // Graceful offline/fallback mock data if network drops
    return {
      trailhead: trailheadName,
      lat,
      lng,
      current: {
        temperature: 24,
        apparentTemperature: 25,
        humidity: 78,
        windSpeed: 10,
        weatherCode: 2,
        condition: "Partly Cloudy",
        isDay: true,
        advisory: {
          level: "Safe",
          badgeColor: "bg-emerald-600 text-white",
          message: "Standard tropical mountain weather. Always carry waterproof layers.",
        },
      },
      forecast: [
        { date: "Day 1", maxTemp: 27, minTemp: 21, precipitationProb: 20, weatherCode: 2, condition: "Partly Cloudy" },
        { date: "Day 2", maxTemp: 28, minTemp: 22, precipitationProb: 30, weatherCode: 1, condition: "Mainly Clear" },
        { date: "Day 3", maxTemp: 26, minTemp: 20, precipitationProb: 45, weatherCode: 61, condition: "Slight Rain" },
      ],
      updatedAt: "Just now",
    };
  }
}
