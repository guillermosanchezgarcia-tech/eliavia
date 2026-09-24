import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'data/repositories/auth_repository.dart';
import 'data/repositories/content_repository.dart';
import 'data/repositories/progress_repository.dart';
import 'data/repositories/subscription_repository.dart';
import 'data/services/audio_service.dart';
import 'data/services/local_storage.dart';
import 'features/auth/auth_controller.dart';
import 'features/onboarding/onboarding_controller.dart';
import 'features/paywall/subscription_controller.dart';
import 'features/profile/progress_controller.dart';

/// Punto de entrada de Alma Serena.
///
/// Aquí se crean una sola vez las "piezas" de la app (guardado local,
/// repositorios y controladores de estado) y se pasan al árbol de widgets con
/// `provider`. Cualquier pantalla puede pedirlas con `context.read<...>()`.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // La app es solo en castellano: cargamos los nombres de meses y días.
  await initializeDateFormatting('es');

  // Barra de estado transparente con iconos oscuros (fondo claro).
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );

  // TODO(backend): antes de esta línea irá `await Firebase.initializeApp(...)`
  // cuando conectemos Firebase Auth + Firestore.
  final LocalStorage storage = await LocalStorage.create();

  runApp(
    MultiProvider(
      providers: [
        // --- Guardado local y repositorios (de dónde salen los datos) -----
        Provider<LocalStorage>.value(value: storage),
        Provider<ContentRepository>(create: (_) => const ContentRepository()),
        Provider<AuthRepository>(create: (_) => AuthRepository(storage)),
        Provider<ProgressRepository>(
          create: (_) => ProgressRepository(storage),
        ),
        Provider<SubscriptionRepository>(
          create: (_) => SubscriptionRepository(storage),
        ),

        // --- Reproductor --------------------------------------------------
        // TODO(audio): cambiar `MockAudioService()` por la implementación real
        // cuando existan los archivos de audio. Nada más hay que tocar.
        Provider<AudioService>(
          create: (_) => MockAudioService(),
          dispose: (_, AudioService service) => service.dispose(),
        ),

        // --- Estado de la app ---------------------------------------------
        ChangeNotifierProvider<OnboardingController>(
          create: (_) => OnboardingController(storage),
        ),
        ChangeNotifierProvider<AuthController>(
          create: (BuildContext context) =>
              AuthController(context.read<AuthRepository>()),
        ),
        ChangeNotifierProvider<SubscriptionController>(
          create: (BuildContext context) =>
              SubscriptionController(context.read<SubscriptionRepository>()),
        ),
        ChangeNotifierProvider<ProgressController>(
          create: (BuildContext context) =>
              ProgressController(context.read<ProgressRepository>()),
        ),
      ],
      child: const AlmaSerenaApp(),
    ),
  );
}
