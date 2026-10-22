// Great-circle distance between two lat/lng points, in kilometres.
export function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null)) return Infinity;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Nearest team to a point, using each team's base{lat,lng}. Teams without a
// base are ignored; returns null when no team has coordinates.
export function nearestTeam(teams, lat, lng) {
  if (lat == null || lng == null) return null;
  let best = null;
  for (const team of teams) {
    const base = team.base;
    if (!base || base.lat == null || base.lng == null) continue;
    const d = distanceKm(lat, lng, base.lat, base.lng);
    if (!best || d < best.km) best = { team, km: d };
  }
  return best;
}
