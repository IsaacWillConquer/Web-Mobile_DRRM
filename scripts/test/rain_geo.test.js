"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  levelForMm,
  sumPrecipitation,
  chunk,
  labelPoint,
  provincePoints,
  buildProvinceRain,
  haversineKm,
  demoProvinceRain,
} = require("../lib/rain_geo");

const square = (x, y, size) => [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];

function inside(ring, x, y) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

test("levelForMm: light under 50, moderate 50-149, heavy 150+", () => {
  assert.equal(levelForMm(0), 1);
  assert.equal(levelForMm(49.9), 1);
  assert.equal(levelForMm(50), 2);
  assert.equal(levelForMm(149.9), 2);
  assert.equal(levelForMm(150), 3);
  assert.equal(levelForMm(900), 3);
});

test("sumPrecipitation: totals the days, ignores gaps and garbage", () => {
  assert.equal(sumPrecipitation([10.25, 0, 5.5, null, undefined, NaN]), 15.8);
  assert.equal(sumPrecipitation(null), 0);
  assert.equal(sumPrecipitation([]), 0);
});

test("chunk splits into batches, last one may be short", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
});

test("labelPoint: square middle, C-shape inside, largest part of a multipolygon", () => {
  const mid = labelPoint({ type: "Polygon", coordinates: [square(0, 0, 10)] });
  assert.ok(Math.abs(mid[0] - 5) < 0.5 && Math.abs(mid[1] - 5) < 0.5);

  const c = [[0, 0], [10, 0], [10, 3], [3, 3], [3, 7], [10, 7], [10, 10], [0, 10], [0, 0]];
  const p = labelPoint({ type: "Polygon", coordinates: [c] });
  assert.ok(inside(c, p[0], p[1]));

  const multi = labelPoint({
    type: "MultiPolygon",
    coordinates: [[square(50, 5, 1)], [square(0, 0, 10)]],
  });
  assert.ok(multi[0] > 0 && multi[0] < 20);

  assert.equal(labelPoint(null), null);
  assert.equal(labelPoint({ type: "Polygon", coordinates: [] }), null);
  assert.equal(labelPoint({ type: "Point", coordinates: [1, 2] }), null);
});

test("provincePoints: one point per named feature, inside its own polygon", () => {
  const geo = {
    features: [
      { properties: { name: "A" }, geometry: { type: "Polygon", coordinates: [square(120, 14, 2)] } },
      { properties: { name: "B" }, geometry: { type: "Polygon", coordinates: [] } },
      { properties: {}, geometry: { type: "Polygon", coordinates: [square(0, 0, 1)] } },
    ],
  };
  const pts = provincePoints(geo);
  assert.equal(pts.length, 1);
  assert.equal(pts[0].name, "A");
  assert.ok(inside(square(120, 14, 2), pts[0].lng, pts[0].lat));
});

test("provincePoints on the real app GeoJSON: every province, unique names, inside the PH box", (t) => {
  const file = path.join(__dirname, "..", "..", "mobile", "assets", "geo", "ph_provinces.geojson");
  if (!fs.existsSync(file)) return t.skip("mobile/assets/geo/ph_provinces.geojson not found");
  const geo = JSON.parse(fs.readFileSync(file, "utf8"));
  const pts = provincePoints(geo);
  const names = new Set(geo.features.map((f) => f.properties.name));
  // Metro Manila is several districts with one name: one point for all of them.
  assert.equal(pts.length, names.size);
  assert.deepEqual(new Set(pts.map((p) => p.name)), names);
  for (const p of pts) {
    assert.ok(p.lat > 4 && p.lat < 22 && p.lng > 116 && p.lng < 127.5, `${p.name} ${p.lat},${p.lng}`);
  }
});

test("provincePoints: features that share a name get one point", () => {
  const geo = {
    features: [
      { properties: { name: "Metro Manila" }, geometry: { type: "Polygon", coordinates: [square(121, 14, 0.2)] } },
      { properties: { name: "Metro Manila" }, geometry: { type: "Polygon", coordinates: [square(121.2, 14, 0.2)] } },
      { properties: { name: "Rizal" }, geometry: { type: "Polygon", coordinates: [square(121.3, 14.5, 0.3)] } },
    ],
  };
  assert.deepEqual(provincePoints(geo).map((p) => p.name), ["Metro Manila", "Rizal"]);
});

test("buildProvinceRain: totals, rounds, levels; rejects a count mismatch", () => {
  const points = [{ name: "Abra" }, { name: "Cebu" }, { name: "Sulu" }];
  const results = [
    { daily: { precipitation_sum: [60.04, 90.1, 0] } },
    { daily: { precipitation_sum: [5, 5] } },
    {}, // no data at all
  ];
  assert.deepEqual(buildProvinceRain(points, results), [
    { name: "Abra", mm: 150.1, level: 3 },
    { name: "Cebu", mm: 10, level: 1 },
    { name: "Sulu", mm: 0, level: 1 },
  ]);
  assert.throws(() => buildProvinceRain(points, results.slice(0, 2)), /2 results for 3 provinces/);
  assert.throws(() => buildProvinceRain(points, null), /0 results/);
});

test("haversineKm: one degree of latitude is about 111 km", () => {
  const d = haversineKm({ lat: 14, lng: 121 }, { lat: 15, lng: 121 });
  assert.ok(Math.abs(d - 111.2) < 0.5);
});

test("demoProvinceRain: heaviest on the storm path, light far away", () => {
  const path = [{ lat: 15, lng: 122 }];
  const out = demoProvinceRain(
    [
      { name: "Near", lat: 15, lng: 122 },
      { name: "Mid", lat: 16.5, lng: 122 },
      { name: "Far", lat: 7, lng: 125 },
    ],
    path
  );
  const by = Object.fromEntries(out.map((p) => [p.name, p]));
  assert.ok(by.Near.mm > 400 && by.Near.level === 3);
  assert.ok(by.Near.mm > by.Mid.mm && by.Mid.mm > by.Far.mm);
  assert.equal(by.Far.level, 1);
  assert.ok(Math.abs(by.Far.mm - 20) < 1);
});
