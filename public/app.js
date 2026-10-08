const searchForm = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const locationButton = document.querySelector("#location-button");
const refreshButton = document.querySelector("#refresh-button");
const statusMessage = document.querySelector("#status-message");
const weatherContent = document.querySelector("#weather-content");
const hourlyList = document.querySelector("#hourly-list");
const weeklyList = document.querySelector("#weekly-list");
const unitButtons = document.querySelectorAll(".unit-button");

const weatherConditions = {
  0: { description: "Clear sky", icon: "☀️" },
  1: { description: "Mainly clear", icon: "🌤️" },
  2: { description: "Partly cloudy", icon: "⛅" },
  3: { description: "Overcast", icon: "☁️" },
  45: { description: "Foggy", icon: "🌫️" },
  48: { description: "Rime fog", icon: "🌫️" },
  51: { description: "Light drizzle", icon: "🌦️" },
  53: { description: "Drizzle", icon: "🌦️" },
  55: { description: "Heavy drizzle", icon: "🌧️" },
  56: { description: "Freezing drizzle", icon: "🌧️" },
  57: { description: "Heavy freezing drizzle", icon: "🌧️" },
  61: { description: "Light rain", icon: "🌦️" },
  63: { description: "Rain", icon: "🌧️" },
  65: { description: "Heavy rain", icon: "🌧️" },
  66: { description: "Freezing rain", icon: "🌧️" },
  67: { description: "Heavy freezing rain", icon: "🌧️" },
  71: { description: "Light snow", icon: "🌨️" },
  73: { description: "Snow", icon: "🌨️" },
  75: { description: "Heavy snow", icon: "❄️" },
  77: { description: "Snow grains", icon: "🌨️" },
  80: { description: "Light showers", icon: "🌦️" },
  81: { description: "Rain showers", icon: "🌧️" },
  82: { description: "Heavy showers", icon: "🌧️" },
  85: { description: "Snow showers", icon: "🌨️" },
  86: { description: "Heavy snow showers", icon: "❄️" },
  95: { description: "Thunderstorm", icon: "⛈️" },
  96: { description: "Thunder & hail", icon: "⛈️" },
  99: { description: "Thunder & hail", icon: "⛈️" },
};

let currentUnit = "c";
let latestForecast = null;
let lastSearch = { city: "London" };

function temperature(value) {
  const converted = currentUnit === "f" ? (value * 9) / 5 + 32 : value;
  return Math.round(converted);
}

function formatTemperature(value) {
  return `${temperature(value)}°`;
}

function conditionFor(code) {
  return weatherConditions[code] || { description: "Conditions unavailable", icon: "🌤️" };
}

function localDate(dateString) {
  return new Date(`${dateString}T12:00:00Z`);
}

