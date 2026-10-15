import '../models/typhoon.dart';
import 'province_lookup.dart';

class StormSignalResolver {
  const StormSignalResolver(this.lookup);

  final ProvinceLookup lookup;

  String? provinceFor(double lat, double lng) => lookup.provinceAt(lat, lng);

  StormSignal? resolve(Typhoon? typhoon, double lat, double lng) {
    if (typhoon == null || !typhoon.hasSignals) return null;
    final province = lookup.provinceAt(lat, lng);
    if (province == null) return null;

    final key = canonicalArea(province);
    StormSignal? best;
    for (final signal in typhoon.signals) {
      final matches = signal.areas.any((area) => canonicalArea(area) == key);
      if (matches && (best == null || signal.level > best.level)) {
        best = signal;
      }
    }
    return best;
  }
}
