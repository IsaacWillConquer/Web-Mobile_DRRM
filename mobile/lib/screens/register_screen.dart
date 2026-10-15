import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../config/app_config.dart';
import '../core/auth_service.dart';
import '../core/phone.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  int _step = 0;
  String? _error;
  bool _busy = false;

  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();

  final _firstName = TextEditingController();
  final _middleName = TextEditingController();
  final _lastName = TextEditingController();
  final _suffix = TextEditingController();
  DateTime? _birthdate;
  final Set<String> _disability = {'None'};

  final _city = TextEditingController();
  final _barangay = TextEditingController();
  final _street = TextEditingController();
  final _addressLine = TextEditingController();
  final _houseFloor = TextEditingController();
  final _pets = TextEditingController();

  static const _stepTitles = ['Account', 'Personal', 'Home & household'];

  @override
  void dispose() {
    for (final c in [
      _phone, _email, _password, _confirm,
      _firstName, _middleName, _lastName, _suffix,
      _city, _barangay, _street, _addressLine, _houseFloor, _pets,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  bool _validateStep(int step) {
    String? error;
    if (step == 0) {
      if (normalizePhone(_phone.text) == null) {
        error = 'Enter a valid 10-digit mobile number (9XXXXXXXXX).';
      } else if (!_email.text.contains('@') || _email.text.trim().length < 3) {
        error = 'Enter a valid email address.';
      } else if (_password.text.length < 6) {
        error = 'Password must be at least 6 characters.';
      } else if (_password.text != _confirm.text) {
        error = 'Passwords do not match.';
      }
    } else if (step == 1) {
      if (_firstName.text.trim().isEmpty) {
        error = 'Enter your first name.';
      } else if (_lastName.text.trim().isEmpty) {
        error = 'Enter your last name.';
      } else if (_birthdate == null) {
        error = 'Select your birthdate.';
      } else if (_disability.isEmpty) {
        error = 'Select at least one option.';
      }
    } else {
      if (_city.text.trim().isEmpty) {
        error = 'Enter your city / municipality.';
      } else if (_barangay.text.trim().isEmpty) {
        error = 'Enter your barangay.';
      } else if (_street.text.trim().isEmpty) {
        error = 'Enter your street.';
      }
    }
    setState(() => _error = error);
    return error == null;
  }

  void _next() {
    if (!_validateStep(_step)) return;
    setState(() => _step += 1);
  }

  void _back() {
    setState(() {
      _error = null;
      _step -= 1;
    });
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

  Future<void> _finish() async {
    if (!_validateStep(2)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AuthService.instance.register(
        phone: _phone.text,
        email: _email.text,
        password: _password.text,
        firstName: _firstName.text,
        middleName: _middleName.text,
        lastName: _lastName.text,
        suffix: _suffix.text,
        birthdate: _birthdate!,
        disability: _disability.toList(),
        city: _city.text,
        barangay: _barangay.text,
        street: _street.text,
        addressLine: _addressLine.text,
        houseFloor: _houseFloor.text,
        pets: _pets.text,
      );
      if (mounted) Navigator.of(context).pop();
    } catch (err) {
      setState(() => _error = _friendly(err));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _friendly(Object err) {
    final message = err.toString();
    if (message.contains('email-already-in-use')) {
      return 'This mobile number is already registered.';
    }
    if (message.contains('weak-password')) {
      return 'Password must be at least 6 characters.';
    }
    if (message.contains('invalid-api-key') || message.contains('configuration')) {
      return 'Firebase is not configured yet. See docs/SETUP.md.';
    }
    return 'Unable to create the account. Try again.';
  }

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    return Scaffold(
      appBar: AppBar(title: const Text('Create account')),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Step ${_step + 1} of 3 · ${_stepTitles[_step]}',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: accent,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: (_step + 1) / 3,
                      minHeight: 6,
                      backgroundColor: accent.withValues(alpha: 0.12),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: _buildStep(_step),
              ),
            ),
            _error == null
                ? const SizedBox.shrink()
                : Padding(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
                    child: Text(
                      _error!,
                      style: TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
                  ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
              child: Row(
                children: [
                  if (_step > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _busy ? null : _back,
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(52),
                        ),
                        child: const Text('Back'),
                      ),
                    ),
                  if (_step > 0) const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      onPressed: _busy
                          ? null
                          : (_step < 2 ? _next : _finish),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(52),
                      ),
                      child: _busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(_step < 2 ? 'Next' : 'Create account'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildStep(int step) {
    switch (step) {
      case 0:
        return [
          _PhoneField(controller: _phone),
          const SizedBox(height: 16),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password'),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _confirm,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Confirm password'),
          ),
          const SizedBox(height: 8),
          const Text(
            'You will sign in with your mobile number.',
            style: TextStyle(fontSize: 12, color: Colors.black54),
          ),
        ];
      case 1:
        return [
          TextField(
            controller: _firstName,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'First name'),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _middleName,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              labelText: 'Middle name (optional)',
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _lastName,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Last name'),
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
          const SizedBox(height: 16),
          InkWell(
            onTap: _pickBirthdate,
            borderRadius: BorderRadius.circular(10),
            child: InputDecorator(
              decoration: const InputDecoration(
                labelText: 'Birthdate',
                suffixIcon: Icon(Icons.calendar_today, size: 18),
              ),
              child: Text(
                _birthdate == null ? 'Select date' : _formatDate(_birthdate!),
                style: TextStyle(
                  color: _birthdate == null ? Colors.black38 : Colors.black87,
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
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
                  onSelected: (selected) => setState(() {
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
                  }),
                ),
            ],
          ),
        ];
      default:
        return [
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
          const SizedBox(height: 24),
          Text(
            'Household',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 8),
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
        ];
    }
  }
}

class _PhoneField extends StatelessWidget {
  const _PhoneField({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.phone,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(kPhoneDigits),
      ],
      decoration: const InputDecoration(
        labelText: 'Mobile number',
        hintText: '9171234567',
        prefixIcon: Padding(
          padding: EdgeInsets.only(left: 14, right: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('🇵🇭'),
              SizedBox(width: 6),
              Text('+63', style: TextStyle(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
        prefixIconConstraints: BoxConstraints(minWidth: 0, minHeight: 0),
      ),
    );
  }
}

String _formatDate(DateTime date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${months[date.month - 1]} ${date.day}, ${date.year}';
}
