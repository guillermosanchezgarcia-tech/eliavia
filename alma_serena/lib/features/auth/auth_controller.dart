import 'package:flutter/foundation.dart';

import '../../data/models/app_user.dart';
import '../../data/repositories/auth_repository.dart';

/// Estado de la sesión del usuario.
class AuthController extends ChangeNotifier {
  AuthController(this._repository) : _user = _repository.currentUser();

  final AuthRepository _repository;

  AppUser? _user;
  bool _isBusy = false;
  String? _errorMessage;

  AppUser? get user => _user;
  bool get isSignedIn => _user != null;
  bool get isBusy => _isBusy;
  String? get errorMessage => _errorMessage;

  Future<bool> signIn({
    required String email,
    required String password,
  }) {
    return _run(
      () => _repository.signIn(email: email, password: password),
    );
  }

  Future<bool> register({
    required String name,
    required String email,
    required String password,
  }) {
    return _run(
      () => _repository.register(
        name: name,
        email: email,
        password: password,
      ),
    );
  }

  Future<bool> signInWithGoogle() => _run(_repository.signInWithGoogle);

  Future<void> signOut() async {
    await _repository.signOut();
    _user = null;
    notifyListeners();
  }

  Future<void> updateName(String name) async {
    final AppUser? current = _user;
    if (current == null) return;
    _user = await _repository.updateProfile(current.copyWith(name: name));
    notifyListeners();
  }

  void clearError() {
    if (_errorMessage == null) return;
    _errorMessage = null;
    notifyListeners();
  }

  /// Ejecuta una operación de autenticación controlando "cargando" y errores,
  /// para no repetir el mismo try/catch en cada método.
  Future<bool> _run(Future<AppUser> Function() action) async {
    _isBusy = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _user = await action();
      return true;
    } on AuthException catch (error) {
      _errorMessage = error.message;
      return false;
    } catch (_) {
      _errorMessage = 'Algo ha fallado. Inténtalo de nuevo.';
      return false;
    } finally {
      _isBusy = false;
      notifyListeners();
    }
  }
}
