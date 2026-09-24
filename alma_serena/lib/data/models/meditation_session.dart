import 'package:flutter/foundation.dart';

/// Una sesión concreta de meditación dentro de una categoría.
@immutable
class MeditationSession {
  const MeditationSession({
    required this.id,
    required this.categoryId,
    required this.title,
    required this.description,
    required this.duration,
    required this.narrator,
    this.isPremium = false,
    this.audioAsset,
  });

  final String id;
  final String categoryId;
  final String title;
  final String description;
  final Duration duration;

  /// Nombre de la voz que guía la sesión.
  final String narrator;

  /// Si es true hace falta suscripción para escucharla.
  final bool isPremium;

  /// Ruta del audio.
  ///
  /// Hoy es `null` en todas las sesiónes: todavía no hay audios reales, así
  /// que el reproductor solo simula la reproducción.
  /// TODO(audio): rellenar con `assets/audio/xxx.mp3` (o una URL del backend)
  /// y declarar la carpeta en pubspec.yaml.
  final String? audioAsset;

  /// Duración en minutos redondeada, para mostrarla en las tarjetas.
  int get minutes => duration.inMinutes;
}
