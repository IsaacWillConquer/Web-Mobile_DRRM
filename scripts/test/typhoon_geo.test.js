"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  KM_PER_DEG,
  classifyPagasa,
  msToKph,
  ktToKph,
  circlePoints,
  convexHull,
  buildCone,
  fallbackConeRadiusKm,
  parseJmaSpecifications,
  parseJmaForecast,
} = require("../lib/typhoon_geo");
const { buildSimulationBulletin } = require("../lib/storm_sim_data");

// Ray-casting point-in-polygon on [lng, lat] rings.
function inside(ring, lng, lat) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

test("classifyPagasa: boundaries follow the PAGASA scale", () => {
  const code = (w) => classifyPagasa(w).code;
  assert.equal(code(0), "TD");
  assert.equal(code(61), "TD");
  assert.equal(code(62), "TS");
  assert.equal(code(88), "TS");
  assert.equal(code(89), "STS");
  assert.equal(code(117), "STS");
  assert.equal(code(118), "TY");
  assert.equal(code(184), "TY");
  assert.equal(code(185), "STY");
  assert.equal(code(300), "STY");
  assert.equal(classifyPagasa(85).name, "Tropical Storm");
});

test("classifyPagasa: unknown or invalid wind returns null", () => {
  assert.equal(classifyPagasa(null), null);
  assert.equal(classifyPagasa(undefined), null);
  assert.equal(classifyPagasa(NaN), null);
  assert.equal(classifyPagasa(-5), null);
});

test("wind unit conversions", () => {
  assert.equal(msToKph(25), 90);
  assert.ok(Math.abs(ktToKph(50) - 92.6) < 1e-9);
});

test("circlePoints: every point is about radiusKm from the centre", () => {
  const lat = 15;
  const lng = 122;
  const radius = 200;
  for (const [x, y] of circlePoints(lat, lng, radius)) {
    const dy = (y - lat) * KM_PER_DEG;
    const dx = (x - lng) * KM_PER_DEG * Math.cos((lat * Math.PI) / 180);
    const dist = Math.hypot(dx, dy);
    assert.ok(Math.abs(dist - radius) / radius < 0.01, `dist ${dist}`);
  }
});

test("convexHull: drops interior points, keeps the square", () => {
  const hull = convexHull([[0, 0], [2, 0], [2, 2], [0, 2], [1, 1], [1, 0.5]]);
  assert.equal(hull.length, 4);
  assert.ok(!hull.some(([x, y]) => x === 1 && y === 1));
});

test("buildCone: needs two usable circles", () => {
  assert.equal(buildCone([]), null);
  assert.equal(buildCone([{ lat: 15, lng: 122, radiusKm: 50 }]), null);
  assert.equal(
    buildCone([
      { lat: 15, lng: 122, radiusKm: 0 },
      { lat: 16, lng: 121, radiusKm: 50 },
    ]),
    null
  );
});

// Shoelace area of a [lng, lat] ring (square degrees; fine for comparing shapes).
function area(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a) / 2;
}

test("buildCone: hugs a curving track instead of ballooning over the bend", () => {
  // L-shaped path: north, then east. A single hull would fill the whole triangle.
  const circles = [
    { lat: 15, lng: 120, radiusKm: 50 },
    { lat: 20, lng: 120, radiusKm: 50 },
    { lat: 25, lng: 120, radiusKm: 50 },
    { lat: 25, lng: 125, radiusKm: 50 },
    { lat: 25, lng: 130, radiusKm: 50 },
  ];
  const cone = buildCone(circles);
  const coneRing = cone.coordinates[0];
  const hullRing = convexHull(
    circles.flatMap((c) => circlePoints(c.lat, c.lng, c.radiusKm))
  );

  // (lat 22, lng 123) is ~330 km from the path but inside the convex hull.
  assert.ok(inside(hullRing, 123, 22), "sanity: the hull covers the bend");
  assert.ok(!inside(coneRing, 123, 22), "the cone must not cover the bend");
  assert.ok(area(coneRing) < area(hullRing) * 0.6);
  // ...while the path itself is covered.
  for (const c of circles) assert.ok(inside(coneRing, c.lng, c.lat));
});

test("buildCone: radius growth gives a wider far end", () => {
  const cone = buildCone([
    { lat: 15, lng: 120, radiusKm: 30 },
    { lat: 20, lng: 120, radiusKm: 120 },
  ]);
  const ring = cone.coordinates[0];
  const widthAt = (lat) => {
    const xs = ring.filter((p) => Math.abs(p[1] - lat) < 0.6).map((p) => p[0]);
    return Math.max(...xs) - Math.min(...xs);
  };
  assert.ok(widthAt(20) > widthAt(15) * 2);
});

