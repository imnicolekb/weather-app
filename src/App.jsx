import { useEffect, useMemo, useState } from "react";
import "./app.css";

const WEATHER = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

const fmt = (n, digits = 0) => (n === null || n === undefined ? "-" : n.toFixed(digits));

export default function App() {
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState(null); 
  const [units, setUnits] = useState("metric"); 
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null); 

  const tempUnit = units === "metric" ? "°C" : "°F";
  const speedUnit = units === "metric" ? "km/h" : "mph";

  const convert = useMemo(() => {
    if (units === "metric") {
      return {
        t: (c) => c,
        ws: (kmh) => kmh,
      };
    }
    return {
      t: (c) => c * 9/5 + 32,
      ws: (kmh) => kmh * 0.621371,
    };
  }, [units]);

  async function geocodeCity(name) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("City lookup failed");
    const j = await res.json();
    if (!j.results || j.results.length === 0) throw new Error("City not found");
    const r = j.results[0];
    return {
      name: `${r.name}${r.admin1 ? ", " + r.admin1 : ""}`,
      country: r.country,
      lat: r.latitude,
      lon: r.longitude,
    };
  }

  async function fetchForecast(lat, lon) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: "auto",
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
      ].join(","),
      hourly: ["temperature_2m", "precipitation_probability", "weather_code"].join(","),
      daily: ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "weather_code"].join(","),
    });
    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather fetch failed");
    return res.json();
  }

  async function searchCity(e) {
    e.preventDefault();
    setErr("");
    if (!query.trim()) return;
    try {
      setLoading(true);
      const p = await geocodeCity(query.trim());
      setPlace(p);
      const d = await fetchForecast(p.lat, p.lon);
      setData(d);
    } catch (e) {
      setErr(e.message || "Something went wrong");
      setData(null);
      setPlace(null);
    } finally {
      setLoading(false);
    }
  }

  async function useMyLocation() {
    setErr("");
    if (!("geolocation" in navigator)) {
      setErr("Geolocation not supported by your browser");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          setPlace({ name: "Your location", country: "", lat, lon });
          const d = await fetchForecast(lat, lon);
          setData(d);
        } catch (e) {
          setErr(e.message || "Failed to get weather");
          setData(null);
        } finally {
          setLoading(false);
        }
      },
      (geoErr) => {
        setLoading(false);
        setErr(geoErr.message || "Failed to get your location");
      }
    );
  }

  const daily = data?.daily;
  const current = data?.current;

  return (
    <div className="wrap">
      <header>
        <h1>Weather Oracle</h1>
        <div className="unit-toggle" role="group" aria-label="Units">
          <button
            className={units === "metric" ? "active" : ""}
            onClick={() => setUnits("metric")}
          >
            °C
          </button>
          <button
            className={units === "imperial" ? "active" : ""}
            onClick={() => setUnits("imperial")}
          >
            °F
          </button>
        </div>
      </header>

      <form className="search" onSubmit={searchCity}>
        <input
          placeholder="Search city (e.g., Porto Alegre)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={loading}>Search</button>
        <button type="button" onClick={useMyLocation} disabled={loading}>
          Use my location
        </button>
      </form>

      {loading && <p className="muted">Loading…</p>}
      {err && <p className="error">{err}</p>}

      {place && current && (
        <section className="current">
          <h2>
            {place.name} {place.country ? `— ${place.country}` : ""}
          </h2>
          <div className="current-cards">
            <Card title="Now">
              <div className="big">
                {fmt(convert.t(current.temperature_2m), 1)} {tempUnit}
              </div>
              <div className="muted">{WEATHER[current.weather_code] ?? "—"}</div>
            </Card>
            <Card title="Feels like">
              <div className="big">
                {fmt(convert.t(current.apparent_temperature), 1)} {tempUnit}
              </div>
            </Card>
            <Card title="Humidity">
              <div className="big">{fmt(current.relative_humidity_2m)}%</div>
            </Card>
            <Card title="Wind">
              <div className="big">
                {fmt(convert.ws(current.wind_speed_10m), 0)} {speedUnit}
              </div>
            </Card>
            <Card title="Precipitation">
              <div className="big">{fmt(current.precipitation, 1)} mm</div>
            </Card>
          </div>
        </section>
      )}

      {daily && (
        <section>
          <h3>7-Day Forecast</h3>
          <ul className="forecast">
            {daily.time.map((iso, i) => (
              <li key={iso} className="day">
                <div className="date">{new Date(iso).toDateString()}</div>
                <div className="wx">{WEATHER[daily.weather_code?.[i]] ?? "—"}</div>
                <div className="temps">
                  <span className="hi">
                    {fmt(convert.t(daily.temperature_2m_max[i]), 0)}{tempUnit}
                  </span>
                  <span className="lo">
                    {fmt(convert.t(daily.temperature_2m_min[i]), 0)}{tempUnit}
                  </span>
                </div>
                <div className="precip">
                  {fmt(daily.precipitation_sum?.[i] ?? 0, 1)} mm
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && !data && !err && (
        <p className="muted">Search for a city or use your location to see the weather.</p>
      )}

      <footer>
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Data by Open-Meteo (no API key required)
        </a>
      </footer>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {children}
    </div>
  );
}
