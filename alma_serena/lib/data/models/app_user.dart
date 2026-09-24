import 'dart:convert';

import 'package:flutter/foundation.dart';

/// Usuario de la app.
///
/// TODO(backend): sustituir por el `User` de Firebase Auth. `id` pasará a ser
/// el `uid` y el resto de campos vivirán en el documento `users/{uid}` de
/// Firestore.
@immutable
class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.name,
  });

  final String id;
  final String email;
  final String name;

  /// Iniciales para el avatar del perfil ("Ana López" -> "AL").
  String get initials {
    final List<String> parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) {
      return email.isNotEmpty ? email[0].toUpperCase() : '?';
    }
    if (parts.length == 1) {
      return parts.first[0].toUpperCase();
    }
    return (parts.first[0] + parts[1][0]).toUpperCase();
  }

  AppUser copyWith({String? name}) {
    return AppUser(id: id, email: email, name: name ?? this.name);
  }

  Map<String, dynamic> toMap() => <String, dynamic>{
    'id': id,
    'email': email,
    'name': name,
  };

  factory AppUser.fromMap(Map<String, dynamic> map) => AppUser(
    id: map['id'] as String,
    email: map['email'] as String,
    name: map['name'] as String? ?? '',
  );

  String toJson() => jsonEncode(toMap());

  factory AppUser.fromJson(String source) =>
      AppUser.fromMap(jsonDecode(source) as Map<String, dynamic>);
}