test("buildCone: closed ring that contains every circle centre", () => {
  const circles = [
    { lat: 14.9, lng: 123.6, radiusKm: 35 },
    { lat: 15.2, lng: 122.0, radiusKm: 90 },
    { lat: 15.4, lng: 120.4, radiusKm: 140 },
    { lat: 15.6, lng: 118.9, radiusKm: 190 },
  ];
  const cone = buildCone(circles);
  assert.equal(cone.type, "Polygon");
  const ring = cone.coordinates[0];
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  for (const c of circles) assert.ok(inside(ring, c.lng, c.lat), `${c.lat},${c.lng}`);
  // widens with lead time: the far end reaches further north than the near end
  const north = Math.max(...ring.map((p) => p[1]));
  assert.ok(north > 15.6 + 150 / KM_PER_DEG);
});

// Real-shaped JMA forecast.json (trimmed copy of storm Champi, 2026-10-23):
// same keys, nesting and units (metres) as the live file.
const GALE = { center: [24.03, 123.6], radius: 740800 };
const STORM = { arc: [[[23.38, 123.41], 305580, [0.0, 360.0]]] };

function jmaFixture() {
  return [
    {
      part: "title",
      issue: { JST: "2026-10-23T12:45:00+09:00", UTC: "2026-10-23T03:45:00Z" },
      typhoonNumber: "2630",
      name: { jp: "x", en: "Champi" },
    },
    {
      part: { jp: "x", en: "Analysis" },
      advancedHours: 0,
      validtime: { JST: "2026-10-23T12:00:00+09:00", UTC: "2026-10-23T03:00:00Z" },
      track: {
        preTyphoon: [[10.8, 160.0], [10.9, 158.9], [11.1, 158.4]],
        typhoon: [[11.1, 158.4], [11.3, 157.9], [22.8, 123.8], [23.0, 123.7], [23.2, 123.6]],
      },
      center: [23.2, 123.6],
      galeWarningArea: GALE,
      stormWarningArea: STORM,
    },
    {
      part: { jp: "x", en: "Estimate for 1 hour ahead" },
      advancedHours: 1,
      validtime: { UTC: "2026-10-23T04:00:00Z" },
      center: [23.3, 123.6],
      galeWarningArea: { center: [24.13, 123.6], radius: 740800 },
      stormWarningArea: STORM,
    },
    {
      part: { jp: "x", en: "Forecast for 3 hours ahead" },
      advancedHours: 3,
      validtime: { UTC: "2026-10-23T06:00:00Z" },
      probabilityCircle: { radius: 31484, tangent_3h: [] },
      center: [23.6, 123.4],
    },
    {
      part: { jp: "x", en: "Forecast for 45 hours ahead" },
      advancedHours: 45,
      validtime: { UTC: "2026-10-25T00:00:00Z" },
      probabilityCircle: { radius: 185200, tangent: [] },
      center: [29.1, 124.2],
    },
    {
      part: { jp: "x", en: "Forecast for 12 hours ahead" },
      advancedHours: 12,
      validtime: { UTC: "2026-10-23T15:00:00Z" },
      probabilityCircle: { radius: 55560, tangent_3h: [] },
      center: [24.3, 122.5],
    },
  ];
}

test("parseJmaForecast: reads the real JMA shape", () => {
  const p = parseJmaForecast(jmaFixture());
  assert.equal(p.name, "Champi");
  assert.equal(p.issuedAtIso, "2026-10-23T03:45:00Z");
  assert.equal(p.analysisAt, "2026-10-23T03:00:00Z");

  // 1H estimate dropped; the rest sorted by lead time.
  assert.deepEqual(p.forecast.map((f) => f.label), ["3H", "12H", "45H"]);
  assert.deepEqual(p.forecast.map((f) => f.radiusKm), [31.5, 55.6, 185.2]);
  assert.equal(p.forecast[2].validAt, "2026-10-25T00:00:00Z");

  // Wind areas: gale circle has its own centre; storm circle read from the arc.
  assert.deepEqual(p.galeArea, { lat: 24.03, lng: 123.6, radiusKm: 740.8 });
  assert.deepEqual(p.stormArea, { lat: 23.38, lng: 123.41, radiusKm: 305.6 });
  assert.equal(p.dangerRadiusKm, 305.6);

  // Wind is not in forecast.json: honest nulls plus a warning.
  assert.equal(p.maxWindsKph, null);
  assert.equal(p.category, null);
  assert.equal(p.warnings.length, 1);
});

