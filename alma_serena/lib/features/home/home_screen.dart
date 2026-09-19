import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/router/app_router.dart';
import '../../core/router/session_navigation.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/category_card.dart';
import '../../core/widgets/gradient_background.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/session_tile.dart';
import '../../core/widgets/soft_card.dart';
import '../../data/models/meditation_category.dart';
import '../../data/models/meditation_session.dart';
import '../../data/repositories/content_repository.dart';
import '../auth/auth_controller.dart';
import '../paywall/subscription_controller.dart';
import '../profile/progress_controller.dart';
import '../shell/shell_controller.dart';
import 'widgets/premium_banner.dart';
import 'widgets/session_of_the_day_card.dart';

/// Pantalla de inicio: saludo, sesión recomendada, categorías y sesiones
/// cortas para empezar.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<MeditationCategory> _categories = <MeditationCategory>[];
  List<MeditationSession> _quickSessions = <MeditationSession>[];
  MeditationSession? _sessionOfTheDay;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Pide el contenido al repositorio.
  /// Hoy responde al instante (son datos locales), pero está escrito como si
  /// viniera de internet para que no haya que tocarlo cuando lo esté.
  Future<void> _load() async {
    final ContentRepository content = context.read<ContentRepository>();
    final List<MeditationCategory> categories = await content.categories();
    final MeditationSession today = await content.sessionOfTheDay();
    final List<MeditationSession> all = await content.sessions();

    if (!mounted) return;
    setState(() {
      _categories = categories;
      _sessionOfTheDay = today;
      _quickSessions = all
          .where(
            (MeditationSession s) =>
                s.duration.inMinutes <= 10 && s.id != today.id,
          )
          .take(4)
          .toList();
      _loading = false;
    });
  }

  MeditationCategory? _categoryOf(MeditationSession session) {
    for (final MeditationCategory category in _categories) {
      if (category.id == session.categoryId) return category;
    }
    return null;
  }

  bool _isLocked(MeditationSession session) {
    final bool premiumCategory = _categoryOf(session)?.isPremium ?? false;
    final bool needsPremium = session.isPremium || premiumCategory;
    return !context.read<SubscriptionController>().canOpen(
      isPremiumContent: needsPremium,
    );
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final ContentRepository content = context.read<ContentRepository>();
    final String? name = context.watch<AuthController>().user?.name;
    final bool isPremium = context.watch<SubscriptionController>().isPremium;
    final int streak = context.watch<ProgressController>().streak;
    final DateTime now = DateTime.now();

    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          bottom: false,
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                    children: <Widget>[
                      // --- Saludo -------------------------------------------
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(
                                  Formatters.longDate(now),
                                  style: text.bodySmall,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  name == null || name.isEmpty
                                      ? Formatters.greeting(now)
                                      : '${Formatters.greeting(now)}, $name',
                                  style: text.headlineSmall,
                                ),
                              ],
                            ),
                          ),
                          if (streak > 0) _StreakChip(days: streak),
                        ],
                      ),
                      const SizedBox(height: 18),

                      // --- Frase del día ------------------------------------
                      SoftCard(
                        padding: const EdgeInsets.all(18),
                        child: Row(
                          children: <Widget>[
                            const Icon(
                              Icons.format_quote_rounded,
                              color: AppColors.lilacSoft,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                content.quoteOfTheDay(now),
                                style: text.bodyMedium?.copyWith(
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // --- Sesión del día -----------------------------------
                      if (_sessionOfTheDay != null)
                        SessionOfTheDayCard(
                          session: _sessionOfTheDay!,
                          category: _categoryOf(_sessionOfTheDay!),
                          locked: _isLocked(_sessionOfTheDay!),
                          onTap: () => openSession(
                            context,
                            _sessionOfTheDay!,
                            categoryIsPremium:
                                _categoryOf(_sessionOfTheDay!)?.isPremium ??
                                false,
                          ),
                        ),
                      const SizedBox(height: 28),

                      // --- Categorías ---------------------------------------
                      SectionHeader(
                        title: 'Categorías',
                        actionLabel: 'Ver todas',
                        onAction: () => context
                            .read<ShellController>()
                            .goTo(ShellTab.library),
                      ),
                      const SizedBox(height: 14),
                      SizedBox(
                        height: 176,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          itemCount: _categories.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(width: 14),
                          itemBuilder: (BuildContext context, int index) {
                            final MeditationCategory category =
                                _categories[index];
                            return CategoryCard(
                              category: category,
                              locked: category.isPremium && !isPremium,
                              onTap: () => Navigator.of(context).pushNamed(
                                AppRoutes.category,
                                arguments: category.id,
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 26),

                      // --- Premium ------------------------------------------
                      if (!isPremium) ...<Widget>[
                        PremiumBanner(
                          onTap: () => Navigator.of(context)
                              .pushNamed(AppRoutes.paywall),
                        ),
                        const SizedBox(height: 26),
                      ],

                      // --- Sesiones cortas ----------------------------------
                      const SectionHeader(title: 'Para empezar con poco'),
                      const SizedBox(height: 14),
                      ..._quickSessions.map(
                        (MeditationSession session) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: SessionTile(
                            session: session,
                            category: _categoryOf(session),
                            locked: _isLocked(session),
                            onTap: () => openSession(
                              context,
                              session,
                              categoryIsPremium:
                                  _categoryOf(session)?.isPremium ?? false,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }
}

/// Pastilla con la racha de días, arriba a la derecha.
class _StreakChip extends StatelessWidget {
  const _StreakChip({required this.days});

  final int days;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(99),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: AppColors.lilac.withValues(alpha: 0.14),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const Icon(
            Icons.local_fire_department_rounded,
            size: 18,
            color: AppColors.gold,
          ),
          const SizedBox(width: 6),
          Text(
            '$days ${days == 1 ? 'día' : 'días'}',
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}
