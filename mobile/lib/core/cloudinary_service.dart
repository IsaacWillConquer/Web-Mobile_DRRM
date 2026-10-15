import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';

class CloudinaryService {
  CloudinaryService._();
  static final CloudinaryService instance = CloudinaryService._();

  Future<String> uploadImage(String filePath) async {
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
