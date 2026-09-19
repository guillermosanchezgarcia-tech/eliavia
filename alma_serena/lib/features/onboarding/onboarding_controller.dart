import 'package:flutter/foundation.dart';

import '../../data/services/local_storage.dart';

/// Recuerda si el usuario ya vio la presentación inicial.
class OnboardingController extends ChangeNotifier {
  OnboardingController(this._storage) : _seen = _storage.onboardingSeen;

  final LocalStorage _storage;
  bool _seen;

  bool get hasSeenOnboarding => _seen;

  Future<void> complete() async {
    if (_seen) return;
    _seen = true;
    await _storage.setOnboardingSeen(true);
    notifyListeners();
  }

  /// Útil para pruebas y para el botón "Ver la introducción otra vez".
  Future<void> reset() async {
    _seen = false;
    await _storage.setOnboardingSeen(false);
    notifyListeners();
  }
}
