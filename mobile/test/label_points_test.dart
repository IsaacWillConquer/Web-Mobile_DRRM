import 'package:drrm_mobile/core/overlays.dart';
import 'package:flutter_test/flutter_test.dart';

List<List<double>> _square(double x, double y, double size) => [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ];

bool _inside(List<List<double>> ring, double x, double y) {
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    final xi = ring[i][0];
    final yi = ring[i][1];
    final xj = ring[j][0];
    final yj = ring[j][1];
    if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

void main() {
  group('labelPoint', () {
    test('a square gets its middle', () {
      final p = labelPoint({
        'type': 'Polygon',
        'coordinates': [_square(0, 0, 10)],
      })!;
      expect(p[0], closeTo(5, 0.5));
      expect(p[1], closeTo(5, 0.5));
    });

    test('a C-shape gets a point inside it, not in the notch', () {
      final c = <List<double>>[
        [0, 0],
        [10, 0],
        [10, 3],
        [3, 3],
        [3, 7],
        [10, 7],
        [10, 10],
        [0, 10],
        [0, 0],
      ];
      final p = labelPoint({
        'type': 'Polygon',
        'coordinates': [c],
      })!;
      expect(_inside(c, p[0], p[1]), isTrue);
    });

    test('a multi-part feature is labelled on its largest part', () {
      final p = labelPoint({
        'type': 'MultiPolygon',
        'coordinates': [
          [_square(50, 5, 1)], // small island
          [_square(0, 0, 10)], // main land
        ],
      })!;
      expect(p[0], lessThan(20));
      expect(p[0], greaterThan(0));
    });

    test('empty or unsupported geometry gives null', () {
      expect(labelPoint(null), isNull);
      expect(labelPoint({'type': 'Polygon', 'coordinates': []}), isNull);
      expect(
        labelPoint({'type': 'Point', 'coordinates': [1, 2]}),
        isNull,
      );
    });
  });

  group('buildLabelPoints', () {
    final polygons = {
      'type': 'FeatureCollection',
      'features': [
        {
          'type': 'Feature',
          'properties': {'name': 'A', 'level': 2, 'label': '2'},
          'geometry': {
            'type': 'MultiPolygon',
            'coordinates': [
              [_square(0, 0, 10)],
              [_square(30, 0, 2)],
            ],
          },
        },
        {
          'type': 'Feature',
          'properties': {'name': 'B', 'level': 1, 'label': '1'},
          'geometry': {
            'type': 'Polygon',
            'coordinates': [_square(20, 0, 4)],
          },
        },
        {
          'type': 'Feature',
          'properties': {'name': 'Empty', 'level': 3, 'label': '3'},
          'geometry': {'type': 'Polygon', 'coordinates': []},
        },
      ],
    };

    test('one Point per feature, however many parts it has', () {
      final out = buildLabelPoints(polygons);
      final features = out['features'] as List;
      expect(features.length, 2); // A (two parts) and B; Empty is dropped
      for (final f in features) {
        expect((f as Map)['geometry']['type'], 'Point');
      }
    });

    test('keeps the label and level properties', () {
      final features = buildLabelPoints(polygons)['features'] as List;
      final props = (features.first as Map)['properties'] as Map;
      expect(props['label'], '2');
      expect(props['level'], 2);
    });
  });

  test('kSignalLevels covers signals 1-5 with distinct colours', () {
    expect(kSignalLevels.map((s) => s.level), [1, 2, 3, 4, 5]);
    expect(kSignalLevels.map((s) => s.colorHex).toSet().length, 5);
    for (final s in kSignalLevels) {
      expect(s.colorHex, matches(RegExp(r'^#[0-9A-Fa-f]{6}$')));
      expect(s.winds, isNotEmpty);
    }
  });
}
