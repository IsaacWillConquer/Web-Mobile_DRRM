import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../config/app_config.dart';
import '../core/cloudinary_service.dart';
import '../core/location.dart';
import '../core/report_service.dart';

const LatLng _defaultCenter = LatLng(14.8527, 120.8160);

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final _formKey = GlobalKey<FormState>();
  final _description = TextEditingController();
  final _people = TextEditingController(text: '1');
  final _victimName = TextEditingController();
  final _victimContact = TextEditingController();
  final _relationship = TextEditingController();
  final _specialNeeds = TextEditingController();
  final _notes = TextEditingController();

  MapLibreMapController? _mapController;
  Circle? _pin;
  bool _styleLoaded = false;

  String _disasterType = AppConfig.disasterTypes.first;
  String _onBehalfOf = 'self';
  LatLng? _position;
  final List<XFile> _photos = [];
  bool _locating = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _description.dispose();
    _people.dispose();
    _victimName.dispose();
    _victimContact.dispose();
    _relationship.dispose();
    _specialNeeds.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _syncPin() async {
    final controller = _mapController;
    if (controller == null || !_styleLoaded || _position == null) return;
    final options = CircleOptions(
      geometry: _position!,
      circleRadius: 9,
      circleColor: '#D32F2F',
      circleStrokeColor: '#FFFFFF',
      circleStrokeWidth: 3,
    );
    if (_pin == null) {
      _pin = await controller.addCircle(options);
    } else {
      await controller.updateCircle(_pin!, options);
    }
  }

  Future<void> _useMyLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      final pos = await resolvePosition(accuracy: LocationAccuracy.high);
      if (pos == null) {
        throw Exception('Location unavailable. Tap the map to set it manually.');
      }
      final point = LatLng(pos.latitude, pos.longitude);
      setState(() => _position = point);
      await _syncPin();
      await _mapController?.animateCamera(
        CameraUpdate.newLatLngZoom(point, 15),
      );
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _pickPhotos() async {
    final remaining = 3 - _photos.length;
    if (remaining <= 0) return;
    final picked = await ImagePicker().pickMultiImage(
      limit: remaining,
      imageQuality: 70,
    );
    if (picked.isEmpty) return;
    final valid = <XFile>[];
    final problems = <String>[];
    for (final photo in picked) {
      final problem = await CloudinaryService.validateImage(photo.path);
      if (problem == null) {
        valid.add(photo);
      } else {
        problems.add(problem);
      }
    }
    if (problems.isNotEmpty && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(problems.join('\n'))),
      );
    }
    if (valid.isEmpty) return;
    setState(() => _photos.addAll(valid.take(remaining)));
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_position == null) {
      setState(() => _error = 'Set the incident location (use GPS or tap the map).');
      return;
    }
    if (_onBehalfOf == 'other' && _victimName.text.trim().isEmpty) {
      setState(() => _error = 'Enter the name of the person you are reporting for.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final urls = <String>[];
      for (final photo in _photos) {
        urls.add(await CloudinaryService.instance.uploadImage(photo.path));
      }

      final people = int.tryParse(_people.text.trim()) ?? 1;
      final reportId = await ReportService.instance.submitReport(
        disasterType: _disasterType,
        description: _description.text.trim(),
        onBehalfOf: _onBehalfOf,
        lat: _position!.latitude,
        lng: _position!.longitude,
        peopleAffected: people,
        imageUrls: urls,
      );

      await ReportService.instance.saveContact(reportId, {
        'subject': _onBehalfOf,
        'victimName': _victimName.text.trim(),
        'victimContact': _victimContact.text.trim(),
        'relationship': _relationship.text.trim(),
        'peopleCount': people,
        'specialNeeds': _specialNeeds.text
            .split(',')
            .map((e) => e.trim())
            .where((e) => e.isNotEmpty)
            .toList(),
        'notes': _notes.text.trim(),
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report submitted. Keep safe.')),
      );
      Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report an Emergency')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const _SectionLabel('What is happening?'),
            DropdownButtonFormField<String>(
              initialValue: _disasterType,
              decoration: const InputDecoration(labelText: 'Disaster type'),
              items: AppConfig.disasterTypes
                  .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                  .toList(),
              onChanged: (value) =>
                  setState(() => _disasterType = value ?? _disasterType),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _description,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Description',
                hintText: 'What do you see? Any immediate danger?',
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Describe the situation.' : null,
            ),
            const SizedBox(height: 20),

            const _SectionLabel('Location'),
            SizedBox(
              height: 220,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: MapLibreMap(
                  styleString: AppConfig.mapStyleUrl,
                  initialCameraPosition: const CameraPosition(
                    target: _defaultCenter,
                    zoom: 13,
                  ),
                  onMapCreated: (controller) => _mapController = controller,
                  onStyleLoadedCallback: () {
                    _styleLoaded = true;
                    _syncPin();
                  },
                  onMapClick: (point, latlng) {
                    setState(() => _position = latlng);
                    _syncPin();
                  },
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _locating ? null : _useMyLocation,
                    icon: _locating
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.my_location),
                    label: const Text('Use my location'),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                _position == null
                    ? 'Tap the map to drop a pin, or use GPS.'
                    : 'Pin: ${_position!.latitude.toStringAsFixed(5)}, '
                        '${_position!.longitude.toStringAsFixed(5)}',
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
            ),
            const SizedBox(height: 20),

            const _SectionLabel('Photos (optional, up to 3)'),
            Row(
              children: [
                for (final photo in _photos)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(
                            File(photo.path),
                            width: 72,
                            height: 72,
                            fit: BoxFit.cover,
                          ),
                        ),
                        Positioned(
                          right: 0,
                          top: 0,
                          child: GestureDetector(
                            onTap: () => setState(() => _photos.remove(photo)),
                            child: const CircleAvatar(
                              radius: 10,
                              backgroundColor: Colors.black54,
                              child: Icon(Icons.close, size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (_photos.length < 3)
                  OutlinedButton(
                    onPressed: _pickPhotos,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(72, 72),
                      padding: EdgeInsets.zero,
                    ),
                    child: const Icon(Icons.add_a_photo),
                  ),
              ],
            ),
            const SizedBox(height: 20),

            const _SectionLabel('Who is this for?'),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'self', label: Text('Myself')),
                ButtonSegment(value: 'other', label: Text('Someone else')),
              ],
              selected: {_onBehalfOf},
              onSelectionChanged: (s) => setState(() => _onBehalfOf = s.first),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _people,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'People affected'),
            ),
            if (_onBehalfOf == 'other') ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _victimName,
                decoration: const InputDecoration(labelText: 'Victim name'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _victimContact,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Victim contact number'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _relationship,
                decoration: const InputDecoration(labelText: 'Your relationship'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _specialNeeds,
                decoration: const InputDecoration(
                  labelText: 'Special needs (comma-separated)',
                  hintText: 'e.g. elderly, PWD, infant',
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _notes,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Notes for responders'),
              ),
            ],
            const SizedBox(height: 20),

            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                'Submitting a report does not guarantee immediate rescue. '
                'For life-threatening emergencies, call the LDRRMO hotline '
                '${AppConfig.ldrrmoHotline}.',
                style: TextStyle(fontSize: 12.5, color: Colors.amber.shade900),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Submit report'),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    );
  }
}
