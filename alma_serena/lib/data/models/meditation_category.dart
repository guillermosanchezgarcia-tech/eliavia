import 'package:flutter/material.dart';

/// Una categoría de meditación (ansiedad, sueño, enfoque, respiración...).
///
/// TODO(backend): cuando exista Firestore, esto vendrá de la colección
/// `categories` y `icon`/`color` se guardarán como texto (nombre del icono y
/// código hexadecimal del color).
@immutable
class MeditationCategory {
  const MeditationCategory({
    required this.id,
    required this.name,
    required this.tagline,
    required this.icon,
    required this.color,
    this.isPremium = false,
  });

  final String id;
  final String name;

  /// Frase corta que acompaña al nombre en la tarjeta.
  final String tagline;

  final IconData icon;
  final Color color;

  /// Si es true, la categoría entera está reservada a suscriptores.
  final bool isPremium;
}
