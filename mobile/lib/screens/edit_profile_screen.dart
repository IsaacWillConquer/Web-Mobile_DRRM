import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../config/app_config.dart';
import '../core/auth_service.dart';
import '../core/cloudinary_service.dart';
import '../core/profile_validators.dart';
import '../widgets/profile_widgets.dart';

/// Editable profile form.
///
/// Edits the fields the resident entered at registration. First name, last
/// name and mobile number are shown but not editable: the mobile number is the
/// sign-in identifier. Pops with `true` when the changes were saved.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key, required this.current});

  final AppUserProfile current;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final TextEditingController _middleName =
      TextEditingController(text: widget.current.middleName);
  late final TextEditingController _suffix =
      TextEditingController(text: widget.current.suffix);
  late final TextEditingController _email =
      TextEditingController(text: widget.current.email);
  late final TextEditingController _city =
      TextEditingController(text: _address('city'));
  late final TextEditingController _barangay =
      TextEditingController(text: _address('barangay'));
  late final TextEditingController _street =
      TextEditingController(text: _address('street'));
  late final TextEditingController _addressLine =
      TextEditingController(text: _address('line'));
  late final TextEditingController _houseFloor =
      TextEditingController(text: _household('houseFloor'));
  late final TextEditingController _pets =
      TextEditingController(text: _household('pets'));

  late DateTime? _birthdate = widget.current.birthdate;
  late final Set<String> _disability = widget.current.disability.isEmpty
      ? {'None'}
      : widget.current.disability.toSet();

  bool _busy = false;
  bool _pickingPhoto = false;
  String? _error;

  /// A photo chosen in this session but not uploaded yet. It is uploaded when
  /// the form is saved, so cancelling never leaves a stray upload behind.
  String? _pickedPath;
  bool _removePhoto = false;

  String _address(String key) => (widget.current.address[key] ?? '') as String;
  String _household(String key) =>
      (widget.current.household[key] ?? '') as String;

  String get _initials {
    final first = widget.current.firstName;
    final last = widget.current.lastName;
    return '${first.isEmpty ? '' : first[0]}${last.isEmpty ? '' : last[0]}'
        .toUpperCase();
  }

  String? get _savedPhoto {
    if (_removePhoto) return null;
    final url = widget.current.photoUrl;
    return url.isEmpty ? null : url;
  }

  bool get _hasPhoto => _pickedPath != null || _savedPhoto != null;

  @override
  void dispose() {
    for (final c in [
      _middleName, _suffix, _email,
      _city, _barangay, _street, _addressLine, _houseFloor, _pets,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickBirthdate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthdate ?? DateTime(now.year - 18, now.month, now.day),
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: 'Select birthdate',
    );
    if (picked != null) setState(() => _birthdate = picked);
  }

  Future<void> _choosePhoto() async {
    setState(() => _pickingPhoto = true);
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 80,
      );
      if (picked == null) return;
      final problem = await CloudinaryService.validateImage(picked.path);
      if (!mounted) return;
      if (problem != null) {
        _showError(problem);
        return;
      }
      setState(() {
        _pickedPath = picked.path;
        _removePhoto = false;
        _error = null;
      });
    } catch (_) {
      if (mounted) _showError("Couldn't open your photos. Try again.");
    } finally {
      if (mounted) setState(() => _pickingPhoto = false);
    }
  }

  /// Shows [message] where the person is looking: in the form just above the
  /// Save button, and as a snackbar. (The form is long, so an error placed at
  /// the top would be off-screen when Save is tapped at the bottom.)
  void _showError(String message) {
    setState(() => _error = message);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
  }

  void _clearPhoto() {
    setState(() {
      _pickedPath = null;
      _removePhoto = true;
    });
  }

  void _toggleDisability(String option, bool selected) {
    setState(() {
      if (option == 'None') {
        _disability
          ..clear()
          ..add('None');
      } else {
        _disability.remove('None');
        if (selected) {
          _disability.add(option);
        } else {
          _disability.remove(option);
        }
        if (_disability.isEmpty) _disability.add('None');
      }
    });
  }

  String _friendly(Object err) {
    if (err is FirebaseException) {
      if (err.code == 'permission-denied') {
        return "Couldn't save: Firestore denied the update (permission-denied). "
            'The security rules must let a user update their own users document.';
      }
      return "Couldn't save your profile (${err.code}). "
          'Check your connection and try again.';
    }
    final message = err.toString();
    if (message.startsWith('Exception: ')) {
      return message.substring('Exception: '.length);
    }
    return "Couldn't save your profile. Check your connection.";
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();

    final problem = validateProfileEdit(
      email: _email.text,
      birthdate: _birthdate,
      disability: _disability,
      city: _city.text,
      barangay: _barangay.text,
      street: _street.text,
    );
    if (problem != null) {
      _showError(problem);
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      String? photoUrl;
      if (_pickedPath != null) {
        photoUrl = await CloudinaryService.instance.uploadImage(_pickedPath!);
      }
      await AuthService.instance.updateProfile(
        middleName: _middleName.text,
        suffix: _suffix.text,
        email: _email.text,
        birthdate: _birthdate!,
        disability: _disability.toList(),
        city: _city.text,
        barangay: _barangay.text,
        street: _street.text,
        addressLine: _addressLine.text,
        houseFloor: _houseFloor.text,
        pets: _pets.text,
        photoUrl: photoUrl,
        removePhoto: _removePhoto && _pickedPath == null,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (err) {
      if (mounted) _showError(_friendly(err));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final mutedStyle = TextStyle(fontSize: 12, color: scheme.onSurfaceVariant);

    return Scaffold(
      appBar: AppBar(title: const Text('Edit profile')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            const ProfileSectionHeader('Photo'),
            Row(
              children: [
                ProfileAvatar(
                  initials: _initials,
                  photoUrl: _savedPhoto,
                  localPath: _pickedPath,
                  size: 72,
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: (_busy || _pickingPhoto) ? null : _choosePhoto,
                        icon: _pickingPhoto
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.photo_library_outlined, size: 18),
                        label: Text(_hasPhoto ? 'Change photo' : 'Add photo'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 40),
                        ),
                      ),
                      if (_hasPhoto)
                        TextButton(
                          onPressed: _busy ? null : _clearPhoto,
                          child: const Text('Remove'),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('JPG, PNG, WEBP or HEIC, up to 10 MB.', style: mutedStyle),

            const SizedBox(height: 28),
            const ProfileSectionHeader('Name'),
            ProfileInfoRow('First name', widget.current.firstName),
            ProfileInfoRow('Last name', widget.current.lastName),
            Text(
              'Your first and last name can’t be changed here.',
              style: mutedStyle,
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _middleName,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Middle name (optional)',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _suffix,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Suffix (optional)',
                hintText: 'e.g. Jr., III',
              ),
            ),

            const SizedBox(height: 28),
            const ProfileSectionHeader('Personal'),
            InkWell(
              onTap: _pickBirthdate,
              borderRadius: BorderRadius.circular(10),
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Birthdate',
                  suffixIcon: Icon(Icons.calendar_today, size: 18),
                ),
                child: Text(
                  _birthdate == null
                      ? 'Select date'
                      : formatDisplayDate(_birthdate!),
                  style: TextStyle(
                    color: _birthdate == null
                        ? scheme.outline
                        : scheme.onSurface,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Disability',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final option in AppConfig.disabilityOptions)
                  FilterChip(
                    label: Text(option),
                    selected: _disability.contains(option),
                    onSelected: (selected) =>
                        _toggleDisability(option, selected),
                  ),
              ],
            ),

            const SizedBox(height: 28),
            const ProfileSectionHeader('Contact'),
            ProfileInfoRow('Mobile number', widget.current.phone),
            Text(
              'Your mobile number is how you sign in, so it can’t be changed here.',
              style: mutedStyle,
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(labelText: 'Email'),
            ),

            const SizedBox(height: 28),
            const ProfileSectionHeader('Home'),
            TextField(
              controller: _city,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'City / Municipality'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _barangay,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Barangay'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _street,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Street'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _addressLine,
              decoration: const InputDecoration(
                labelText: 'Address (house / unit no.)',
              ),
            ),

            const SizedBox(height: 28),
            const ProfileSectionHeader('Household'),
            TextField(
              controller: _houseFloor,
              decoration: const InputDecoration(
                labelText: 'House floor',
                hintText: 'e.g. 2nd floor, bungalow',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _pets,
              decoration: const InputDecoration(
                labelText: 'Pets',
                hintText: 'e.g. 2 dogs, 1 cat',
              ),
            ),

            const SizedBox(height: 32),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: scheme.errorContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _error!,
                  style: TextStyle(
                    fontSize: 13,
                    color: scheme.onErrorContainer,
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            FilledButton(
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Save changes'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _busy ? null : () => Navigator.of(context).pop(false),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
    );
  }
}
