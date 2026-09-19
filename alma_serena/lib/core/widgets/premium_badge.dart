import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// Etiqueta dorada que marca el contenido reservado a suscriptores.
class PremiumBadge extends StatelessWidget {
  const PremiumBadge({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return const Icon(Icons.lock_outline_rounded, size: 16, color: AppColors.gold);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.goldSoft,
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.lock_outline_rounded, size: 13, color: AppColors.gold),
          SizedBox(width: 5),
          Text(
            'Premium',
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: AppColors.gold,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
