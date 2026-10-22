import 'package:cloud_firestore/cloud_firestore.dart';

import '../config/app_config.dart';
import '../models/rain_forecast.dart';
import 'demo_data.dart';

/// Reads the weekly rainfall forecast written by the fetcher (Open-Meteo).
class RainService {
  RainService._();
  static final RainService instance = RainService._();

  FirebaseFirestore get _db => FirebaseFirestore.instance;

  Future<RainForecast?> latest() async {
    if (AppConfig.demoMode) return DemoData.rain;
    final snap = await _db.collection('forecasts').doc('rain').get();
    final data = snap.data();
    if (data == null) return null;
    return RainForecast.fromMap(data);
  }
}
