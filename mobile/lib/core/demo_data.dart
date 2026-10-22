import '../models/rain_forecast.dart';
import '../models/typhoon.dart';

/// Bundled demo snapshot used when [AppConfig.demoMode] is on and/or the live
/// hazard feeds are empty. It mirrors the real feeds' shape so the map overlays
/// render for demos without any Firebase seed.
///
/// Storm: TS Ondoy (Ketsana), 24-29 Sep 2009 — real track + real PAGASA signals.
/// Toggle everything off by setting `AppConfig.demoMode = false`.
class DemoData {
  DemoData._();

  static final Typhoon typhoon = Typhoon(
    id: 'demo-ondoy-2009',
    name: 'Ondoy',
    internationalName: 'Ketsana',
    category: 'Tropical Storm',
    source: 'PAGASA',
    sourceUrl:
        'https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin',
    postedAt: DateTime.now(),
    active: true,
    maxWindsKph: 95,
    track: const [
      [14.1, 128.0],
      [14.4, 125.8],
      [14.9, 123.6],
      [15.3, 121.6],
      [15.5, 119.8],
      [15.6, 116.5],
      [15.8, 112.5],
      [15.9, 108.5],
    ],
    forecast: const [
      TyphoonPoint(lat: 15.2, lng: 122.0, hours: 12, label: '12H'),
      TyphoonPoint(lat: 15.4, lng: 120.4, hours: 24, label: '24H'),
      TyphoonPoint(lat: 15.6, lng: 119.0, hours: 36, label: '36H'),
    ],
    cone: const {
      'type': 'Polygon',
      'coordinates': [
        [
          [123.6, 15.3],
          [122.0, 15.9],
          [120.4, 16.4],
          [119.0, 16.9],
          [119.0, 14.3],
          [120.4, 14.4],
          [122.0, 14.5],
          [123.6, 14.5],
          [123.6, 15.3],
        ],
      ],
    },
    dangerRadiusKm: 250,
    signals: const [
      StormSignal(level: 2, areas: [
        'Pangasinan',
        'Nueva Vizcaya',
        'Quirino',
        'Aurora',
        'Nueva Ecija',
        'Zambales',
        'Tarlac',
        'Pampanga',
        'Bulacan',
        'Quezon',
      ]),
      StormSignal(level: 1, areas: [
        'Metro Manila',
        'Bataan',
        'Rizal',
        'Cavite',
        'Laguna',
        'Batangas',
        'Camarines Norte',
        'Marinduque',
        'Occidental Mindoro',
        'Oriental Mindoro',
        'Ilocos Sur',
        'La Union',
        'Benguet',
        'Isabela',
        'Mountain Province',
        'Ifugao',
      ]),
    ],
  );

  static final RainForecast rain = RainForecast(
    source: 'Open-Meteo',
    postedAt: DateTime.now(),
    regions: const [
      RegionRain(name: 'NCR', level: 3, mm: 455),
      RegionRain(name: 'Calabarzon', level: 3, mm: 332),
      RegionRain(name: 'Central Luzon', level: 2, mm: 120),
      RegionRain(name: 'Bicol Region', level: 2, mm: 95),
      RegionRain(name: 'Ilocos Region', level: 1, mm: 40),
      RegionRain(name: 'Cagayan Valley', level: 1, mm: 45),
      RegionRain(name: 'CAR', level: 1, mm: 60),
      RegionRain(name: 'Mimaropa', level: 1, mm: 55),
      RegionRain(name: 'Western Visayas', level: 1, mm: 35),
      RegionRain(name: 'Central Visayas', level: 1, mm: 30),
      RegionRain(name: 'Eastern Visayas', level: 1, mm: 38),
      RegionRain(name: 'Zamboanga Peninsula', level: 1, mm: 25),
      RegionRain(name: 'Northern Mindanao', level: 1, mm: 28),
      RegionRain(name: 'Davao Region', level: 1, mm: 22),
      RegionRain(name: 'Soccsksargen', level: 1, mm: 20),
      RegionRain(name: 'Caraga', level: 1, mm: 32),
      RegionRain(name: 'ARMM', level: 1, mm: 18),
    ],
  );
}
