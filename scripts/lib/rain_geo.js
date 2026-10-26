// Pure helpers for the rain forecast: province points from the app's own
// GeoJSON, level thresholds, Open-Meteo result handling and the demo data.
// No network, no Firebase, so everything here is unit-tested
// (scripts/test/rain_geo.test.js).
"use strict";

// 7-day total rainfall -> level. Keep in sync with kRainLevels in
// mobile/lib/core/overlays.dart (the legend text).
const RAIN_MODERATE_FROM_MM = 50;
const RAIN_HEAVY_FROM_MM = 150;

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const round1 = (v) => Math.round(v * 10) / 10;

/** 1 = light, 2 = moderate, 3 = heavy. */
function levelForMm(mm) {
  if (mm >= RAIN_HEAVY_FROM_MM) return 3;
  if (mm >= RAIN_MODERATE_FROM_MM) return 2;
  return 1;
}

/** Sum of Open-Meteo `precipitation_sum` days; missing days count as 0. */
function sumPrecipitation(daily) {
  if (!Array.isArray(daily)) return 0;
  return round1(daily.reduce((sum, v) => sum + (isNum(v) ? v : 0), 0));
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ------------------------------------------------------------ label points
// Same algorithm as labelPoint() in mobile/lib/core/overlays.dart: a point
// inside the largest part of a polygon, far from its edges.

function readRing(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => Array.isArray(p) && p.length >= 2 && isNum(p[0]) && isNum(p[1]))
    .map((p) => [p[0], p[1]]);
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(sum) / 2;
}

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distToRing(ring, x, y) {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    best = Math.min(best, distToSegment(x, y, ring[j][0], ring[j][1], ring[i][0], ring[i][1]));
  }
  return best;
}

function interiorPoint(ring) {
  let x0 = ring[0][0];
  let x1 = x0;
  let y0 = ring[0][1];
  let y1 = y0;
  for (const [x, y] of ring) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  let bestX = (x0 + x1) / 2;
  let bestY = (y0 + y1) / 2;
  let bestDist = inRing(ring, bestX, bestY) ? distToRing(ring, bestX, bestY) : -1;

  const steps = 12;
  for (let round = 0; round < 4; round += 1) {
    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; j <= steps; j += 1) {
        const x = x0 + ((x1 - x0) * i) / steps;
        const y = y0 + ((y1 - y0) * j) / steps;
        if (!inRing(ring, x, y)) continue;
        const d = distToRing(ring, x, y);
        if (d > bestDist) {
          bestDist = d;
          bestX = x;
          bestY = y;
        }
      }
    }
    const halfW = (x1 - x0) / 6;
    const halfH = (y1 - y0) / 6;
    x0 = bestX - halfW;
    x1 = bestX + halfW;
    y0 = bestY - halfH;
    y1 = bestY + halfH;
  }
  return [bestX, bestY];
}

/** [lng, lat] inside the largest part of a Polygon/MultiPolygon, or null. */
function labelPoint(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  const rings = [];
  if (geometry.type === "Polygon") {
    const ring = readRing(geometry.coordinates[0]);
    if (ring.length) rings.push(ring);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      const ring = readRing(Array.isArray(polygon) ? polygon[0] : null);
      if (ring.length) rings.push(ring);
    }
  }
  if (rings.length === 0) return null;
  const largest = rings.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a));
  return interiorPoint(largest);
}

/**
 * One forecast point per province of the app's provinces GeoJSON, so the names
 * match what the app draws by construction. The GeoJSON splits Metro Manila
 * into several districts that share one name; those get a single point (the
 * first), and every district is coloured from it.
 * @returns {{name:string,lat:number,lng:number}[]}
 */
function provincePoints(geojson) {
  const out = [];
  const seen = new Set();
  for (const f of (geojson && geojson.features) || []) {
    const name = f && f.properties && f.properties.name;
    const point = labelPoint(f && f.geometry);
    if (!name || !point || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, lat: Math.round(point[1] * 1000) / 1000, lng: Math.round(point[0] * 1000) / 1000 });
  }
  return out;
}

/**
 * @param {{name:string}[]} points
 * @param {object[]} results  Open-Meteo results, same order as `points`
 */
function buildProvinceRain(points, results) {
  if (!Array.isArray(results) || results.length !== points.length) {
    throw new Error(
      `Open-Meteo returned ${Array.isArray(results) ? results.length : 0} results for ${points.length} provinces`
    );
  }
  return points.map((p, i) => {
    const mm = sumPrecipitation(results[i] && results[i].daily && results[i].daily.precipitation_sum);
    return { name: p.name, mm, level: levelForMm(mm) };
  });
}

// ------------------------------------------------------------------- demo

function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Demo rain that is consistent with the simulation storm: heaviest near its
 * path, tapering to a light baseline far away.
 * @param {{name:string,lat:number,lng:number}[]} points
 * @param {{lat:number,lng:number}[]} stormPath
 */
function demoProvinceRain(points, stormPath, { baseMm = 20, peakMm = 420, spreadKm = 200 } = {}) {
  return points.map((p) => {
    const d = Math.min(...stormPath.map((s) => haversineKm(p, s)));
    const mm = round1(baseMm + (peakMm - baseMm) * Math.exp(-((d / spreadKm) ** 2)));
    return { name: p.name, mm, level: levelForMm(mm) };
  });
}

module.exports = {
  RAIN_MODERATE_FROM_MM,
  RAIN_HEAVY_FROM_MM,
  levelForMm,
  sumPrecipitation,
  chunk,
  labelPoint,
  provincePoints,
  buildProvinceRain,
  haversineKm,
  demoProvinceRain,
};
