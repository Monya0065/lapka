import '../services/api_service.dart';
import '../models/subscription.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  Subscription? _subscription;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSubscription();
  }

  Future<void> _loadSubscription() async {
    try {
      final sub = await ApiService.getSubscription();
      if (mounted) setState(() => _subscription = sub);
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
      appBar: AppBar(title: const Text('Subscription')),
      body: _isLoading
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _buildCurrentPlan(),
              const SizedBox(height: 24),
              _buildPlans(),
            ],
          ),
    );
  }

  Widget _buildCurrentPlan() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF22C55E), Color(0xFF16A34A)],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Current Plan',
            style: TextStyle(fontSize: 14, color: Colors.white70),
          ),
          const SizedBox(height: 8),
          Text(
            _subscription?.plan.toUpperCase() ?? 'FREE',
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 16),
          if (_subscription != null && _subscription!.isActive)
            Row(
              children: [
                const Icon(Icons.timer, color: Colors.white70, size: 16),
                const SizedBox(width: 8),
                Text(
                  '${_subscription!.daysRemaining} days remaining',
                  style: const TextStyle(color: Colors.white70),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildPlans() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Available Plans',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        _buildPlanCard('Trial', 'Free forever', '0', '7 days'),
        _buildPlanCard('Monthly', '\$4.99/month', '4.99', '30 days'),
        _buildPlanCard('Yearly', '\$39.99/year', '39.99', '365 days'),
      ],
    );
  }

  Widget _buildPlanCard(String name, String description, String price, String period) {
    final isCurrent = _subscription?.plan.toLowerCase() == name.toLowerCase();
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        title: Text(name),
        subtitle: Text(description),
        trailing: isCurrent
          ? const Chip(label: Text('Current'), backgroundColor: Color(0xFF22C55E))
          : Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('\$$price'),
                Text(period, style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ],
            ),
        onTap: isCurrent ? null : () => _upgradePlan(name.toLowerCase()),
      ),
    );
  }

  Future<void> _upgradePlan(String plan) async {
    try {
      final paymentUrl = await ApiService.createPayment(plan, 'card');
      if (paymentUrl.isNotEmpty) {
        await launchUrl(Uri.parse(paymentUrl));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }
}