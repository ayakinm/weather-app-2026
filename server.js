const path = require("node:path");
const express = require("express");

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

function createApp({ fetchImpl = fetch } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/weather", async (req, res, next) => {
    try {
      const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
      const hasLatitude = req.query.latitude !== undefined;
      const hasLongitude = req.query.longitude !== undefined;
      let location;

      if (hasLatitude || hasLongitude) {
        const latitude = Number(req.query.latitude);
        const longitude = Number(req.query.longitude);

        if (
          !hasLatitude ||
          !hasLongitude ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          return res.status(400).json({ error: "Please provide valid latitude and longitude coordinates." });
        }

        location = {
          name: city || "Your location",
          admin1: "",
          country: "",
          latitude,
          longitude,
        };
      } else {
        if (!city || city.length > 100) {
          return res.status(400).json({ error: "Enter a city name of 1–100 characters." });
        }

        const geocodingUrl = new URL(GEOCODING_URL);
        geocodingUrl.search = new URLSearchParams({
          name: city,
          count: "1",
          language: "en",
          format: "json",
        });

        const geocodingResponse = await fetchImpl(geocodingUrl);
        if (!geocodingResponse.ok) {
          throw new Error("The location service is temporarily unavailable.");
        }

        const geocoding = await geocodingResponse.json();
        location = geocoding.results?.[0];

        if (!location) {
          return res.status(404).json({ error: `We couldn't find "${city}". Try another city.` });
        }
      }

      const forecastUrl = new URL(FORECAST_URL);
      forecastUrl.search = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
        hourly: "temperature_2m,weather_code",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
        timezone: "auto",
        forecast_days: "7",
      });

      const forecastResponse = await fetchImpl(forecastUrl);
      if (!forecastResponse.ok) {
        throw new Error("The weather service is temporarily unavailable.");
      }

      const forecast = await forecastResponse.json();
      if (!forecast.current || !forecast.daily || !forecast.hourly) {
        throw new Error("The weather service returned an incomplete forecast.");
      }

      return res.json({
        location: {
          name: location.name,
          region: location.admin1 || "",
          country: location.country || "",
          timezone: forecast.timezone,
        },
        current: forecast.current,
        hourly: forecast.hourly,
        daily: forecast.daily,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, req, res, next) => {
    console.error("Weather request failed:", error.message);
    if (res.headersSent) {
      return next(error);
    }
    return res.status(502).json({ error: "Unable to load weather right now. Please try again." });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => {
    console.log(`Weather app is running at http://localhost:${port}`);
  });
}

module.exports = { createApp };
