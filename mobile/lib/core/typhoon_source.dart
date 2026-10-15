import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/typhoon.dart';

abstract class TyphoonSource {
  Future<Typhoon?> getActiveTyphoon();
  Future<List<StormSignal>> getStormSignals();
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

  @override
  Future<List<StormSignal>> getStormSignals() async {
    final typhoon = await getActiveTyphoon();
    return typhoon?.signals ?? const [];
  }
}
