import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are only set up for Android. '
          'Run `flutterfire configure` to add your platforms.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBfpcl07v53SEZYUGuUX7e64JOegE56mhw',
    appId: '1:1010321970173:android:1a9a3627737d085c2abf94',
    messagingSenderId: '1010321970173',
    projectId: 'drrm-app',
    storageBucket: 'drrm-app.firebasestorage.app',
  );
}
