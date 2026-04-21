import 'login_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildMenuItem(context, 'Subscription', '/subscription', Icons.card_membership),
          _buildMenuItem(context, 'Devices', '/devices', Icons.devices),
          _buildMenuItem(context, 'Profile', '/profile', Icons.person),
          _buildMenuItem(context, 'Settings', '/settings', Icons.settings),
        ],
      ),
    );
  }

  Widget _buildMenuItem(BuildContext context, String title, String route, IconData icon) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFF6366F1)),
        title: Text(title),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          Navigator.of(context).pushNamed(route);
        },
      ),
    );
  }
}