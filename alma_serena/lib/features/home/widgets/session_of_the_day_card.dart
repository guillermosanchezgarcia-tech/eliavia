import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/meditation_category.dart';
import '../../../data/models/meditation_session.dart';
import '../../../core/widgets/premium_badge.dart';

/// Tarjeta grande de la sesión recomendada del día.
class SessionOfTheDayCard extends StatelessWidget {
  const SessionOfTheDayCard({
    super.key,
    required this.session,
    required this.category,
    required this.onTap,
    this.locked = false,
  });

  final MeditationSession session;
  final MeditationCategory? category;
  final VoidCallback onTap;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final Color color = category?.color ?? AppColors.lilac;
    final BorderRadius radius = BorderRadius.circular(AppTheme.radius + 4);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: radius,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: <Color>[
                Color.lerp(color, AppColors.lilac, 0.35)!,
                Color.lerp(color, AppColors.blue, 0.55)!,
              ],
            ),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: color.withValues(alpha: 0.32),
                blurRadius: 30,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.22),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: const Text(
                        'Hoy te proponemos',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (locked) const PremiumBadge(),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  session.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 23,
                    height: 1.25,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  session.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.88),
                    fontSize: 14.5,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: <Widget>[
                    Container(
                      width: 52,
                      height: 52,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        locked
                            ? Icons.lock_outline_rounded
                            : Icons.play_arrow_rounded,
                        color: color,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          Formatters.minutes(session.duration),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          'Con ${session.narrator}',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
