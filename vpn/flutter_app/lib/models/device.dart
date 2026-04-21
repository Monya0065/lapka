class Device {
  final String id;
  final String name;
  final String publicKey;
  final String? privateKey;
  final String status;
  final DateTime createdAt;
  final DateTime? lastConnected;

  Device({
    required this.id,
    required this.name,
    required this.publicKey,
    this.privateKey,
    required this.status,
    required this.createdAt,
    this.lastConnected,
  });

  factory Device.fromJson(Map<String, dynamic> json) {
    return Device(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      publicKey: json['public_key'] ?? '',
      privateKey: json['private_key'],
      status: json['status'] ?? 'inactive',
      createdAt: DateTime.parse(json['created_at'] ?? DateTime.now().toIso8601String()),
      lastConnected: json['last_connected'] != null 
        ? DateTime.parse(json['last_connected']) 
        : null,
    );
  }

  bool get isActive => status == 'active';
}