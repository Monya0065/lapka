class VpnNode {
  final String id;
  final String name;
  final String country;
  final String city;
  final String ipAddress;
  final int port;
  final String status;
  final int users;
  final double latency;
  final int bandwidth;

  VpnNode({
    required this.id,
    required this.name,
    required this.country,
    required this.city,
    required this.ipAddress,
    required this.port,
    required this.status,
    required this.users,
    required this.latency,
    required this.bandwidth,
  });

  factory VpnNode.fromJson(Map<String, dynamic> json) {
    return VpnNode(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      country: json['country'] ?? '',
      city: json['city'] ?? '',
      ipAddress: json['ip_address'] ?? '',
      port: json['port'] ?? 51820,
      status: json['status'] ?? 'offline',
      users: json['users'] ?? 0,
      latency: (json['latency'] ?? 0).toDouble(),
      bandwidth: json['bandwidth'] ?? 0,
    );
  }

  bool get isOnline => status == 'online';
  bool get isLoaded => users > 80;
}