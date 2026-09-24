import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/gradient_background.dart';
import '../auth/auth_controller.dart';
import '../onboarding/onboarding_controller.dart';

/// Pantalla de arranque. Solo decide a dónde ir:
///   - ¿primera vez? -> presentación
///   - ¿sin sesión iniciada? -> login
///   - ¿todo listo? -> inicio
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _decideNextScreen();
  }

  Future<void> _decideNextScreen() async {
    // Una pausa corta para que el logo no aparezca y desaparezca de golpe.
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;

    final bool seenOnboarding =
        context.read<OnboardingController>().hasSeenOnboarding;
    final bool isSignedIn = context.read<AuthController>().isSignedIn;

    final String next = !seenOnboarding
        ? AppRoutes.onboarding
        : (isSignedIn ? AppRoutes.home : AppRoutes.login);

    Navigator.of(context).pushReplacementNamed(next);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GradientBackground(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const AppLogo(size: 104),
              const SizedBox(height: 28),
              Text(
                'Alma Serena',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(
                'Meditación y descanso',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Logotipo provisional: un círculo con degradado de marca y una hoja dentro.
///
/// TODO(diseño): sustituir por el logotipo definitivo (un PNG o SVG en
/// assets/images/) cuando lo tengas.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 72});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: AppColors.brandGradient,
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: AppColors.lilac.withValues(alpha: 0.35),
            blurRadius: 32,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Icon(
        Icons.spa_rounded,
        size: size * 0.46,
        color: Colors.white,
      ),
    );
  }
}
