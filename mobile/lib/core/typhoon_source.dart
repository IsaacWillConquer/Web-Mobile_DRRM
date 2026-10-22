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

    final typhoons =
        snapshot.docs.map((d) => Typhoon.fromMap(d.id, d.data())).toList();
    typhoons.sort((a, b) => b.postedAt.compareTo(a.postedAt));
    return typhoons.first;
  }
}
