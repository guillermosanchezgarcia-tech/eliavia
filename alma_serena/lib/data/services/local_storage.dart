import 'package:shared_preferences/shared_preferences.dart';

/// Guardado local en el teléfono (clave -> valor).
///
/// Es la "memoria" de la app mientras no haya servidor: recuerda si ya se vio
/// el onboarding, quién ha iniciado sesión, la racha y el historial.
///
/// TODO(backend): cuando exista Firestore, el historial y la racha deberían
/// sincronizarse con la nube y dejar aquí solo las preferencias del dispositivo.
class LocalStorage {
  LocalStorage(this._prefs);

  final SharedPreferences _prefs;

  /// Crea la instancia. Se llama una sola vez, al arrancar la app.
  static Future<LocalStorage> create() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    return LocalStorage(prefs);
  }

  // --- Claves usadas ------------------------------------------------------
  static const String _kOnboardingSeen = 'onboarding_seen';
  static const String _kCurrentUser = 'current_user';
  static const String _kAccounts = 'accounts';
  static const String _kHistory = 'session_history';
  static const String _kPremium = 'is_premium';
  static const String _kPlanId = 'premium_plan_id';
  static const String _kReminder = 'daily_reminder';
  static const String _kBackgroundSound = 'background_sound';

  bool get onboardingSeen => _prefs.getBool(_kOnboardingSeen) ?? false;
  Future<void> setOnboardingSeen(bool value) =>
      _prefs.setBool(_kOnboardingSeen, value);

  String? get currentUser => _prefs.getString(_kCurrentUser);
  Future<void> setCurrentUser(String? json) async {
    if (json == null) {
      await _prefs.remove(_kCurrentUser);
    } else {
      await _prefs.setString(_kCurrentUser, json);
    }
  }

  /// Cuentas registradas en este dispositivo, en formato "email::hash::nombre".
  /// Devolvemos siempre una copia modificable: la lista que entrega
  /// SharedPreferences puede ser de solo lectura.
  List<String> get accounts =>
      List<String>.from(_prefs.getStringList(_kAccounts) ?? <String>[]);
  Future<void> setAccounts(List<String> value) =>
      _prefs.setStringList(_kAccounts, value);

  List<String> get history =>
      List<String>.from(_prefs.getStringList(_kHistory) ?? <String>[]);
  Future<void> setHistory(List<String> value) =>
      _prefs.setStringList(_kHistory, value);

  bool get isPremium => _prefs.getBool(_kPremium) ?? false;
  Future<void> setPremium(bool value) => _prefs.setBool(_kPremium, value);

  String? get planId => _prefs.getString(_kPlanId);
  Future<void> setPlanId(String? value) async {
    if (value == null) {
      await _prefs.remove(_kPlanId);
    } else {
      await _prefs.setString(_kPlanId, value);
    }
  }

  bool get dailyReminder => _prefs.getBool(_kReminder) ?? false;
  Future<void> setDailyReminder(bool value) =>
      _prefs.setBool(_kReminder, value);

  String? get backgroundSound => _prefs.getString(_kBackgroundSound);
  Future<void> setBackgroundSound(String value) =>
      _prefs.setString(_kBackgroundSound, value);
}
