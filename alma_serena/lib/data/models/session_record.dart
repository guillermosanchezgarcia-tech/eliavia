import 'package:flutter/foundation.dart';

/// Una sesión ya escuchada. Alimenta el historial y la racha del perfil.
@immutable
class SessionRecord {
  const SessionRecord({
    required this.sessionId,
    required this.title,
    required this.categoryName,
    required this.completedAt,
    required this.listened,
  });

  final String sessionId;
  final String title;
  final String categoryName;
  final DateTime completedAt;

  /// Tiempo realmente escuchado (puede ser menor que la duración total).
  final Duration listened;

  Map<String, dynamic> toMap() => <String, dynamic>{
    'sessionId': sessionId,
    'title': title,
    'categoryName': categoryName,
    'completedAt': completedAt.toIso8601String(),
    'listenedSeconds': listened.inSeconds,
  };

  factory SessionRecord.fromMap(Map<String, dynamic> map) => SessionRecord(
    sessionId: map['sessionId'] as String,
    title: map['title'] as String,
    categoryName: map['categoryName'] as String? ?? '',
    completedAt: DateTime.parse(map['completedAt'] as String),
    listened: Duration(seconds: map['listenedSeconds'] as int? ?? 0),
  );
}
