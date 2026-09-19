import 'package:alma_serena/core/theme/app_theme.dart';
import 'package:alma_serena/data/services/local_storage.dart';
import 'package:alma_serena/features/onboarding/onboarding_controller.dart';
import 'package:alma_serena/features/onboarding/onboarding_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Prueba de pantalla: comprueba que el onboarding se puede recorrer y que al
/// terminar queda marcado como visto.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStorage storage;

  Future<void> pumpOnboarding(WidgetTester tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    storage = await LocalStorage.create();

    await tester.pumpWidget(
      ChangeNotifierProvider<OnboardingController>(
        create: (_) => OnboardingController(storage),
        child: MaterialApp(
          theme: AppTheme.light,
          home: const OnboardingScreen(),
          routes: <String, WidgetBuilder>{
            '/login': (_) => const Scaffold(body: Text('pantalla de acceso')),
          },
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('muestra el primer paso', (WidgetTester tester) async {
    await pumpOnboarding(tester);

    expect(find.text('Respira, estás en casa'), findsOneWidget);
    expect(find.text('Siguiente'), findsOneWidget);
    expect(find.text('Saltar'), findsOneWidget);
  });

  testWidgets('avanza hasta el último paso', (WidgetTester tester) async {
    await pumpOnboarding(tester);

    // Ojo: aquí no se puede usar pumpAndSettle porque el círculo tiene una
    // animación que no termina nunca (la "respiración"). Avanzamos el reloj
    // a mano lo justo para que acabe la transición entre páginas.
    await tester.tap(find.text('Siguiente'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Duerme mejor'), findsOneWidget);

    await tester.tap(find.text('Siguiente'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Tu ritmo, tu progreso'), findsOneWidget);
    expect(find.text('Empezar'), findsOneWidget);
  });

  testWidgets('saltar marca el onboarding como visto y va al acceso', (
    WidgetTester tester,
  ) async {
    await pumpOnboarding(tester);

    await tester.tap(find.text('Saltar'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));

    expect(storage.onboardingSeen, isTrue);
    expect(find.text('pantalla de acceso'), findsOneWidget);
  });
}