test("parseJmaForecast: track is de-duplicated and marks the depression stage", () => {
  const p = parseJmaForecast(jmaFixture());
  for (let i = 1; i < p.track.length; i += 1) {
    const same = p.track[i].lat === p.track[i - 1].lat && p.track[i].lng === p.track[i - 1].lng;
    assert.ok(!same, `duplicate at ${i}`);
  }
  // pre-typhoon points are flagged; the shared hand-over point is typhoon stage
  assert.deepEqual(p.track.slice(0, 3).map((t) => t.pre), [true, true, undefined]);
  assert.ok(p.track.slice(2).every((t) => t.pre === undefined));
  assert.deepEqual(p.track[p.track.length - 1], { lat: 23.2, lng: 123.6 });
});

test("parseJmaForecast: cone starts at the storm and covers every forecast point", () => {
  const p = parseJmaForecast(jmaFixture());
  const ring = p.cone.coordinates[0];
  assert.ok(inside(ring, 123.6, 23.2), "current position");
  for (const f of p.forecast) assert.ok(inside(ring, f.lng, f.lat), f.label);
});

test("parseJmaForecast: appends the current position when the track lacks it", () => {
  const parts = jmaFixture();
  parts[1].track = { preTyphoon: [[10.8, 160.0]], typhoon: [] };
  const p = parseJmaForecast(parts);
  assert.deepEqual(p.track[p.track.length - 1], { lat: 23.2, lng: 123.6 });
});

test("parseJmaForecast: partial storm-force arcs are not mistaken for a circle", () => {
  const parts = jmaFixture();
  parts[1].stormWarningArea = {
    arc: [
      [[23.38, 123.41], 305580, [89.36, 266.97]],
      [[23.6, 123.4], 305580, [0.0, 89.36]],
    ],
  };
  const p = parseJmaForecast(parts);
  assert.equal(p.stormArea, null);
  assert.equal(p.dangerRadiusKm, 740.8); // falls back to the gale circle
});

test("parseJmaForecast: missing probability circles use fallback radii and warn", () => {
  const parts = jmaFixture().map((x) => {
    const { probabilityCircle, ...rest } = x;
    return rest;
  });
  const p = parseJmaForecast(parts);
  assert.equal(p.forecast[0].radiusKm, undefined);
  assert.ok(p.cone, "cone still built");
  assert.equal(p.warnings.length, 2);
});

test("parseJmaForecast: empty or garbage input gives an empty result", () => {
  for (const input of [null, undefined, [], {}, [null]]) {
    const p = parseJmaForecast(input);
    assert.deepEqual(p.track, []);
    assert.deepEqual(p.forecast, []);
    assert.equal(p.cone, null);
    assert.equal(p.galeArea, null);
  }
});

test("fallbackConeRadiusKm grows with lead time", () => {
  assert.ok(fallbackConeRadiusKm(36) > fallbackConeRadiusKm(12));
});

test("simulation bulletin: consistent, ordered, and the cone covers the forecast", () => {
  const now = new Date("2026-10-23T00:00:00Z");
  const b = buildSimulationBulletin(now);
  const here = b.track[b.track.length - 1];

  assert.equal(b.simulation, true);
  assert.equal(b.source, "Simulation");
  assert.equal(b.category, classifyPagasa(b.maxWindsKph).name);
  assert.equal(b.maxWindsKph, here.windKph);

  // 85 km/h is a Tropical Storm: gale-force area only, no storm-force area.
  assert.equal(b.category, "Tropical Storm");
  assert.equal(b.stormArea, undefined);
  assert.equal(b.dangerRadiusKm, b.galeArea.radiusKm);

  // "now" is east of Luzon, the past track approaches from the east.
  assert.equal(here.lat, 14.9);
  assert.equal(here.lng, 123.6);
  for (let i = 1; i < b.track.length; i += 1) {
    assert.ok(b.track[i].lng < b.track[i - 1].lng, "track moves west");
  }

  const hours = b.forecast.map((f) => f.hours);
  assert.deepEqual(hours, [...hours].sort((a, c) => a - c));
  assert.equal(b.forecast[0].validAt, "2026-10-23T12:00:00.000Z");

  const ring = JSON.parse(b.cone).coordinates[0];
  assert.ok(inside(ring, here.lng, here.lat), "current position");
  for (const f of b.forecast) assert.ok(inside(ring, f.lng, f.lat), f.label);
});

