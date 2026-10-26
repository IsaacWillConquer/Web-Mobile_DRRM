import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'phone.dart';

class AppUserProfile {
  const AppUserProfile({
    required this.uid,
    this.name = '',
    this.email = '',
    this.phone = '',
    this.role,
    this.teamId,
    this.firstName = '',
    this.middleName = '',
    this.lastName = '',
    this.suffix = '',
    this.birthdate,
    this.disability = const [],
    this.address = const {},
    this.household = const {},
    this.photoUrl = '',
  });

  final String uid;
  final String name;
  final String email;
  final String phone;
  final String? role;
  final String? teamId;
  final String firstName;
  final String middleName;
  final String lastName;
  final String suffix;
  final DateTime? birthdate;
  final List<String> disability;
  final Map<String, dynamic> address;
  final Map<String, dynamic> household;
  final String photoUrl;

  factory AppUserProfile.fromDoc(String uid, Map<String, dynamic> data) {
    final profile = (data['profile'] as Map?)?.cast<String, dynamic>() ?? const {};
    final birth = profile['birthdate'];
    return AppUserProfile(
      uid: uid,
      name: (data['name'] ?? '') as String,
      email: (data['email'] ?? '') as String,
      phone: (data['phone'] ?? '') as String,
      role: data['role'] as String?,
      teamId: data['teamId'] as String?,
      firstName: (data['firstName'] ?? '') as String,
      middleName: (data['middleName'] ?? '') as String,
      lastName: (data['lastName'] ?? '') as String,
      suffix: (data['suffix'] ?? '') as String,
      birthdate: birth is Timestamp ? birth.toDate() : null,
      disability: ((profile['disability'] ?? const []) as List).cast<String>(),
      address: (profile['address'] as Map?)?.cast<String, dynamic>() ?? const {},
      household: (profile['household'] as Map?)?.cast<String, dynamic>() ?? const {},
      photoUrl: (profile['photoUrl'] ?? '') as String,
    );
  }
}

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  FirebaseAuth get _auth => FirebaseAuth.instance;
  FirebaseFirestore get _db => FirebaseFirestore.instance;

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  Future<void> register({
    required String phone,
    required String email,
    required String password,
    required String firstName,
    String? middleName,
    required String lastName,
    String? suffix,
    required DateTime birthdate,
    required List<String> disability,
    required String city,
    required String barangay,
    required String street,
    required String addressLine,
    required String houseFloor,
    required String pets,
  }) async {
    final e164 = normalizePhone(phone);
    if (e164 == null) {
      throw const FormatException('invalid-phone');
    }

    final credential = await _auth.createUserWithEmailAndPassword(
      email: phoneToAuthEmail(e164),
      password: password,
    );
    final user = credential.user!;

    final displayName = [
      firstName.trim(),
      (middleName ?? '').trim(),
      lastName.trim(),
      (suffix ?? '').trim(),
    ].where((part) => part.isNotEmpty).join(' ');
    await user.updateDisplayName(displayName);

    await _db.collection('users').doc(user.uid).set({
      'firstName': firstName.trim(),
      'middleName': (middleName ?? '').trim(),
      'lastName': lastName.trim(),
      'suffix': (suffix ?? '').trim(),
      'name': displayName,
      'phone': e164,
      'email': email.trim(),
      'role': 'resident',
      'active': true,
      'profile': {
        'birthdate': Timestamp.fromDate(birthdate),
        'disability': disability,
        'address': {
          'city': city.trim(),
          'barangay': barangay.trim(),
          'street': street.trim(),
          'line': addressLine.trim(),
        },
        'household': {
          'houseFloor': houseFloor.trim(),
          'pets': pets.trim(),
        },
      },
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> login({required String phone, required String password}) {
    final input = phone.trim();
    // Rescue team / staff sign in with their real email address.
    if (input.contains('@')) {
      return _auth.signInWithEmailAndPassword(email: input, password: password);
    }
    final e164 = normalizePhone(input);
    if (e164 == null) {
      throw const FormatException('invalid-phone');
    }
    return _auth.signInWithEmailAndPassword(
      email: phoneToAuthEmail(e164),
      password: password,
    );
  }

  Future<void> logout() => _auth.signOut();

  /// Live profile (so a teamId assigned later by dispatch shows up without re-login).
  Stream<AppUserProfile?> watchProfile(String uid) {
    return _db.collection('users').doc(uid).snapshots().map((snap) {
      final data = snap.data();
      if (data == null) return null;
      return AppUserProfile.fromDoc(uid, data);
    });
  }

  Future<AppUserProfile?> getProfile(String uid) async {
    final snapshot = await _db.collection('users').doc(uid).get();
    final data = snapshot.data();
    if (data == null) return null;
    return AppUserProfile.fromDoc(uid, data);
  }

  /// Saves the signed-in resident's editable profile fields.
  ///
  /// Only the fields below are written (nested ones by dotted path, so sibling
  /// values are never overwritten). `firstName`, `lastName`, `phone`, `role`,
  /// `active` and `createdAt` are never touched. `name` is rebuilt the same
  /// way [register] builds it, so it stays in step with the name parts.
  Future<void> updateProfile({
    required String middleName,
    required String suffix,
    required String email,
    required DateTime birthdate,
    required List<String> disability,
    required String city,
    required String barangay,
    required String street,
    required String addressLine,
    required String houseFloor,
    required String pets,
    String? photoUrl,
    bool removePhoto = false,
  }) async {
    final user = _auth.currentUser;
    if (user == null) throw StateError('not-signed-in');

    final ref = _db.collection('users').doc(user.uid);
    final existing = (await ref.get()).data() ?? const <String, dynamic>{};
    final firstName = ((existing['firstName'] ?? '') as String).trim();
    final lastName = ((existing['lastName'] ?? '') as String).trim();

    final displayName = [
      firstName,
      middleName.trim(),
      lastName,
      suffix.trim(),
    ].where((part) => part.isNotEmpty).join(' ');

    final update = <String, dynamic>{
      'middleName': middleName.trim(),
      'suffix': suffix.trim(),
      'name': displayName,
      'email': email.trim(),
      'profile.birthdate': Timestamp.fromDate(birthdate),
      'profile.disability': disability,
      'profile.address.city': city.trim(),
      'profile.address.barangay': barangay.trim(),
      'profile.address.street': street.trim(),
      'profile.address.line': addressLine.trim(),
      'profile.household.houseFloor': houseFloor.trim(),
      'profile.household.pets': pets.trim(),
    };
    if (photoUrl != null) {
      update['profile.photoUrl'] = photoUrl;
    } else if (removePhoto) {
      update['profile.photoUrl'] = FieldValue.delete();
    }

    await ref.update(update);

    try {
      await user.updateDisplayName(displayName);
    } catch (_) {
      // The Firestore profile is the source of truth; the Auth display name
      // is only a convenience, so a failure here must not fail the save.
    }
  }
}
