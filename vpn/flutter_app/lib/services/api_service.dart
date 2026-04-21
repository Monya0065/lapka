import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import '../models/subscription.dart';
import '../models/device.dart';
import '../models/vpn_node.dart';

class ApiService {
  static const String baseUrl = 'https://api.lapka.ru';
  
  static String? _token;
  
  static void setToken(String? token) {
    _token = token;
  }
  
  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };
  
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data['access_token'] != null) {
        _token = data['access_token'];
      }
      return data;
    }
    throw Exception(_parseError(response));
  }
  
  static Future<Map<String, dynamic>> register(
    String email,
    String password,
    String name,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
        'name': name,
      }),
    );
    
    if (response.statusCode == 201) {
      final data = jsonDecode(response.body);
      if (data['access_token'] != null) {
        _token = data['access_token'];
      }
      return data;
    }
    throw Exception(_parseError(response));
  }
  
  static Future<User> getProfile() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/auth/me'),
      headers: _headers,
    );
    
    if (response.statusCode == 200) {
      return User.fromJson(jsonDecode(response.body));
    }
    throw Exception(_parseError(response));
  }
  
  static Future<Subscription> getSubscription() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/billing/subscription'),
      headers: _headers,
    );
    
    if (response.statusCode == 200) {
      return Subscription.fromJson(jsonDecode(response.body));
    }
    throw Exception(_parseError(response));
  }
  
  static Future<List<Device>> getDevices() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/devices'),
      headers: _headers,
    );
    
    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      return data.map((d) => Device.fromJson(d)).toList();
    }
    throw Exception(_parseError(response));
  }
  
  static Future<Device> createDevice(String name) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/devices'),
      headers: _headers,
      body: jsonEncode({'name': name}),
    );
    
    if (response.statusCode == 201) {
      return Device.fromJson(jsonDecode(response.body));
    }
    throw Exception(_parseError(response));
  }
  
  static Future<void> deleteDevice(String id) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/devices/$id'),
      headers: _headers,
    );
    
    if (response.statusCode != 204) {
      throw Exception(_parseError(response));
    }
  }
  
  static Future<List<VpnNode>> getVpnNodes() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/vpn/nodes'),
      headers: _headers,
    );
    
    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body);
      return data.map((n) => VpnNode.fromJson(n)).toList();
    }
    throw Exception(_parseError(response));
  }
  
  static Future<Map<String, dynamic>> getVpnConfig(String deviceId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/vpn/config/$deviceId'),
      headers: _headers,
    );
    
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception(_parseError(response));
  }
  
  static Future<String> createPayment(String plan, String paymentMethod) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/billing/payment'),
      headers: _headers,
      body: jsonEncode({
        'plan': plan,
        'payment_method': paymentMethod,
      }),
    );
    
    if (response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return data['payment_url'] ?? '';
    }
    throw Exception(_parseError(response));
  }
  
  static Future<Map<String, dynamic>> getPaymentStatus(String paymentId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/billing/payment/$paymentId'),
      headers: _headers,
    );
    
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception(_parseError(response));
  }
  
  static Future<void> logout() async {
    _token = null;
  }
  
  static String _parseError(http.Response response) {
    try {
      final data = jsonDecode(response.body);
      return data['detail'] ?? 'Unknown error';
    } catch (_) {
      return 'HTTP ${response.statusCode}';
    }
  }
}