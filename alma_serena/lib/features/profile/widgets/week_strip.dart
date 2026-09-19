import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Los siete días de la semana con un punto lleno en los que hubo sesión.
class WeekStrip extends StatelessWidget {
  const WeekStrip({super.key, required this.activity});

  /// Siete valores, de lunes a domingo.
  final List<bool> activity;

  static const List<String> _labels = <String>[
    'L',
    'M',
    'X',
    'J',
    'V',
    'S',
    'D',
  ];

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List<Widget>.generate(7, (int index) {
        final bool done = index < activity.length && activity[index];
        return Column(
          children: <Widget>[
            Text(
              _labels[index],
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.inkFaint,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: done ? AppColors.brandGradient : null,
                color: done ? null : AppColors.lilacMist,
              ),
              child: done
                  ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
                  : null,
            ),
          ],
        );
      }),
    );
  }
}
