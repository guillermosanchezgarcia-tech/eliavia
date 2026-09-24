import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/router/app_router.dart';
import '../../core/router/session_navigation.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/category_card.dart';
import '../../core/widgets/gradient_background.dart';
import '../../core/widgets/section_header.dart';
import '../../core/widgets/session_tile.dart';
import '../../data/models/meditation_category.dart';
import '../../data/models/meditation_session.dart';
import '../../data/repositories/content_repository.dart';
import '../paywall/subscription_controller.dart';

/// Pestaña "Explorar": todas las categorías y un buscador de sesiones.
class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  final TextEditingController _search = TextEditingController();

  List<MeditationCategory> _categories = <MeditationCategory>[];
  List<MeditationSession> _sessions = <MeditationSession>[];
  bool _loading = true;
  bool _onlyFree = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final ContentRepository content = context.read<ContentRepository>();
    final List<MeditationCategory> categories = await content.categories();
    final List<MeditationSession> sessions = await content.sessions();
    if (!mounted) return;
    setState(() {
      _categories = categories;
      _sessions = sessions;
      _loading = false;
    });
  }

  MeditationCategory? _categoryOf(MeditationSession session) {
    for (final MeditationCategory category in _categories) {
      if (category.id == session.categoryId) return category;
    }
    return null;
  }

  bool _needsPremium(MeditationSession session) =>
      session.isPremium || (_categoryOf(session)?.isPremium ?? false);

  List<MeditationSession> get _visibleSessions {
    final String query = _search.text.trim().toLowerCase();
    return _sessions.where((MeditationSession session) {
      if (_onlyFree && _needsPremium(session)) return false;
      if (query.isEmpty) return true;
      final String categoryName = _categoryOf(session)?.name ?? '';
      return session.title.toLowerCase().contains(query) ||
          session.description.toLowerCase().contains(query) ||
          categoryName.toLowerCase().contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final SubscriptionController subscription =
        context.watch<SubscriptionController>();
    final List<MeditationSession> sessions = _visibleSessions;

    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          bottom: false,
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                  children: <Widget>[
                    Text('Explorar', style: text.displaySmall),
                    const SizedBox(height: 6),
                    Text(
                      'Elige por lo que necesitas hoy.',
                      style: text.bodyMedium,
                    ),
                    const SizedBox(height: 20),

                    TextField(
                      controller: _search,
                      onChanged: (_) => setState(() {}),
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: 'Buscar una sesión',
                        prefixIcon: const Icon(
                          Icons.search_rounded,
                          color: AppColors.inkFaint,
                        ),
                        suffixIcon: _search.text.isEmpty
                            ? null
                            : IconButton(
                                icon: const Icon(
                                  Icons.close_rounded,
                                  color: AppColors.inkFaint,
                                ),
                                onPressed: () {
                                  _search.clear();
                                  setState(() {});
                                },
                              ),
                      ),
                    ),
                    const SizedBox(height: 22),

                    const SectionHeader(title: 'Categorías'),
                    const SizedBox(height: 16),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _categories.length,
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 3,
                            mainAxisSpacing: 20,
                            crossAxisSpacing: 8,
                            childAspectRatio: 0.66,
                          ),
                      itemBuilder: (BuildContext context, int index) {
                        final MeditationCategory category = _categories[index];
                        return CategoryCard(
                          category: category,
                          diameter: 84,
                          locked:
                              category.isPremium && !subscription.isPremium,
                          onTap: () => Navigator.of(context).pushNamed(
                            AppRoutes.category,
                            arguments: category.id,
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 26),

                    Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            'Todas las sesiones',
                            style: text.titleLarge,
                          ),
                        ),
                        FilterChip(
                          label: const Text('Solo gratis'),
                          selected: _onlyFree,
                          onSelected: (bool value) =>
                              setState(() => _onlyFree = value),
                          showCheckmark: false,
                          backgroundColor: Colors.white,
                          selectedColor: AppColors.lilacMist,
                          side: const BorderSide(color: AppColors.lilacMist),
                          labelStyle: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: _onlyFree
                                ? AppColors.lilac
                                : AppColors.inkSoft,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    if (sessions.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 30),
                        child: Center(
                          child: Text(
                            'No hemos encontrado nada con esa búsqueda.',
                            textAlign: TextAlign.center,
                            style: text.bodyMedium,
                          ),
                        ),
                      )
                    else
                      ...sessions.map(
                        (MeditationSession session) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: SessionTile(
                            session: session,
                            category: _categoryOf(session),
                            locked: !subscription.canOpen(
                              isPremiumContent: _needsPremium(session),
                            ),
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
    );
  }
}
