import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Tarjeta blanca con esquinas muy redondeadas y una sombra apenas visible.
/// Es la base visual de casi todas las listas de la app.
class SoftCard extends StatelessWidget {
  const SoftCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(18),
    this.color = AppColors.surface,
    this.borderRadius,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color color;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final BorderRadius radius =
        borderRadius ?? BorderRadius.circular(AppTheme.radius);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color,
        borderRadius: radius,
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: AppColors.lilac.withValues(alpha: 0.10),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: radius,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}
