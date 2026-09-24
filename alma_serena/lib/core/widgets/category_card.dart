import 'package:flutter/material.dart';

import '../../data/models/meditation_category.dart';
import '../theme/app_colors.dart';
import 'premium_badge.dart';

/// Tarjeta circular de una categoría: un círculo grande de color con el icono
/// dentro y el nombre debajo. Es el elemento visual característico de la app.
class CategoryCard extends StatelessWidget {
  const CategoryCard({
    super.key,
    required this.category,
    required this.onTap,
    this.locked = false,
    this.diameter = 96,
  });

  final MeditationCategory category;
  final VoidCallback onTap;

  /// Muestra el candado cuando es premium y el usuario no está suscrito.
  final bool locked;

  final double diameter;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;

    return SizedBox(
      width: diameter + 16,
      child: Column(
        children: <Widget>[
          Semantics(
            button: true,
            label: 'Categoría ${category.name}',
            child: InkWell(
              onTap: onTap,
              customBorder: const CircleBorder(),
              child: Stack(
                alignment: Alignment.center,
                children: <Widget>[
                  Container(
                    width: diameter,
                    height: diameter,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: AppColors.softGradient(category.color),
                      boxShadow: <BoxShadow>[
                        BoxShadow(
                          color: category.color.withValues(alpha: 0.30),
                          blurRadius: 22,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Icon(
                      category.icon,
                      size: diameter * 0.38,
                      color: Colors.white,
                    ),
                  ),
                  if (locked)
                    Positioned(
                      right: 2,
                      bottom: 2,
                      child: Container(
                        padding: const EdgeInsets.all(5),
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: const PremiumBadge(compact: true),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            category.name,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: text.titleMedium,
          ),
          const SizedBox(height: 2),
          Text(
            category.tagline,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: text.bodySmall,
          ),
        ],
      ),
    );
  }
}