function formatTime(timeString) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${timeString}Z`));
}

function renderForecast(data) {
  latestForecast = data;
  const { location, current, hourly, daily } = data;
  const today = daily.time[0];
  const todayIndex = hourly.time.findIndex((time) => time.slice(0, 10) === today);
  const hourlyStart = todayIndex >= 0 ? todayIndex : 0;
  const todayForecastIndex = daily.time.indexOf(current.time.slice(0, 10));
  const dayIndex = todayForecastIndex >= 0 ? todayForecastIndex : 0;
  const currentCondition = conditionFor(current.weather_code);
  const currentDate = new Date(`${current.time}Z`);
  const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    timeZone: "UTC",
  });
  const hourFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", timeZone: "UTC" });

  document.querySelector("#today-label").textContent = fullDateFormatter.format(currentDate).toUpperCase();
  document.querySelector("#city-name").textContent = location.name;
  document.querySelector("#location-detail").textContent =
    [location.region, location.country].filter(Boolean).join(", ") || "Your local forecast";
  document.querySelector("#current-temperature").textContent = temperature(current.temperature_2m);
  document.querySelector("#weather-description").textContent = currentCondition.description;
  document.querySelector("#feels-like").textContent = `Feels like ${formatTemperature(current.apparent_temperature)}`;
  document.querySelector("#weather-art").textContent = currentCondition.icon;
  document.querySelector("#today-high").textContent = formatTemperature(daily.temperature_2m_max[dayIndex]);
  document.querySelector("#today-low").textContent = formatTemperature(daily.temperature_2m_min[dayIndex]);
  document.querySelector("#humidity").textContent = `${current.relative_humidity_2m}%`;
  document.querySelector("#wind-speed").textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  document.querySelector("#rain-chance").textContent = `${daily.precipitation_probability_max[dayIndex] ?? 0}%`;
  document.querySelector("#sunrise").textContent = formatTime(daily.sunrise[dayIndex]);
  document.querySelector("#updated-label").textContent = `Updated ${formatTime(current.time)}`;
  cityInput.value = lastSearch.city || cityLabel;

  const nextHours = hourly.time.slice(hourlyStart, hourlyStart + 24);
  hourlyList.replaceChildren(
    ...nextHours.map((time, index) => {
      const indexInForecast = hourlyStart + index;
      const hour = document.createElement("div");
      hour.className = "hour-item";

      const timeLabel = document.createElement("span");
      timeLabel.className = "hour-time";
      timeLabel.textContent = index === 0 ? "Now" : hourFormatter.format(new Date(time));

      const icon = document.createElement("span");
      icon.className = "hour-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = conditionFor(hourly.weather_code[indexInForecast]).icon;

      const temp = document.createElement("span");
      temp.className = "hour-temperature";
      temp.textContent = formatTemperature(hourly.temperature_2m[indexInForecast]);

      hour.append(timeLabel, icon, temp);
      return hour;
    }),
  );

  weeklyList.replaceChildren(
    ...daily.time.map((day, index) => {
      const row = document.createElement("div");
      row.className = "day-item";

      const name = document.createElement("span");
      name.className = "day-name";
      name.textContent =
        index === dayIndex ? "Today" : weekdayFormatter.format(localDate(day));

      const icon = document.createElement("span");
      icon.className = "day-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = conditionFor(daily.weather_code[index]).icon;

      const range = document.createElement("span");
      range.className = "day-range";

      const high = document.createElement("strong");
      high.className = "day-high";
      high.textContent = formatTemperature(daily.temperature_2m_max[index]);

      const low = document.createElement("span");
      low.className = "day-low";
      low.textContent = formatTemperature(daily.temperature_2m_min[index]);

      range.append(high, low);

      const rain = document.createElement("span");
      rain.className = "day-low";
      rain.textContent = `${daily.precipitation_probability_max[index] ?? 0}% rain`;

      row.append(name, icon, range, rain);
      return row;
    }),
  );
}

async function loadWeather(params) {
  statusMessage.textContent = "";
  weatherContent.setAttribute("aria-busy", "true");

  try {
    const query = new URLSearchParams(params);
    const response = await fetch(`/api/weather?${query}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load the forecast.");
    }

    renderForecast(data);
  } catch (error) {
    statusMessage.textContent = error.message || "Unable to load weather. Check your connection and try again.";
  } finally {
    weatherContent.setAttribute("aria-busy", "false");
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;
  lastSearch = { city };
  loadWeather(lastSearch);
});

refreshButton.addEventListener("click", () => {
  loadWeather(lastSearch);
});

locationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    statusMessage.textContent = "Location isn't available in this browser. Search for a city instead.";
    return;
  }

  statusMessage.textContent = "Finding your location…";
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      lastSearch = {
        latitude: String(coords.latitude),
        longitude: String(coords.longitude),
        city: "",
      };
      loadWeather(lastSearch);
    },
    (error) => {
      const messages = {
        1: "Location access was denied. You can search for a city instead.",
        2: "Your location couldn't be determined. Try searching for a city.",
        3: "Location lookup timed out. Please try again.",
      };
      statusMessage.textContent = messages[error.code] || "Unable to get your location. Try searching for a city.";
    },
    { timeout: 10000, maximumAge: 300000 },
  );
});

unitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentUnit = button.dataset.unit;
    unitButtons.forEach((unitButton) => {
      const isActive = unitButton === button;
      unitButton.classList.toggle("is-active", isActive);
      unitButton.setAttribute("aria-pressed", String(isActive));
    });
    if (latestForecast) renderForecast(latestForecast);
  });
});

loadWeather(lastSearch);
