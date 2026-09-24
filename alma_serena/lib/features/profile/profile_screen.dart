import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/gradient_background.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/soft_card.dart';
import '../../data/models/app_user.dart';
import '../../data/models/session_record.dart';
import '../auth/auth_controller.dart';
import '../paywall/subscription_controller.dart';
import 'progress_controller.dart';
import 'widgets/stat_tile.dart';
import 'widgets/week_strip.dart';

/// Perfil: racha, estadísticas, estado de la suscripción e historial.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final AppUser? user = context.watch<AuthController>().user;
    final ProgressController progress = context.watch<ProgressController>();
    final SubscriptionController subscription =
        context.watch<SubscriptionController>();
    final List<SessionRecord> history = progress.history;

    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          bottom: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: <Widget>[
              // --- Cabecera ---------------------------------------------
              Row(
                children: <Widget>[
                  Container(
                    width: 62,
                    height: 62,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: AppColors.brandGradient,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      user?.initials ?? '?',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          user?.name.isNotEmpty == true
                              ? user!.name
                              : 'Tu perfil',
                          style: text.titleLarge,
                        ),
                        const SizedBox(height: 2),
                        Text(user?.email ?? '', style: text.bodySmall),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Ajustes',
                    onPressed: () =>
                        Navigator.of(context).pushNamed(AppRoutes.settings),
                    icon: const Icon(Icons.settings_outlined),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // --- Estadísticas -------------------------------------------
              SoftCard(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 20,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: <Widget>[
                    StatTile(
                      icon: Icons.local_fire_department_rounded,
                      value: '${progress.streak}',
                      label: progress.streak == 1
                          ? 'día seguido'
                          : 'días seguidos',
                      color: AppColors.gold,
                    ),
                    StatTile(
                      icon: Icons.self_improvement_rounded,
                      value: '${progress.totalSessions}',
                      label: 'sesiones',
                      color: AppColors.lilac,
                    ),
                    StatTile(
                      icon: Icons.schedule_rounded,
                      value: Formatters.longDuration(progress.totalTime),
                      label: 'en total',
                      color: AppColors.blue,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // --- Semana --------------------------------------------------
              SoftCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('Esta semana', style: text.titleMedium),
                    const SizedBox(height: 4),
                    Text(
                      '${progress.minutesThisWeek} minutos en los últimos 7 días',
                      style: text.bodySmall,
                    ),
                    const SizedBox(height: 18),
                    WeekStrip(activity: progress.weekActivity()),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // --- Suscripción ---------------------------------------------
              SoftCard(
                onTap: subscription.isPremium
                    ? null
                    : () => Navigator.of(context).pushNamed(AppRoutes.paywall),
                child: Row(
                  children: <Widget>[
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.goldSoft,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.auto_awesome_rounded,
                        color: AppColors.gold,
                        size: 21,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            subscription.isPremium
                                ? 'Premium activo'
                                : 'Hazte premium',
                            style: text.titleMedium,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            subscription.isPremium
                                ? 'Plan ${subscription.activePlan?.title.toLowerCase() ?? ''} · gestiónalo en Ajustes'
                                : 'Desbloquea todas las sesiones',
                            style: text.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    if (!subscription.isPremium)
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: AppColors.inkFaint,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 26),

              // --- Historial ------------------------------------------------
              const SectionHeader(title: 'Historial'),
              const SizedBox(height: 14),
              if (history.isEmpty)
                SoftCard(
                  child: Column(
                    children: <Widget>[
                      const Icon(
                        Icons.spa_outlined,
                        size: 34,
                        color: AppColors.lilacSoft,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Aún no has terminado ninguna sesión.',
                        textAlign: TextAlign.center,
                        style: text.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Con una sesión de 5 minutos ya empiezas tu racha.',
                        textAlign: TextAlign.center,
                        style: text.bodySmall,
                      ),
                    ],
                  ),
                )
              else
                ...history
                    .take(12)
                    .map(
                      (SessionRecord record) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: SoftCard(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 14,
                          ),
                          child: Row(
                            children: <Widget>[
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: AppColors.lilacMist,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.check_rounded,
                                  size: 19,
                                  color: AppColors.lilac,
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(
                                      record.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: text.titleMedium,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${Formatters.relativeDate(record.completedAt)} · '
                                      '${Formatters.minutes(record.listened)}',
                                      style: text.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}
