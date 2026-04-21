import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const LapkaVPNApp());
}

// Константы API
const API_URL = 'http://10.0.2.2:8001'; // Android эмулятор
// const API_URL = 'http://localhost:8001'; // iOS симулятор

class LapkaVPNApp extends StatelessWidget {
  const LapkaVPNApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lapka VPN',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFF00D4AA),
          secondary: const Color(0xFF00D4AA),
        ),
      ),
      home: const AuthScreen(),
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _storage = const FlutterSecureStorage();
  bool _loading = false;
  String? _error;
  bool _showRegister = false;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final token = await _storage.read(key: 'access_token');
    if (token != null) {
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const DashboardScreen()),
        );
      }
    }
  }

  Future<void> _login() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await http.post(
        Uri.parse('$API_URL/api/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': _emailController.text,
          'password': _passwordController.text,
        }),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        await _storage.write(key: 'access_token', value: data['access_token']);
        
        final meRes = await http.get(
          Uri.parse('$API_URL/api/auth/me'),
          headers: {'Authorization': 'Bearer ${data["access_token"]}'},
        );
        
        if (meRes.statusCode == 200) {
          final meData = jsonDecode(meRes.body);
          await _storage.write(key: 'user_role', value: meData['role'] ?? 'user');
        }

        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => const DashboardScreen()),
          );
        }
      } else {
        final data = jsonDecode(res.body);
        setState(() {
          _error = data['detail'] ?? 'Ошибка входа';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Не удалось подключиться к серверу\nПроверьте подключение к интернету';
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _register() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await http.post(
        Uri.parse('$API_URL/api/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': _emailController.text,
          'password': _passwordController.text,
        }),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        await _storage.write(key: 'access_token', value: data['access_token']);
        
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => const DashboardScreen()),
          );
        }
      } else {
        final data = jsonDecode(res.body);
        setState(() {
          _error = data['detail'] ?? 'Ошибка регистрации';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Не удалось подключиться к серверу';
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              Icon(Icons.vpn_lock, size: 64, color: const Color(0xFF00D4AA)),
              const SizedBox(height: 16),
              const Text(
                'Lapka VPN',
                style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                _showRegister ? 'Создайте аккаунт' : 'С возвращением',
                style: TextStyle(color: Colors.grey[400]),
              ),
              const SizedBox(height: 48),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  prefixIcon: Icon(Icons.email_outlined),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Пароль',
                  prefixIcon: Icon(Icons.lock_outline),
                  border: OutlineInputBorder(),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Colors.red, fontSize: 14),
                    textAlign: Center,
                  ),
                ),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : (_showRegister ? _register : _login),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00D4AA),
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.all(16),
                  ),
                  child: _loading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          _showRegister ? 'Создать аккаунт' : 'Войти',
                          style: const TextStyle(fontSize: 16),
                        ),
                ),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => setState(() => _showRegister = !_showRegister),
                child: Text(
                  _showRegister
                      ? 'Уже есть аккаунт? Войти'
                      : 'Нет аккаунта? Создать',
                ),
              ),
              const Spacer(flex: 2),
            ],
          ),
        ),
      ),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _subscription;
  List<dynamic>? _devices;
  bool _loading = true;
  final _storage = const FlutterSecureStorage();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final token = await _storage.read(key: 'access_token');
    if (token == null) {
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const AuthScreen()),
        );
      }
      return;
    }

    try {
      final subRes = await http.get(
        Uri.parse('$API_URL/api/billing/subscription'),
        headers: {'Authorization': 'Bearer $token'},
      );

      final devRes = await http.get(
        Uri.parse('$API_URL/api/devices'),
        headers: {'Authorization': 'Bearer $token'},
      );

      setState(() {
        _subscription = subRes.statusCode == 200 ? jsonDecode(subRes.body) : null;
        _devices = devRes.statusCode == 200 ? jsonDecode(devRes.body) : [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _logout() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'user_role');
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const AuthScreen()),
      );
    }
  }

  String _getStatusText(String? status) {
    switch (status) {
      case 'active':
        return 'Активна';
      case 'trial':
        return 'Пробный период';
      case 'past_due':
        return 'Нужно продлить';
      case 'canceled':
        return 'Отменена';
      default:
        return 'Нет подписки';
    }
  }

  Color _getStatusColor(String? status) {
    switch (status) {
      case 'active':
        return Colors.green;
      case 'trial':
        return Colors.orange;
      case 'past_due':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final status = _subscription?['status'] ?? 'none';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lapka VPN'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: _getStatusColor(status),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _getStatusText(status),
                            style: TextStyle(
                              color: _getStatusColor(status),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Тариф',
                        style: TextStyle(color: Colors.grey),
                      ),
                      Text(
                        _subscription?['plan_id']?.toString().toUpperCase() ?? 'НЕТ',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (_subscription?['renew_at'] != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          'До: ${_subscription!['renew_at'].toString().substring(0, 10)}',
                          style: const TextStyle(color: Colors.grey),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Мои устройства',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              if (_devices == null || _devices!.isEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Center(
                      child: Column(
                        children: [
                          const Icon(Icons.devices, size: 48, color: Colors.grey),
                          const SizedBox(height: 12),
                          const Text(
                            'Нет устройств',
                            style: TextStyle(color: Colors.grey),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const AddDeviceScreen()),
                              );
                            },
                            icon: const Icon(Icons.add),
                            label: const Text('Добавить'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF00D4AA),
                              foregroundColor: Colors.black,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                ..._devices!.map((device) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Icon(
                      _getPlatformIcon(device['platform']),
                      color: const Color(0xFF00D4AA),
                    ),
                    title: Text(device['name'] ?? 'Устройство'),
                    subtitle: Text(device['platform'] ?? ''),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline, color: Colors.red),
                      onPressed: () async {
                        final token = await _storage.read(key: 'access_token');
                        await http.delete(
                          Uri.parse('$API_URL/api/devices/${device['id']}'),
                          headers: {'Authorization': 'Bearer $token'},
                        );
                        _loadData();
                      },
                    ),
                  ),
                )),
              if (_devices != null && _devices!.isNotEmpty) ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const AddDeviceScreen()),
                      );
                    },
                    icon: const Icon(Icons.add),
                    label: const Text('Добавить устройство'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00D4AA),
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.all(16),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              if (status != 'active')
                Card(
                  color: const Color(0xFF00D4AA).withOpacity(0.1),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        const Text(
                          'Нужна подписка!',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Получите доступ ко всем серверам',
                          style: TextStyle(color: Colors.grey[400]),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF00D4AA),
                              foregroundColor: Colors.black,
                            ),
                            child: const Text('Купить подписку'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getPlatformIcon(String? platform) {
    switch (platform?.toLowerCase()) {
      case 'ios':
        return Icons.phone_iphone;
      case 'android':
        return Icons.phone_android;
      case 'windows':
        return Icons.desktop_windows;
      case 'macos':
        return Icons.laptop_mac;
      default:
        return Icons.devices;
    }
  }
}

