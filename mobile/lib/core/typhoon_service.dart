import '../models/typhoon.dart';
import 'typhoon_source.dart';

class TyphoonService {
  TyphoonService._({TyphoonSource? source})
      : _source = source ?? FirestoreTyphoonSource();

  static final TyphoonService instance = TyphoonService._();

  final TyphoonSource _source;
  static const Duration _ttl = Duration(minutes: 10);

  Typhoon? _cached;
  DateTime? _cachedAt;
  String? dismissedBulletinId;

  Future<Typhoon?> getActiveTyphoon({bool force = false}) async {
    final isFresh = !force &&
        _cachedAt != null &&
        DateTime.now().difference(_cachedAt!) < _ttl;
    if (isFresh) return _cached;

    final typhoon = await _source.getActiveTyphoon();
    _cached = typhoon;
    _cachedAt = DateTime.now();
    return typhoon;
  }

  Future<List<StormSignal>> getStormSignals({bool force = false}) async {
    final typhoon = await getActiveTyphoon(force: force);
    return typhoon?.signals ?? const [];
  }

  Future<void> refresh() async {
    await getActiveTyphoon(force: true);
  }

  bool isDismissed(Typhoon? typhoon) =>
      typhoon != null && typhoon.id == dismissedBulletinId;

  void dismiss(Typhoon typhoon) {
    dismissedBulletinId = typhoon.id;
  }

  void clearCache() {
    _cached = null;
    _cachedAt = null;
  }
}
