const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createApp } = require("../server");

const weatherResponse = {
  current: {
    time: "2026-10-08T12:00",
    temperature_2m: 19.5,
    relative_humidity_2m: 52,
    apparent_temperature: 19,
    is_day: 1,
    precipitation: 0,
    weather_code: 1,
    wind_speed_10m: 8,
  },
  hourly: {
    time: ["2026-10-08T12:00"],
    temperature_2m: [19.5],
    weather_code: [1],
  },
  daily: {
    time: ["2026-10-08"],
    weather_code: [1],
    temperature_2m_max: [22],
    temperature_2m_min: [14],
    precipitation_probability_max: [10],
    sunrise: ["2026-10-08T06:45"],
    sunset: ["2026-10-08T18:30"],
  },
  timezone: "Europe/London",
};

let server;
let baseUrl;

before(async () => {
  const app = createApp({
    fetchImpl: async (url) => {
      const requestUrl = new URL(url);
      if (requestUrl.hostname === "geocoding-api.open-meteo.com") {
        if (requestUrl.searchParams.get("name") === "Atlantis") {
          return Response.json({ results: [] });
        }
        return Response.json({
          results: [
            {
              name: "London",
              admin1: "England",
              country: "United Kingdom",
              latitude: 51.51,
              longitude: -0.13,
            },
          ],
        });
      }
      return Response.json(weatherResponse);
    },
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("city search returns the location and complete forecast", async () => {
  const response = await fetch(`${baseUrl}/api/weather?city=London`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.location, {
    name: "London",
    region: "England",
    country: "United Kingdom",
    timezone: "Europe/London",
  });
  assert.equal(body.current.temperature_2m, 19.5);
  assert.deepEqual(body.daily.time, ["2026-10-08"]);
});

test("rejects an empty city search", async () => {
  const response = await fetch(`${baseUrl}/api/weather?city=%20`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /city name/i);
});

test("returns a helpful not-found response for unknown cities", async () => {
  const response = await fetch(`${baseUrl}/api/weather?city=Atlantis`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.match(body.error, /couldn't find "Atlantis"/i);
});

test("returns a forecast for valid device coordinates", async () => {
  const response = await fetch(`${baseUrl}/api/weather?latitude=51.51&longitude=-0.13`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.location.name, "Your location");
  assert.equal(body.current.temperature_2m, 19.5);
});

test("rejects invalid coordinates", async () => {
  const response = await fetch(`${baseUrl}/api/weather?latitude=91&longitude=0`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /coordinates/i);
});
