import 'package:flutter/material.dart';

import '../../features/auth/login_screen.dart';
import '../../features/auth/register_screen.dart';
import '../../features/library/category_screen.dart';
import '../../features/onboarding/onboarding_screen.dart';
import '../../features/paywall/paywall_screen.dart';
import '../../features/player/player_screen.dart';
import '../../features/profile/settings_screen.dart';
import '../../features/shell/main_shell.dart';
import '../../features/splash/splash_screen.dart';

/// Nombres de las pantallas y cómo se construye cada una.
///
/// Usamos el sistema de rutas con nombre de Flutter (sin librerías externas):
/// para una app de este tamaño es suficiente y se lee muy fácil.
class AppRoutes {
  const AppRoutes._();

  static const String splash = '/';
  static const String onboarding = '/onboarding';
  static const String login = '/login';
  static const String register = '/register';
  static const String home = '/home';
  static const String category = '/category';
  static const String player = '/player';
  static const String paywall = '/paywall';
  static const String settings = '/settings';

  static Route<dynamic> onGenerateRoute(RouteSettings routeSettings) {
    switch (routeSettings.name) {
      case splash:
        return _fade(const SplashScreen(), routeSettings);
      case onboarding:
        return _fade(const OnboardingScreen(), routeSettings);
      case login:
        return _fade(const LoginScreen(), routeSettings);
      case register:
        return _slide(const RegisterScreen(), routeSettings);
      case home:
        return _fade(const MainShell(), routeSettings);
      case category:
        // El identificador llega como argumento al abrir la ruta. Si no llega
        // (por ejemplo si alguien entra por una URL suelta en la web) volvemos
        // al arranque en vez de reventar.
        final Object? categoryId = routeSettings.arguments;
        if (categoryId is! String) return _fade(const SplashScreen(), routeSettings);
        return _slide(CategoryScreen(categoryId: categoryId), routeSettings);
      case player:
        final Object? sessionId = routeSettings.arguments;
        if (sessionId is! String) return _fade(const SplashScreen(), routeSettings);
        return _slide(PlayerScreen(sessionId: sessionId), routeSettings);
      case paywall:
        return _slide(const PaywallScreen(), routeSettings);
      case settings:
        return _slide(const SettingsScreen(), routeSettings);
      default:
        return _fade(const SplashScreen(), routeSettings);
    }
  }

  static Route<T> _fade<T>(Widget child, RouteSettings routeSettings) {
    return PageRouteBuilder<T>(
      settings: routeSettings,
      transitionDuration: const Duration(milliseconds: 350),
      pageBuilder: (_, _, _) => child,
      transitionsBuilder: (_, Animation<double> animation, _, Widget page) {
        return FadeTransition(opacity: animation, child: page);
      },
    );
  }

  static Route<T> _slide<T>(Widget child, RouteSettings routeSettings) {
    return PageRouteBuilder<T>(
      settings: routeSettings,
      transitionDuration: const Duration(milliseconds: 320),
      pageBuilder: (_, _, _) => child,
      transitionsBuilder: (_, Animation<double> animation, _, Widget page) {
        final Animation<Offset> offset =
            Tween<Offset>(
              begin: const Offset(0, 0.04),
              end: Offset.zero,
            ).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
            );
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(position: offset, child: page),
        );
      },
    );
  }
}
