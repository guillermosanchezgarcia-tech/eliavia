import 'dart:async';

import 'package:flutter/material.dart';

import '../models/meditation_session.dart';

/// Sonidos ambientales que se pueden mezclar con la voz de la sesión.
enum BackgroundSound {
  none('Sin sonido', Icons.volume_off_outlined),
  rain('Lluvia', Icons.water_drop_outlined),
  ocean('Olas', Icons.waves_outlined),
  forest('Bosque', Icons.forest_outlined),
  bowls('Cuencos', Icons.circle_outlined);

  const BackgroundSound(this.label, this.icon);

  final String label;
  final IconData icon;

  static BackgroundSound fromName(String? name) {
    return BackgroundSound.values.firstWhere(
      (BackgroundSound sound) => sound.name == name,
      orElse: () => BackgroundSound.none,
    );
  }
}

/// Contrato del reproductor de audio de la app.
///
/// La pantalla del reproductor habla solo con esta interfaz, así que el día
/// que haya audios reales basta con escribir otra implementación y cambiar una
/// línea en `main.dart`; las pantallas no se tocan.
abstract class AudioService {
  /// Prepara una sesión para reproducirla desde el principio.
  Future<void> load(MeditationSession session);

  Future<void> play();
  Future<void> pause();

  /// Mueve la reproducción a un punto concreto.
  Future<void> seek(Duration position);

  /// Cambia el sonido de fondo sin cortar la sesión.
  Future<void> setBackgroundSound(BackgroundSound sound);

  /// Posición actual, emitida cada segundo mientras suena.
  Stream<Duration> get positionStream;

  /// `true` cuando la sesión ha llegado al final.
  Stream<void> get completedStream;

  Duration get position;
  bool get isPlaying;

  Future<void> dispose();
}

/// Implementación provisional: **no suena nada todavía**.
///
/// Lleva la cuenta del tiempo con un temporizador para que el cronómetro, el
/// botón de play/pausa y la barra de progreso funcionen exactamente igual que
/// lo harán con audio real.
///
/// TODO(audio): sustituir por una implementación con el paquete `just_audio`:
///   1. Añadir `just_audio: ^0.9.x` a pubspec.yaml.
///   2. Poner los .mp3 en assets/audio/ y declarar la carpeta en pubspec.yaml.
///   3. Crear `JustAudioService implements AudioService` usando
///      `AudioPlayer().setAsset(session.audioAsset!)` y devolviendo
///      `player.positionStream` en `positionStream`.
///   4. Para el sonido de fondo hace falta un segundo AudioPlayer en bucle.
///   5. Cambiar la línea de `main.dart` donde se crea `MockAudioService()`.
class MockAudioService implements AudioService {
  MockAudioService();

  final StreamController<Duration> _positionController =
      StreamController<Duration>.broadcast();
  final StreamController<void> _completedController =
      StreamController<void>.broadcast();

  Timer? _ticker;
  Duration _position = Duration.zero;
  Duration _total = Duration.zero;
  bool _isPlaying = false;
  BackgroundSound _backgroundSound = BackgroundSound.none;

  @override
  Duration get position => _position;

  @override
  bool get isPlaying => _isPlaying;

  BackgroundSound get backgroundSound => _backgroundSound;

  @override
  Stream<Duration> get positionStream => _positionController.stream;

  @override
  Stream<void> get completedStream => _completedController.stream;

  @override
  Future<void> load(MeditationSession session) async {
    _ticker?.cancel();
    _ticker = null;
    _isPlaying = false;
    _total = session.duration;
    _position = Duration.zero;
    _emit();
  }

  @override
  Future<void> play() async {
    if (_isPlaying) return;
    _isPlaying = true;
    _ticker = Timer.periodic(const Duration(seconds: 1), (Timer _) {
      _position += const Duration(seconds: 1);
      if (_position >= _total) {
        _position = _total;
        _emit();
        _finish();
        return;
      }
      _emit();
    });
  }

  @override
  Future<void> pause() async {
    _isPlaying = false;
    _ticker?.cancel();
    _ticker = null;
  }

  @override
  Future<void> seek(Duration position) async {
    if (position < Duration.zero) {
      _position = Duration.zero;
    } else if (position > _total) {
      _position = _total;
    } else {
      _position = position;
    }
    _emit();
  }

  @override
  Future<void> setBackgroundSound(BackgroundSound sound) async {
    // Sin audio real no hay nada que mezclar; solo recordamos la elección.
    _backgroundSound = sound;
  }

  void _finish() {
    _ticker?.cancel();
    _ticker = null;
    _isPlaying = false;
    if (!_completedController.isClosed) {
      _completedController.add(null);
    }
  }

  void _emit() {
    if (!_positionController.isClosed) {
      _positionController.add(_position);
    }
  }

  @override
  Future<void> dispose() async {
    _ticker?.cancel();
    _ticker = null;
    await _positionController.close();
    await _completedController.close();
  }
}
