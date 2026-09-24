import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Fondo con el degradado de la app y, opcionalmente, dos halos de color muy
/// difuminados que le dan el aire "calmado" del diseño.
class GradientBackground extends StatelessWidget {
  const GradientBackground({
    super.key,
    required this.child,
    this.showHalos = true,
  });

  final Widget child;
  final bool showHalos;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AppColors.backgroundGradient),
      child: Stack(
        children: <Widget>[
          if (showHalos) ...<Widget>[
            const Positioned(
              top: -120,
              right: -90,
              child: _Halo(color: AppColors.lilacSoft, size: 300),
            ),
            const Positioned(
              bottom: -140,
              left: -110,
              child: _Halo(color: AppColors.blueSoft, size: 320),
            ),
          ],
          child,
        ],
      ),
    );
  }
}

class _Halo extends StatelessWidget {
  const _Halo({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: <Color>[color.withValues(alpha: 0.45), Colors.transparent],
          ),
        ),
      ),
    );
  }
}
