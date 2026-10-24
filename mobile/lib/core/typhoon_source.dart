import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/typhoon.dart';
import 'demo_data.dart';

abstract class TyphoonSource {
  Future<Typhoon?> getActiveTyphoon();
}

/// Demo source: serves the bundled Ondoy snapshot (no Firestore). Used when
/// `AppConfig.demoMode` is on.
class DemoTyphoonSource implements TyphoonSource {
  @override
  Future<Typhoon?> getActiveTyphoon() async => DemoData.typhoon;
}

class FirestoreTyphoonSource implements TyphoonSource {
  FirestoreTyphoonSource({FirebaseFirestore? firestore})
      : _db = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _db;
  static const String collection = 'bulletins';

  @override
  Future<Typhoon?> getActiveTyphoon() async {
    final snapshot =
        await _db.collection(collection).where('active', isEqualTo: true).get();
    if (snapshot.docs.isEmpty) return null;

    return selectActiveTyphoon(
      snapshot.docs.map((d) => Typhoon.fromMap(d.id, d.data())),
    );
  }
}

/// Which bulletin the app shows. The live JMA feed wins over the demo-only
/// simulation (`bulletins/simulation`), unless the simulation was switched on
/// with `overrideLive` (for demos while a real storm is on the map).
Typhoon? selectActiveTyphoon(Iterable<Typhoon> candidates) {
  final active = candidates.where((t) => t.active).toList();
  if (active.isEmpty) return null;

  int newestFirst(Typhoon a, Typhoon b) => b.postedAt.compareTo(a.postedAt);
  final live = active.where((t) => !t.isSimulation).toList()..sort(newestFirst);
  final sims = active.where((t) => t.isSimulation).toList()..sort(newestFirst);

  final forced = sims.where((t) => t.overridesLive).toList();
  if (forced.isNotEmpty) return forced.first;
  if (live.isNotEmpty) return live.first;
  return sims.isEmpty ? null : sims.first;
}
