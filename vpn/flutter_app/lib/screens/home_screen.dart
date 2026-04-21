import 'package:flutter/material.dart';
import 'login_screen.dart';
import 'dashboard_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isConnected = false;
  String _selectedCountry = '🇳🇱 Netherlands';
  String _selectedNode = 'Amsterdam';
  double _downloadSpeed = 0;
  double _uploadSpeed = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: _isConnected
              ? [const Color(0xFF22C55E), const Color(0xFF16A34A)]
              : [const Color(0xFF6366F1), const Color(0xFF8B5CF6)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Lapka VPN',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    IconButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const DashboardScreen()),
                        );
                      },
                      icon: const Icon(Icons.menu, color: Colors.white),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              _buildConnectionButton(),
              const Spacer(),
              if (_isConnected) _buildSpeedIndicator(),
              const SizedBox(height: 32),
              _buildServerInfo(),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildConnectionButton() {
    return GestureDetector(
      onTap: () {
        setState(() => _isConnected = !_isConnected);
        if (_isConnected) {
          _downloadSpeed = 95.4;
          _uploadSpeed = 52.8;
        } else {
          _downloadSpeed = 0;
          _uploadSpeed = 0;
        }
      },
      child: Container(
        width: 200,
        height: 200,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withOpacity(_isConnected ? 0.2 : 0.1),
          border: Border.all(
            color: Colors.white,
            width: 4,
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                _isConnected ? Icons.power_settings_new : Icons.power_off,
                size: 64,
                color: Colors.white,
              ),
              const SizedBox(height: 8),
              Text(
                _isConnected ? 'Connected' : 'Tap to Connect',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSpeedIndicator() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _buildSpeedCard('Download', _downloadSpeed, Icons.arrow_downward),
        _buildSpeedCard('Upload', _uploadSpeed, Icons.arrow_upward),
      ],
    );
  }

  Widget _buildSpeedCard(String label, double speed, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.white, size: 20),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.white70,
                ),
              ),
              Text(
                '${speed.toStringAsFixed(1)} Mbps',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildServerInfo() {
    return GestureDetector(
      onTap: () {
        _showServerList();
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 32),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.2),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Text('🇳🇱', style: TextStyle(fontSize: 24)),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Server',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.white70,
                    ),
                  ),
                  Text(
                    _selectedCountry,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white),
          ],
        ),
      ),
    );
  }

  void _showServerList() {
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Select Server',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              _buildServerListItem('🇳🇱 Netherlands', 'Amsterdam', 25),
              _buildServerListItem('🇺🇸 United States', 'New York', 45),
              _buildServerListItem('🇸🇬 Singapore', 'Singapore', 120),
              _buildServerListItem('🇩🇪 Germany', 'Frankfurt', 35),
              _buildServerListItem('🇬🇧 United Kingdom', 'London', 30),
            ],
          ),
        );
      },
    );
  }

  Widget _buildServerListItem(String country, String city, int latency) {
    return ListTile(
      leading: Text(country.split(' ')[0], style: const TextStyle(fontSize: 24)),
      title: Text(country.split(' ').sublist(1).join(' ')),
      subtitle: Text('$city • ${latency}ms'),
      onTap: () {
        setState(() {
          _selectedCountry = country;
          _selectedNode = city;
        });
        Navigator.pop(context);
      },
    );
  }
}