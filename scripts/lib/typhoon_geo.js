// Pure helpers for typhoon data: PAGASA categories, forecast cone, and parsing
// of JMA forecast.json into the shape the app stores. No network, no Firebase,
// so everything here is unit-tested (scripts/test/typhoon_geo.test.js).
//
// Coordinates: public helpers take/return plain { lat, lng } objects, except
// GeoJSON output which is [lng, lat] as the spec requires.
"use strict";

const polygonClipping = require("polygon-clipping");

const KM_PER_DEG = (6371 * Math.PI) / 180; // ~111.19 km per degree of latitude

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const round = (v, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

// ---------------------------------------------------------------- categories

// PAGASA tropical cyclone scale, by 10-minute sustained wind (km/h).
const PAGASA_SCALE = [
  { code: "TD", name: "Tropical Depression", below: 62 },
  { code: "TS", name: "Tropical Storm", below: 89 },
  { code: "STS", name: "Severe Tropical Storm", below: 118 },
  { code: "TY", name: "Typhoon", below: 185 },
  { code: "STY", name: "Super Typhoon", below: Infinity },
];

/** @returns {{code:string,name:string}|null} null when wind is unknown. */
function classifyPagasa(windKph) {
  if (!isNum(windKph) || windKph < 0) return null;
  const hit = PAGASA_SCALE.find((c) => windKph < c.below);
  return { code: hit.code, name: hit.name };
}

const msToKph = (ms) => ms * 3.6;
const ktToKph = (kt) => kt * 1.852;

// ------------------------------------------------------------------ geometry

/** Points on a circle as GeoJSON-style [lng, lat] pairs (ring is not closed). */
function circlePoints(lat, lng, radiusKm, steps = 36) {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const pts = [];
  for (let i = 0; i < steps; i += 1) {
    const t = (2 * Math.PI * i) / steps;
    pts.push([
      lng + ((radiusKm / (KM_PER_DEG * cosLat)) * Math.sin(t)),
      lat + (radiusKm / KM_PER_DEG) * Math.cos(t),
    ]);
  }
  return pts;
}

/** Andrew's monotone chain. Input/output are [x, y]; output is counter-clockwise. */
function convexHull(points) {
  const sorted = points
    .map((p) => [p[0], p[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const pts = sorted.filter(
    (p, i) => i === 0 || p[0] !== sorted[i - 1][0] || p[1] !== sorted[i - 1][1]
  );
  if (pts.length < 3) return pts;

  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Forecast cone = the area swept by the uncertainty circles along the track.
 * Each pair of consecutive circles is joined into a "capsule" (the convex hull
 * of just those two circles, which equals every circle in between), and the
 * capsules are merged into one outline. Hugging the path like this matters:
 * one hull around ALL circles balloons over a curving track (e.g. a storm that
 * recurves toward Japan).
 *
 * Needs at least two circles, in track order.
 * @param {{lat:number,lng:number,radiusKm:number}[]} circles
 * @returns {{type:'Polygon'|'MultiPolygon',coordinates:number[][][]|number[][][][]}|null}
 */
function buildCone(circles) {
  const usable = (circles || []).filter(
    (c) => c && isNum(c.lat) && isNum(c.lng) && isNum(c.radiusKm) && c.radiusKm > 0
  );
  if (usable.length < 2) return null;

  const capsules = [];
  for (let i = 0; i < usable.length - 1; i += 1) {
    const a = usable[i];
    const b = usable[i + 1];
    const hull = convexHull([
      ...circlePoints(a.lat, a.lng, a.radiusKm),
      ...circlePoints(b.lat, b.lng, b.radiusKm),
    ]);
    if (hull.length >= 3) capsules.push([[...hull, hull[0]]]);
  }
  if (capsules.length === 0) return null;

  const merged = polygonClipping.union(...capsules); // MultiPolygon coordinates
  const polygons = merged
    .map((poly) => poly.map(roundRing).filter((ring) => ring.length >= 4))
    .filter((poly) => poly.length > 0);
  if (polygons.length === 0) return null;

  return polygons.length === 1
    ? { type: "Polygon", coordinates: polygons[0] }
    : { type: "MultiPolygon", coordinates: polygons };
}

/** Round to 3 decimals (~110 m) and drop points that became duplicates. */
function roundRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [round(x, 3), round(y, 3)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

/** Only used when JMA does not supply a circle radius. Grows with lead time. */
const fallbackConeRadiusKm = (hours) => round(30 + 3.5 * hours);

// --------------------------------------------------------------- JMA parsing
//
// Shapes below come from a real forecast.json (storm Champi, 2026-10-23):
//   title     {part:"title", issue:{UTC}, typhoonNumber, name:{en}}
//   analysis  {advancedHours:0, validtime:{UTC}, center:[lat,lng],
//              track:{preTyphoon:[[lat,lng]..], typhoon:[[lat,lng]..]},
//              galeWarningArea:{center:[lat,lng], radius:<metres>},
//              stormWarningArea:{arc:[[[lat,lng], <metres>, [fromDeg,toDeg]]..]}}
//   1H part   an ESTIMATE (no probabilityCircle) - dropped
//   3H+ parts {advancedHours, validtime:{UTC}, center:[lat,lng],
//              probabilityCircle:{radius:<metres>}}
// forecast.json carries NO wind speed or intensity. Those come from JMA's
// separate specifications.json (parsed by parseJmaSpecifications below):
//   title     {part:"title", category:{en:"TY"}, ...}
//   per time  {advancedHours, category:{en:"TY"|"STS"|"TS"|"LOW"},
//              maximumWind:{sustained:{"m/s":"40","kt":"80"}, gust:{"m/s","kt"}},
//              pressure:"955", position:{deg:[lat,lng]}, ...}   <- numbers are STRINGS
// Winds are JMA 10-minute sustained, the same basis PAGASA uses, so the PAGASA
// scale is applied to them directly. JMA class "LOW" means the system has
// become an extratropical low; it is passed through as `jmaClass`.

/** Radius (km) of the cone's starting circle: JMA's cone starts at a point. */
const CONE_START_RADIUS_KM = 1;

const validPair = (p) => Array.isArray(p) && isNum(p[0]) && isNum(p[1]);

/** Past track, oldest first; pre-typhoon (depression stage) points get `pre: true`. */
function buildTrack(analysis) {
  const track = [];
  const push = (pair, pre) => {
    if (!validPair(pair)) return;
    const [lat, lng] = pair;
    const last = track[track.length - 1];
    if (last && last.lat === lat && last.lng === lng) {
      // Stage hand-over repeats the same position: the later stage wins.
      if (pre) last.pre = true;
      else delete last.pre;
      return;
    }
    const point = { lat, lng };
    if (pre) point.pre = true;
    track.push(point);
  };
  const t = (analysis && analysis.track) || {};
  for (const pair of t.preTyphoon || []) push(pair, true);
  for (const pair of t.typhoon || []) push(pair, false);
  return track;
}

/** galeWarningArea -> { lat, lng, radiusKm } (circle), or null. */
function readGaleArea(area) {
  if (!area || !validPair(area.center) || !isNum(area.radius) || area.radius <= 0) return null;
  return { lat: area.center[0], lng: area.center[1], radiusKm: round(area.radius / 1000, 1) };
}

/** stormWarningArea -> { lat, lng, radiusKm } when it is one full circle, else null. */
function readStormArea(area) {
  const arcs = area && Array.isArray(area.arc) ? area.arc : [];
  if (arcs.length !== 1) return null;
  const [center, radius, range] = arcs[0];
  const full = Array.isArray(range) && range[0] <= 0 && range[1] >= 360;
  if (!validPair(center) || !isNum(radius) || radius <= 0 || !full) return null;
  return { lat: center[0], lng: center[1], radiusKm: round(radius / 1000, 1) };
}

function readRadiusKm(part) {
  const pc = part && part.probabilityCircle;
  const r = pc && typeof pc === "object" ? pc.radius : null;
  return isNum(r) && r > 0 ? round(r / 1000, 1) : null; // JMA gives metres
}

const toNum = (v) => {
  if (isNum(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};

/** Wind object {kt, "m/s"} (numbers or numeric strings) -> km/h, or null. */
function windObjToKph(w) {
  if (!w || typeof w !== "object") return null;
  const kt = toNum(w.kt);
  if (kt !== null) return round(ktToKph(kt));
  const ms = toNum(w["m/s"]);
  return ms !== null ? round(msToKph(ms)) : null;
}

/**
 * Parses JMA specifications.json into a lookup keyed by advancedHours:
 * { [hours]: { windKph, gustKph, pressureHpa, jmaClass } } (nulls when absent).
 * @param {object[]} parts
 */
function parseJmaSpecifications(parts) {
  const byHours = {};
  for (const p of Array.isArray(parts) ? parts : []) {
    if (!p || !isNum(p.advancedHours)) continue; // skips the title entry
    const wind = p.maximumWind || {};
    byHours[p.advancedHours] = {
      windKph: windObjToKph(wind.sustained),
      gustKph: windObjToKph(wind.gust),
      pressureHpa: toNum(p.pressure),
      jmaClass: (p.category && typeof p.category.en === "string" && p.category.en) || null,
    };
  }
  return byHours;
}

/**
 * @param {object[]} parts  parsed JMA `forecast.json`
 * @param {{nowIso?:string, specs?:object}} [opts]  `specs` = parseJmaSpecifications(...)
 */
function parseJmaForecast(parts, opts = {}) {
  const warnings = [];
  const specs = opts.specs || null;
  const list = Array.isArray(parts) ? parts.filter(Boolean) : [];

  const title = list.find((p) => p.part === "title");
  const analysis = list.find((p) => p.advancedHours === 0);
  // 1H is an estimate, not a forecast: real forecasts start at 3H.
  const forecasts = list
    .filter((p) => isNum(p.advancedHours) && p.advancedHours >= 3 && validPair(p.center))
    .sort((a, b) => a.advancedHours - b.advancedHours);

  const track = buildTrack(analysis);
  if (analysis && validPair(analysis.center)) {
    const [lat, lng] = analysis.center;
    const last = track[track.length - 1];
    if (!last || Math.abs(last.lat - lat) > 0.01 || Math.abs(last.lng - lng) > 0.01) {
      track.push({ lat, lng });
    }
  }

  const nowSpec = (specs && specs[0]) || null;
  if (nowSpec && nowSpec.windKph !== null && track.length) {
    track[track.length - 1].windKph = nowSpec.windKph;
  }
  if (!nowSpec || nowSpec.windKph === null) {
    warnings.push(
      "No wind speed for the current position (specifications.json missing or unreadable); categories stay blank."
    );
  }

  let missingRadius = 0;
  const forecast = forecasts.map((f) => {
    const point = {
      lat: f.center[0],
      lng: f.center[1],
      hours: f.advancedHours,
      label: `${f.advancedHours}H`,
    };
    if (f.validtime && f.validtime.UTC) point.validAt = f.validtime.UTC;
    const spec = specs && specs[f.advancedHours];
    if (spec && spec.windKph !== null) point.windKph = spec.windKph;
    if (spec && spec.jmaClass) point.jmaClass = spec.jmaClass;
    const radius = readRadiusKm(f);
    if (radius !== null) point.radiusKm = radius;
    else missingRadius += 1;
    return point;
  });
  if (missingRadius > 0) {
    warnings.push(
      `No probability-circle radius for ${missingRadius} forecast point(s); cone uses fallback growth.`
    );
  }

  // Cone: starts at the current position, widens through every forecast circle.
  const circles = [];
  if (analysis && validPair(analysis.center)) {
    circles.push({
      lat: analysis.center[0],
      lng: analysis.center[1],
      radiusKm: CONE_START_RADIUS_KM,
    });
  }
  for (const p of forecast) {
    circles.push({
      lat: p.lat,
      lng: p.lng,
      radiusKm: p.radiusKm !== undefined ? p.radiusKm : fallbackConeRadiusKm(p.hours),
    });
  }

  const galeArea = readGaleArea(analysis && analysis.galeWarningArea);
  const stormArea = readStormArea(analysis && analysis.stormWarningArea);
  const danger = stormArea || galeArea;

  return {
    name: (title && title.name && title.name.en) || null,
    issuedAtIso:
      (title && title.issue && title.issue.UTC) || opts.nowIso || new Date().toISOString(),
    analysisAt: (analysis && analysis.validtime && analysis.validtime.UTC) || null,
    track,
    forecast,
    maxWindsKph: nowSpec ? nowSpec.windKph : null,
    category: nowSpec && nowSpec.windKph !== null ? classifyPagasa(nowSpec.windKph).name : null,
    jmaClass: nowSpec ? nowSpec.jmaClass : null,
    gustKph: nowSpec ? nowSpec.gustKph : null,
    pressureHpa: nowSpec ? nowSpec.pressureHpa : null,
    galeArea,
    stormArea,
    dangerRadiusKm: danger ? danger.radiusKm : null,
    cone: buildCone(circles),
    warnings,
  };
}

module.exports = {
  KM_PER_DEG,
  PAGASA_SCALE,
  CONE_START_RADIUS_KM,
  classifyPagasa,
  msToKph,
  ktToKph,
  circlePoints,
  convexHull,
  buildCone,
  fallbackConeRadiusKm,
  readGaleArea,
  readStormArea,
  readRadiusKm,
  buildTrack,
  parseJmaSpecifications,
  parseJmaForecast,
};
