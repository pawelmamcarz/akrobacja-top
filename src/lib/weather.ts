// Open-Meteo API — free, no key needed
// Checks VFR conditions for EPRP (Radom-Piastów)

const LAT = 51.3892;
const LON = 21.2133;

export interface WeatherStatus {
  flyable: boolean;
  reason?: string;
  visibility_km: number;
  cloud_base_m: number;
  wind_kmh: number;
  wind_gust_kmh: number;
  temp_c: number;
}

// Check weather for a specific date (returns hourly forecast)
export async function getWeatherForecast(dateStr: string): Promise<WeatherStatus[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=visibility,cloud_cover,wind_speed_10m,wind_gusts_10m,temperature_2m,weather_code&start_date=${dateStr}&end_date=${dateStr}&timezone=Europe%2FWarsaw`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as {
    hourly: {
      time: string[];
      visibility: number[];
      cloud_cover: number[];
      wind_speed_10m: number[];
      wind_gusts_10m: number[];
      temperature_2m: number[];
      weather_code: number[];
    };
  };

  const h = data.hourly;
  return h.time.map((time, i) => {
    const vis = (h.visibility[i] || 0) / 1000; // m -> km
    // Estimate cloud base from cloud cover (simplified)
    // Low cloud cover = high base, high cover = low base
    const cover = h.cloud_cover[i] || 0;
    const cloudBase = cover < 20 ? 3000 : cover < 50 ? 2000 : cover < 80 ? 1000 : 500;
    const wind = h.wind_speed_10m[i] || 0;
    const gust = h.wind_gusts_10m[i] || 0;
    const weatherCode = h.weather_code[i] || 0;

    // VFR minimums for aerobatics:
    // Visibility >= 5 km, cloud base >= 1500m, wind < 40 km/h, no precip
    const isPrecip = weatherCode >= 51; // drizzle and above
    const flyable = vis >= 5 && cloudBase >= 1500 && wind < 40 && !isPrecip;

    let reason: string | undefined;
    if (!flyable) {
      const reasons: string[] = [];
      if (vis < 5) reasons.push(`widzialnosc ${vis.toFixed(1)} km`);
      if (cloudBase < 1500) reasons.push(`podstawa chmur ${cloudBase}m`);
      if (wind >= 40) reasons.push(`wiatr ${wind.toFixed(0)} km/h`);
      if (isPrecip) reasons.push('opady');
      reason = reasons.join(', ');
    }

    return {
      flyable,
      reason,
      visibility_km: vis,
      cloud_base_m: cloudBase,
      wind_kmh: wind,
      wind_gust_kmh: gust,
      temp_c: h.temperature_2m[i] || 0,
    };
  });
}

// Get simple flyable/not-flyable for a date
export async function isDayFlyable(dateStr: string): Promise<{ flyable: boolean; hourly: WeatherStatus[] }> {
  const hourly = await getWeatherForecast(dateStr);
  // Day is flyable if at least 4 consecutive hours are flyable between 6:00-20:00
  const dayHours = hourly.slice(6, 20);
  let maxConsecutive = 0;
  let current = 0;
  for (const h of dayHours) {
    if (h.flyable) { current++; maxConsecutive = Math.max(maxConsecutive, current); }
    else { current = 0; }
  }
  return { flyable: maxConsecutive >= 4, hourly };
}
