import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class AppUserProfile {
  const AppUserProfile({
    required this.uid,
    this.name = '',
    this.email = '',
    this.phone = '',
    this.role,
  });

  final String uid;
  final String name;
  final String email;
  final String phone;
  final String? role;

  factory AppUserProfile.fromDoc(String uid, Map<String, dynamic> data) {
    return AppUserProfile(
      uid: uid,
      name: (data['name'] ?? '') as String,
      email: (data['email'] ?? '') as String,
      phone: (data['phone'] ?? '') as String,
      role: data['role'] as String?,
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
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    final credential = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    final user = credential.user!;
    await user.updateDisplayName(name);
    await _db.collection('users').doc(user.uid).set({
      'name': name.trim(),
      'email': email.trim(),
      'phone': phone.trim(),
      'role': 'resident',
      'active': true,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> login({required String email, required String password}) {
    return _auth.signInWithEmailAndPassword(email: email.trim(), password: password);
  }

  Future<void> logout() => _auth.signOut();

  Future<AppUserProfile?> getProfile(String uid) async {
    final snapshot = await _db.collection('users').doc(uid).get();
    final data = snapshot.data();
    if (data == null) return null;
    return AppUserProfile.fromDoc(uid, data);
  }
}
