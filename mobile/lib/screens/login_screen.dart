import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../config/app_config.dart';
import '../core/auth_service.dart';
import '../core/phone.dart';
import 'register_screen.dart';
import 'terms_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;
  bool _emailLogin = false;

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final input = _phone.text.trim();
    if (_emailLogin) {
      if (!input.contains('@') || input.length < 5) {
        setState(() => _error = 'Enter a valid responder email address.');
        return;
      }
    } else {
      if (normalizePhone(input) == null) {
        setState(() => _error = 'Enter a valid 10-digit mobile number (9XXXXXXXXX).');
        return;
      }
    }
    if (_password.text.isEmpty) {
      setState(() => _error = 'Enter your password.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AuthService.instance.login(
        phone: input,
        password: _password.text,
      );
    } catch (err) {
      setState(() => _error = _friendly(err));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _friendly(Object err) {
    final message = err.toString();
    if (message.contains('invalid-credential') ||
        message.contains('wrong-password') ||
        message.contains('user-not-found')) {
      return 'Incorrect mobile number or password.';
    }
    if (message.contains('too-many-requests')) {
      return 'Too many attempts. Please try again later.';
    }
    if (message.contains('invalid-api-key') || message.contains('configuration')) {
      return 'Firebase is not configured yet. See docs/SETUP.md.';
    }
    return 'Unable to sign in. Check your connection.';
  }

  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;

    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight - 48),
                child: IntrinsicHeight(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 32),
                      const _Brand(),
                      const SizedBox(height: 32),
                      _formCard(accent),
                      const Spacer(),
                      FilledButton(
                        onPressed: _busy ? null : _submit,
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
                            : const Text('Sign in'),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: _busy
                            ? null
                            : () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => const RegisterScreen(),
                                  ),
                                ),
                        child: const Text('No account? Create one'),
                      ),
                      TextButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const TermsScreen(),
                          ),
                        ),
                        child: const Text(
                          'Terms of Use & Privacy',
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${AppConfig.developerCredit} · ${AppConfig.creditsLine}',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.black38,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _formCard(Color accent) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.10),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Welcome back',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            _emailLogin ? 'Sign in with responder or staff email.' : 'Sign in with your mobile number.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.black54,
                ),
          ),
          const SizedBox(height: 20),
          if (_emailLogin)
            TextField(
              controller: _phone,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(
                labelText: 'Responder / Staff email',
                hintText: 'e.g. malolos.rescue@drrm.test',
                prefixIcon: Icon(Icons.email_outlined),
              ),
            )
          else
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumber],
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(kPhoneDigits),
              ],
              decoration: InputDecoration(
                labelText: 'Mobile number',
                hintText: '9171234567',
                prefixIcon: const Padding(
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
                prefixIconConstraints:
                    const BoxConstraints(minWidth: 0, minHeight: 0),
              ),
            ),
          const SizedBox(height: 16),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password'),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => setState(() {
                _emailLogin = !_emailLogin;
                _error = null;
              }),
              child: Text(
                _emailLogin
                    ? 'Resident? Sign in with mobile number'
                    : 'Rescue Team? Sign in with email',
                style: const TextStyle(fontSize: 12),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
        ],
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  const _Brand();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset(
          AppConfig.logoAsset,
          height: 96,
          fit: BoxFit.contain,
          semanticLabel: AppConfig.appName,
        ),
        const SizedBox(height: 12),
        Text(
          AppConfig.appTagline,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.black54,
              ),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text(
            AppConfig.appDescription,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.black45,
                  height: 1.4,
                ),
          ),
        ),
      ],
    );
  }
}
