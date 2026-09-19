import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

/// Widget raíz: tema, idioma y sistema de navegación.
class AlmaSerenaApp extends StatelessWidget {
  const AlmaSerenaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Alma Serena',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,

      // La app está pensada en castellano; los textos de los widgets de
      // Material (por ejemplo "Cancelar" en los diálogos) también.
      locale: const Locale('es'),
      supportedLocales: const <Locale>[Locale('es')],
      localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],

      initialRoute: AppRoutes.splash,
      onGenerateRoute: AppRoutes.onGenerateRoute,
    );
  }
}
