import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';

class CloudinaryService {
  CloudinaryService._();
  static final CloudinaryService instance = CloudinaryService._();

  /// Upload validation (requirements §8: type + size checks before upload).
  static const List<String> allowedExtensions = [
    'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif',
  ];
  static const int maxImageBytes = 10 * 1024 * 1024; // 10 MB

  /// Returns an error message when [filePath] is not a supported image, or
  /// `null` when the file is safe to upload.
  static Future<String?> validateImage(String filePath) async {
    final name = filePath.split(Platform.pathSeparator).last;
    final dot = name.lastIndexOf('.');
    final ext = dot < 0 ? '' : name.substring(dot + 1).toLowerCase();
    if (!allowedExtensions.contains(ext)) {
      return '"$name": unsupported type — use JPG, PNG, WEBP or HEIC.';
    }
    final file = File(filePath);
    if (!await file.exists()) return '"$name": file not found.';
    final length = await file.length();
    if (length > maxImageBytes) {
      final mb = (length / (1024 * 1024)).toStringAsFixed(1);
      return '"$name": $mb MB is over the ${maxImageBytes ~/ (1024 * 1024)} MB limit.';
    }
    return null;
  }

  Future<String> uploadImage(String filePath) async {
    final problem = await validateImage(filePath);
    if (problem != null) {
      throw Exception(problem);
    }
    final uri = Uri.parse(
      'https://api.cloudinary.com/v1_1/${AppConfig.cloudinaryCloudName}/image/upload',
    );
    final request = http.MultipartRequest('POST', uri)
      ..fields['upload_preset'] = AppConfig.cloudinaryUploadPreset
      ..files.add(await http.MultipartFile.fromPath('file', filePath));

    final response = await request.send();
    final body = await response.stream.bytesToString();
    if (response.statusCode != 200) {
      throw Exception('Photo upload failed (${response.statusCode}).');
    }
    final json = jsonDecode(body) as Map<String, dynamic>;
    final url = json['secure_url'] as String?;
    if (url == null) {
      throw Exception('Photo upload returned no URL.');
    }
    return url;
  }
}
