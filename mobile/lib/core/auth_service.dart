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
    this.firstName = '',
    this.middleName = '',
    this.lastName = '',
    this.suffix = '',
    this.birthdate,
    this.disability = const [],
    this.address = const {},
    this.household = const {},
  });

  final String uid;
  final String name;
  final String email;
  final String phone;
  final String? role;
  final String firstName;
  final String middleName;
  final String lastName;
  final String suffix;
  final DateTime? birthdate;
  final List<String> disability;
  final Map<String, dynamic> address;
  final Map<String, dynamic> household;

  factory AppUserProfile.fromDoc(String uid, Map<String, dynamic> data) {
    final profile = (data['profile'] as Map?)?.cast<String, dynamic>() ?? const {};
    final birth = profile['birthdate'];
    return AppUserProfile(
      uid: uid,
      name: (data['name'] ?? '') as String,
      email: (data['email'] ?? '') as String,
      phone: (data['phone'] ?? '') as String,
      role: data['role'] as String?,
      firstName: (data['firstName'] ?? '') as String,
      middleName: (data['middleName'] ?? '') as String,
      lastName: (data['lastName'] ?? '') as String,
      suffix: (data['suffix'] ?? '') as String,
      birthdate: birth is Timestamp ? birth.toDate() : null,
      disability: ((profile['disability'] ?? const []) as List).cast<String>(),
      address: (profile['address'] as Map?)?.cast<String, dynamic>() ?? const {},
      household: (profile['household'] as Map?)?.cast<String, dynamic>() ?? const {},
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
    final e164 = normalizePhone(phone);
    if (e164 == null) {
      throw const FormatException('invalid-phone');
    }
    return _auth.signInWithEmailAndPassword(
      email: phoneToAuthEmail(e164),
      password: password,
    );
  }

  Future<void> logout() => _auth.signOut();

  Future<AppUserProfile?> getProfile(String uid) async {
    final snapshot = await _db.collection('users').doc(uid).get();
    final data = snapshot.data();
    if (data == null) return null;
    return AppUserProfile.fromDoc(uid, data);
  }
}
