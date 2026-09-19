/// Comprobaciones de los formularios de acceso.
/// Devuelven `null` cuando el valor es correcto y un mensaje cuando no lo es.
class AuthValidators {
  const AuthValidators._();

  static final RegExp _email = RegExp(r'^[\w.+-]+@[\w-]+\.[\w.-]+$');

  static String? name(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Escribe tu nombre';
    }
    if (value.trim().length < 2) {
      return 'El nombre es demasiado corto';
    }
    return null;
  }

  static String? email(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Escribe tu correo';
    }
    if (!_email.hasMatch(value.trim())) {
      return 'Este correo no parece válido';
    }
    return null;
  }

  static String? password(String? value) {
    if (value == null || value.isEmpty) {
      return 'Escribe una contraseña';
    }
    if (value.length < 6) {
      return 'Usa al menos 6 caracteres';
    }
    return null;
  }
}
