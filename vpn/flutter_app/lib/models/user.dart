class User {
  final String id;
  final String email;
  final String name;
  final String? telegramId;
  final String role;
  final DateTime createdAt;

  User({
    required this.id,
    required this.email,
    required this.name,
    this.telegramId,
    required this.role,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      name: json['name'] ?? '',
      telegramId: json['telegram_id'],
      role: json['role'] ?? 'user',
      createdAt: DateTime.parse(json['created_at'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'name': name,
    'telegram_id': telegramId,
    'role': role,
    'created_at': createdAt.toIso8601String(),
  };
}