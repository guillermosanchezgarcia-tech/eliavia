import 'package:flutter/material.dart';

import '../../data/models/meditation_category.dart';
import '../../data/models/meditation_session.dart';
import '../theme/app_colors.dart';
import '../utils/formatters.dart';
import 'premium_badge.dart';
import 'soft_card.dart';

/// Fila de una sesión dentro de una lista: círculo de color, título, duración
/// y, si toca, la etiqueta de premium.
class SessionTile extends StatelessWidget {
  const SessionTile({
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
    final TextTheme text = Theme.of(context).textTheme;
    final Color color = category?.color ?? AppColors.lilac;

    return SoftCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: <Widget>[
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: AppColors.softGradient(color),
            ),
            child: Icon(
              locked
                  ? Icons.lock_outline_rounded
                  : (category?.icon ?? Icons.play_arrow_rounded),
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  session.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: text.titleMedium,
                ),
                const SizedBox(height: 4),
                Row(
                  children: <Widget>[
                    const Icon(
                      Icons.schedule_rounded,
                      size: 14,
                      color: AppColors.inkFaint,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      Formatters.minutes(session.duration),
                      style: text.bodySmall,
                    ),
                    const SizedBox(width: 10),
                    Flexible(
                      child: Text(
                        session.narrator,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: text.bodySmall,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (locked)
            const PremiumBadge()
          else
            const Icon(
              Icons.chevron_right_rounded,
              color: AppColors.inkFaint,
            ),
        ],
      ),
    );
  }
}
