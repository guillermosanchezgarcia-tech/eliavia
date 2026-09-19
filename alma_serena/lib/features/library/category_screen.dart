import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/router/session_navigation.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/gradient_background.dart';
import '../../core/widgets/session_tile.dart';
import '../../data/models/meditation_category.dart';
import '../../data/models/meditation_session.dart';
import '../../data/repositories/content_repository.dart';
import '../paywall/subscription_controller.dart';

/// Lista de sesiones de una categoría.
class CategoryScreen extends StatefulWidget {
  const CategoryScreen({super.key, required this.categoryId});

  final String categoryId;

  @override
  State<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends State<CategoryScreen> {
  MeditationCategory? _category;
  List<MeditationSession> _sessions = <MeditationSession>[];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final ContentRepository content = context.read<ContentRepository>();
    final MeditationCategory? category = content.categoryById(
      widget.categoryId,
    );
    final List<MeditationSession> sessions = await content.sessionsByCategory(
      widget.categoryId,
    );
    if (!mounted) return;
    setState(() {
      _category = category;
      _sessions = sessions;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final SubscriptionController subscription =
        context.watch<SubscriptionController>();
    final MeditationCategory? category = _category;

    final Duration total = _sessions.fold(
      Duration.zero,
      (Duration sum, MeditationSession s) => sum + s.duration,
    );

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(title: Text(category?.name ?? 'Categoría')),
      body: GradientBackground(
        child: SafeArea(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                  children: <Widget>[
                    if (category != null) ...<Widget>[
                      Center(
                        child: Container(
                          width: 110,
                          height: 110,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: AppColors.softGradient(category.color),
                            boxShadow: <BoxShadow>[
                              BoxShadow(
                                color: category.color.withValues(alpha: 0.30),
                                blurRadius: 30,
                                offset: const Offset(0, 14),
                              ),
                            ],
                          ),
                          child: Icon(
                            category.icon,
                            size: 44,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        category.tagline,
                        textAlign: TextAlign.center,
                        style: text.headlineSmall,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${_sessions.length} sesiones · '
                        '${Formatters.longDuration(total)} en total',
                        textAlign: TextAlign.center,
                        style: text.bodySmall,
                      ),
                      const SizedBox(height: 28),
                    ],
                    ..._sessions.map(
                      (MeditationSession session) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: SessionTile(
                          session: session,
                          category: category,
                          locked: !subscription.canOpen(
                            isPremiumContent:
                                session.isPremium ||
                                (category?.isPremium ?? false),
                          ),
                          onTap: () => openSession(
                            context,
                            session,
                            categoryIsPremium: category?.isPremium ?? false,
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
