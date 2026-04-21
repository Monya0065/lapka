class Subscription {
  final String id;
  final String plan;
  final String status;
  final DateTime? startDate;
  final DateTime? endDate;
  final double? amount;

  Subscription({
    required this.id,
    required this.plan,
    required this.status,
    this.startDate,
    this.endDate,
    this.amount,
  });

  factory Subscription.fromJson(Map<String, dynamic> json) {
    return Subscription(
      id: json['id'] ?? '',
      plan: json['plan'] ?? '',
      status: json['status'] ?? 'inactive',
      startDate: json['start_date'] != null 
        ? DateTime.parse(json['start_date']) 
        : null,
      endDate: json['end_date'] != null 
        ? DateTime.parse(json['end_date']) 
        : null,
      amount: json['amount']?.toDouble(),
    );
  }

  bool get isActive => status == 'active' && endDate != null && endDate!.isAfter(DateTime.now());
  
  int get daysRemaining {
    if (endDate == null) return 0;
    return endDate!.difference(DateTime.now()).inDays;
  }
}