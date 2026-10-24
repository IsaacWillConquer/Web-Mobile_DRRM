/// PAGASA tropical cyclone categories, by 10-minute sustained wind (km/h).
/// Pure Dart so it is unit-testable.
class PagasaCategory {
  const PagasaCategory(this.code, this.name);

  final String code;
  final String name;
}

const PagasaCategory _tropicalDepression =
    PagasaCategory('TD', 'Tropical Depression');
const PagasaCategory _tropicalStorm = PagasaCategory('TS', 'Tropical Storm');
const PagasaCategory _severeTropicalStorm =
    PagasaCategory('STS', 'Severe Tropical Storm');
const PagasaCategory _typhoon = PagasaCategory('TY', 'Typhoon');
const PagasaCategory _superTyphoon = PagasaCategory('STY', 'Super Typhoon');

/// TD up to 61 km/h, TS 62-88, STS 89-117, TY 118-184, STY 185 and above.
/// Returns null when the wind is unknown.
PagasaCategory? classifyPagasa(num? windKph) {
  if (windKph == null || windKph.isNaN || windKph < 0) return null;
  if (windKph < 62) return _tropicalDepression;
  if (windKph < 89) return _tropicalStorm;
  if (windKph < 118) return _severeTropicalStorm;
  if (windKph < 185) return _typhoon;
  return _superTyphoon;
}

/// Short code shown on a map marker. JMA's `LOW` (the system has become an
/// extratropical low) is kept as `LOW` instead of forcing a PAGASA category.
String? markerCode({num? windKph, String? jmaClass}) {
  if (jmaClass == 'LOW') return 'LOW';
  return classifyPagasa(windKph)?.code;
}

/// Marker fill colour for a category code (severity ramp, cool to hot).
String categoryColorHex(String? code) {
  switch (code) {
    case 'TD':
      return '#3B82F6';
    case 'TS':
      return '#F59E0B';
    case 'STS':
      return '#F97316';
    case 'TY':
      return '#DC2626';
    case 'STY':
      return '#9D174D';
    default:
      return '#6B7280'; // LOW or unknown
  }
}
