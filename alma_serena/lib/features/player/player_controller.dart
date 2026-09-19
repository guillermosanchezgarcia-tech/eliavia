import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../data/models/meditation_session.dart';
import '../../data/services/audio_service.dart';

/// Estado del reproductor mientras la pantalla está abierta.
///
/// Habla con `AudioService`, que hoy solo simula la reproducción (no hay
/// audios todavía) pero expone la misma interfaz que tendrá el reproductor
/// real. Ver `lib/data/services/audio_service.dart`.
class PlayerController extends ChangeNotifier {
  PlayerController({
    required this.audio,
    required this.session,
    required BackgroundSound initialBackgroundSound,
  }) : _backgroundSound = initialBackgroundSound {
    _init();
  }

  final AudioService audio;
  final MeditationSession session;

  StreamSubscription<Duration>? _positionSubscription;
  StreamSubscription<void>? _completedSubscription;

  Duration _position = Duration.zero;
  bool _isPlaying = false;
  bool _isCompleted = false;
  BackgroundSound _backgroundSound;

  Duration get position => _position;
  Duration get duration => session.duration;
  Duration get remaining => session.duration - _position;
  bool get isPlaying => _isPlaying;
  bool get isCompleted => _isCompleted;
  BackgroundSound get backgroundSound => _backgroundSound;

  /// Entre 0 y 1: lo que lleva reproducido. Lo usa el anillo de progreso.
  double get progress {
    if (duration.inMilliseconds == 0) return 0;
    return (_position.inMilliseconds / duration.inMilliseconds).clamp(0.0, 1.0);
  }

  Future<void> _init() async {
    await audio.load(session);
    await audio.setBackgroundSound(_backgroundSound);

    _positionSubscription = audio.positionStream.listen((Duration position) {
      _position = position;
      notifyListeners();
    });
    _completedSubscription = audio.completedStream.listen((_) {
      _isPlaying = false;
      _isCompleted = true;
      notifyListeners();
    });

    // Empezamos a sonar en cuanto se abre la pantalla.
    await play();
  }

  Future<void> play() async {
    if (_isCompleted) {
      await seek(Duration.zero);
      _isCompleted = false;
    }
    await audio.play();
    _isPlaying = true;
    notifyListeners();
  }

  Future<void> pause() async {
    await audio.pause();
    _isPlaying = false;
    notifyListeners();
  }

  Future<void> togglePlay() => _isPlaying ? pause() : play();

  Future<void> seek(Duration position) async {
    await audio.seek(position);
    _position = audio.position;
    notifyListeners();
  }

  /// Adelanta o retrocede unos segundos (los botones de ±15 s).
  Future<void> skip(Duration offset) => seek(_position + offset);

  Future<void> setBackgroundSound(BackgroundSound sound) async {
    _backgroundSound = sound;
    await audio.setBackgroundSound(sound);
    notifyListeners();
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    _completedSubscription?.cancel();
    // Paramos el audio, pero NO liberamos el AudioService: lo comparte toda
    // la app y lo cierra `main.dart` cuando se cierra la aplicación.
    audio.pause();
    super.dispose();
  }
}
