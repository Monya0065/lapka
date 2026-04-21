import '../services/api_service.dart';
import '../models/user.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  User? _user;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final user = await ApiService.getProfile();
      if (mounted) setState(() => _user = user);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: _isLoading
        ? const Center(child: CircularProgressIndicator())
        : _user == null
          ? const Center(child: Text('Failed to load profile'))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildProfileHeader(),
                const SizedBox(height: 24),
                _buildInfoCard('Email', _user!.email, Icons.email),
                _buildInfoCard('Name', _user!.name, Icons.person),
                _buildInfoCard('Role', _user!.role, Icons.badge),
                _buildTelegramSection(),
              ],
            ),
    );
  }

  Widget _buildProfileHeader() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(32),
            ),
            child: const Center(
              child: Icon(Icons.person, size: 32, color: Color(0xFF6366F1)),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _user!.name,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                Text(
                  _user!.email,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.white70,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(String label, String value, IconData icon) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFF6366F1)),
        title: Text(label),
        subtitle: Text(value),
      ),
    );
  }

  Widget _buildTelegramSection() {
    final hasTelegram = _user!.telegramId != null;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: const Icon(Icons.send, color: Color(0xFF2AABEE)),
        title: const Text('Telegram'),
        subtitle: Text(hasTelegram ? 'Connected' : 'Not connected'),
        trailing: hasTelegram
          ? const Icon(Icons.check_circle, color: Colors.green)
          : OutlinedButton(
              onPressed: () {},
              child: const Text('Connect'),
            ),
      ),
    );
  }
}