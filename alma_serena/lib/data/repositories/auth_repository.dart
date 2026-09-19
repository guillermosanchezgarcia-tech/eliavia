import 'dart:convert';

import '../models/app_user.dart';
import '../services/local_storage.dart';

/// Error de autenticación con un mensaje ya listo para enseñar al usuario.
class AuthException implements Exception {
  const AuthException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Registro e inicio de sesión.
///
/// IMPORTANTE: esto es una maqueta local. Las cuentas se guardan solo en este
/// teléfono y la contraseña se guarda codificada, **no cifrada**: sirve para
/// probar la app, no para producción.
///
/// TODO(backend): sustituir por Firebase Auth:
///   - `FirebaseAuth.instance.createUserWithEmailAndPassword(...)`
///   - `FirebaseAuth.instance.signInWithEmailAndPassword(...)`
///   - `GoogleSignIn()` + `signInWithCredential(...)` para el botón de Google.
/// La interfaz pública de esta clase ya está pensada para que el cambio no
/// afecte a las pantallas.
class AuthRepository {
  AuthRepository(this._storage);

  final LocalStorage _storage;

  /// Usuario con la sesión iniciada, o `null` si no hay ninguno.
  AppUser? currentUser() {
    final String? json = _storage.currentUser;
    if (json == null) return null;
    try {
      return AppUser.fromJson(json);
    } on FormatException {
      return null;
    }
  }

  Future<AppUser> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final String normalized = _normalize(email);
    final List<String> accounts = _storage.accounts;
    if (accounts.any((String a) => _accountEmail(a) == normalized)) {
      throw const AuthException('Ya existe una cuenta con este correo.');
    }
    final AppUser user = AppUser(
      id: 'local-${DateTime.now().millisecondsSinceEpoch}',
      email: normalized,
      name: name.trim(),
    );
    accounts.add('$normalized::${_obfuscate(password)}::${user.name}');
    await _storage.setAccounts(accounts);
    await _storage.setCurrentUser(user.toJson());
    return user;
  }

  Future<AppUser> signIn({
    required String email,
    required String password,
  }) async {
    final String normalized = _normalize(email);
    final String? account = _storage.accounts.cast<String?>().firstWhere(
      (String? a) => _accountEmail(a!) == normalized,
      orElse: () => null,
    );
    if (account == null) {
      throw const AuthException('No hay ninguna cuenta con este correo.');
    }
    final List<String> parts = account.split('::');
    if (parts.length < 2 || parts[1] != _obfuscate(password)) {
      throw const AuthException('La contraseña no es correcta.');
    }
    final AppUser user = AppUser(
      id: 'local-$normalized',
      email: normalized,
      name: parts.length > 2 ? parts[2] : '',
    );
    await _storage.setCurrentUser(user.toJson());
    return user;
  }

  /// Entrada con Google.
  ///
  /// TODO(backend): implementar de verdad con `google_sign_in` +
  /// `FirebaseAuth.signInWithCredential`. De momento crea una cuenta de
  /// demostración para poder recorrer la app entera.
  Future<AppUser> signInWithGoogle() async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    const AppUser user = AppUser(
      id: 'google-demo',
      email: 'invitada@almaserena.es',
      name: 'Invitada',
    );
    await _storage.setCurrentUser(user.toJson());
    return user;
  }

  Future<void> signOut() => _storage.setCurrentUser(null);

  /// Guarda cambios del perfil (por ahora, solo el nombre).
  Future<AppUser> updateProfile(AppUser user) async {
    await _storage.setCurrentUser(user.toJson());
    return user;
  }

  static String _normalize(String email) => email.trim().toLowerCase();

  static String _accountEmail(String account) => account.split('::').first;

  /// Codificación reversible. NO es seguridad: solo evita guardar la
  /// contraseña en texto plano en una maqueta local.
  static String _obfuscate(String password) =>
      base64Encode(utf8.encode('alma::$password'));
}