// Real-shaped JMA specifications.json (trimmed copy of storm Champi). Note the
// numbers are STRINGS and the title carries its own category.
function specsFixture() {
  const part = (hours, cls, kt, ms, gustKt, gustMs, pressure) => ({
    part: { jp: "x", en: hours === 0 ? "Analysis" : `Forecast for ${hours} hours ahead` },
    maximumWind: {
      sustained: { "m/s": ms, kt, note: "x" },
      gust: { "m/s": gustMs, kt: gustKt },
    },
    advancedHours: hours,
    category: { jp: "x", en: cls },
    intensity: "-",
    position: { deg: [0, 0] },
    pressure,
    validtime: { UTC: "2026-10-23T03:00:00Z" },
  });
  return [
    { part: "title", typhoonNumber: "2630", name: { en: "Champi" }, category: { en: "TY" } },
    part(0, "TY", "80", "40", "115", "60", "955"),
    part(3, "TY", "75", "40", "105", "55", "965"),
    part(12, "TY", "70", "35", "100", "50", "970"),
    part(45, "STS", "50", "25", "70", "35", "990"),
    part(93, "LOW", "35", "18", "50", "25", "998"),
  ];
}

test("parseJmaSpecifications: string numbers -> km/h, class, pressure", () => {
  const s = parseJmaSpecifications(specsFixture());
  assert.deepEqual(Object.keys(s).map(Number), [0, 3, 12, 45, 93]); // title skipped
  assert.equal(s[0].windKph, 148); // 80 kt
  assert.equal(s[0].gustKph, 213); // 115 kt
  assert.equal(s[0].pressureHpa, 955);
  assert.equal(s[0].jmaClass, "TY");
  assert.equal(s[45].windKph, 93); // 50 kt
  assert.equal(s[93].jmaClass, "LOW");
});

test("parseJmaSpecifications: falls back to m/s, tolerates gaps and garbage", () => {
  const s = parseJmaSpecifications([
    { advancedHours: 0, maximumWind: { sustained: { "m/s": "40" } } },
    { advancedHours: 3 },
  ]);
  assert.equal(s[0].windKph, 144); // 40 m/s
  assert.equal(s[3].windKph, null);
  assert.equal(s[3].jmaClass, null);
  for (const input of [null, undefined, [], {}, [null, "x"]]) {
    assert.deepEqual(parseJmaSpecifications(input), {});
  }
});

test("parseJmaForecast + specs: wind, PAGASA category and per-point winds", () => {
  const specs = parseJmaSpecifications(specsFixture());
  const p = parseJmaForecast(jmaFixture(), { specs });

  assert.equal(p.maxWindsKph, 148);
  assert.equal(p.category, "Typhoon"); // 148 km/h on the PAGASA scale
  assert.equal(p.jmaClass, "TY");
  assert.equal(p.gustKph, 213);
  assert.equal(p.pressureHpa, 955);
  assert.equal(p.track[p.track.length - 1].windKph, 148);

  const byLabel = Object.fromEntries(p.forecast.map((f) => [f.label, f]));
  assert.equal(byLabel["3H"].windKph, 139);
  assert.equal(byLabel["12H"].windKph, 130);
  assert.equal(byLabel["45H"].windKph, 93);
  assert.equal(classifyPagasa(byLabel["45H"].windKph).code, "STS");
  assert.equal(p.warnings.length, 0);
});

test("parseJmaForecast + specs: JMA 'LOW' is passed through, not relabelled", () => {
  const parts = jmaFixture();
  parts.push({
    advancedHours: 93,
    validtime: { UTC: "2026-10-27T00:00:00Z" },
    probabilityCircle: { radius: 370400 },
    center: [34.5, 139.7],
  });
  const p = parseJmaForecast(parts, { specs: parseJmaSpecifications(specsFixture()) });
  const last = p.forecast[p.forecast.length - 1];
  assert.equal(last.label, "93H");
  assert.equal(last.jmaClass, "LOW");
  assert.equal(last.windKph, 65);
});

test("parseJmaForecast without specs: wind stays null with one warning", () => {
  const p = parseJmaForecast(jmaFixture());
  assert.equal(p.maxWindsKph, null);
  assert.equal(p.category, null);
  assert.equal(p.jmaClass, null);
  assert.equal(p.warnings.length, 1);
});