class AddDeviceScreen extends StatefulWidget {
  const AddDeviceScreen({super.key});

  @override
  State<AddDeviceScreen> createState() => _AddDeviceScreenState();
}

class _AddDeviceScreenState extends State<AddDeviceScreen> {
  final _nameController = TextEditingController();
  String _platform = 'ios';
  bool _loading = false;

  Future<void> _addDevice() async {
    if (_nameController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Введите название')),
      );
      return;
    }

    setState(() => _loading = true);

    final token = await const FlutterSecureStorage().read(key: 'access_token');

    try {
      final res = await http.post(
        Uri.parse('$API_URL/api/devices'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'name': _nameController.text,
          'platform': _platform,
        }),
      );

      if (res.statusCode == 200) {
        if (mounted) {
          Navigator.pop(context);
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ошибка добавления')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ошибка подключения')),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Добавить устройство'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Название',
                hintText: 'Например: iPhone 15',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _platform,
              decoration: const InputDecoration(
                labelText: 'Платформа',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'ios', child: Text('iOS')),
                DropdownMenuItem(value: 'android', child: Text('Android')),
                DropdownMenuItem(value: 'windows', child: Text('Windows')),
                DropdownMenuItem(value: 'macos', child: Text('macOS')),
                DropdownMenuItem(value: 'linux', child: Text('Linux')),
              ],
              onChanged: (v) => setState(() => _platform = v!),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _addDevice,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00D4AA),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.all(16),
                ),
                child: _loading
                    ? const CircularProgressIndicator()
                    : const Text('Добавить', style: TextStyle(fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}