import '../services/api_service.dart';
import 'package:flutter/material.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _autoConnect = true;
  bool _killSwitch = false;
  String _protocol = 'UDP';
  String _selectedRegion = 'Best Location';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          _buildSection('Connection', [
            _buildSwitch('Auto Connect', 'Connect on startup', _autoConnect, (v) {
              setState(() => _autoConnect = v);
            }),
            _buildSwitch('Kill Switch', 'Block internet if VPN disconnects', _killSwitch, (v) {
              setState(() => _killSwitch = v);
            }),
            _buildSelector('Protocol', _protocol, ['UDP', 'TCP']),
            _buildSelector('Region', _selectedRegion, [
              'Best Location',
              'Netherlands',
              'United States',
              'Singapore',
              'Germany',
              'United Kingdom',
            ]),
          ]),
          _buildSection('Account', [
            _buildItem('Change Password', () {}),
            _buildItem('Enable 2FA', () {}),
            _buildItem('Delete Account', () {}, destructive: true),
          ]),
          _buildSection('About', [
            _buildItem('Privacy Policy', () {}),
            _buildItem('Terms of Service', () {}),
            _buildItem('Version', trailing: const Text('1.0.0')),
          ]),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton(
              onPressed: () async {
                await ApiService.logout();
                if (mounted) {
                  Navigator.of(context).pushNamedAndRemoveUntil(
                    '/login',
                    (route) => false,
                  );
                }
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red,
                side: const BorderSide(color: Colors.red),
              ),
              child: const Text('Sign Out'),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Color(0xFF6366F1),
            ),
          ),
        ),
        ...children,
      ],
    );
  }

  Widget _buildSwitch(String title, String subtitle, bool value, Function(bool) onChanged) {
    return SwitchListTile(
      title: Text(title),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
      value: value,
      onChanged: onChanged,
    );
  }

  Widget _buildSelector(String title, String value, List<String> options) {
    return ListTile(
      title: Text(title),
      trailing: DropdownButton<String>(
        value: value,
        items: options.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
        onChanged: (v) {
          setState(() {
            if (title == 'Protocol') _protocol = v!;
            if (title == 'Region') _selectedRegion = v!;
          });
        },
      ),
    );
  }

  Widget _buildItem(String title, VoidCallback onTap, {bool destructive = false, Widget? trailing}) {
    return ListTile(
      title: Text(title, style: TextStyle(color: destructive ? Colors.red : null)),
      trailing: trailing ?? const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}