import 'package:alma_serena/data/repositories/auth_repository.dart';
import 'package:alma_serena/data/services/local_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AuthRepository auth;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    auth = AuthRepository(await LocalStorage.create());
  });

  test('al registrarse queda la sesión iniciada', () async {
    await auth.register(
      name: 'Ana López',
      email: 'Ana@Ejemplo.es',
      password: 'secreta123',
    );

    expect(auth.currentUser()?.email, 'ana@ejemplo.es');
    expect(auth.currentUser()?.initials, 'AL');
  });

  test('no se puede repetir el correo', () async {
    await auth.register(name: 'Ana', email: 'ana@ejemplo.es', password: '123456');

    expect(
      () => auth.register(
        name: 'Otra Ana',
        email: 'ana@ejemplo.es',
        password: '654321',
      ),
      throwsA(isA<AuthException>()),
    );
  });

  test('entrar con la contraseña equivocada falla', () async {
    await auth.register(name: 'Ana', email: 'ana@ejemplo.es', password: '123456');
    await auth.signOut();

    expect(
      () => auth.signIn(email: 'ana@ejemplo.es', password: 'otra'),
      throwsA(isA<AuthException>()),
    );
  });

  test('entrar con los datos correctos recupera la cuenta', () async {
    await auth.register(name: 'Ana', email: 'ana@ejemplo.es', password: '123456');
    await auth.signOut();
    expect(auth.currentUser(), isNull);

    await auth.signIn(email: 'ana@ejemplo.es', password: '123456');
    expect(auth.currentUser()?.name, 'Ana');
  });
}
