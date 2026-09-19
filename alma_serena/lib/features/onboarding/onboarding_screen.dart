import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/gradient_background.dart';
import 'onboarding_controller.dart';

/// Presentación inicial de Alma Serena: tres pantallas que se pasan
/// deslizando el dedo.
///
/// Esta pantalla marca el estilo visual del resto de la app: fondo en
/// degradado, tarjetas circulares con halos de color, títulos finos y textos
/// con mucho aire.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with SingleTickerProviderStateMixin {
  final PageController _pageController = PageController();
  late final AnimationController _breathController;
  int _page = 0;

  /// Contenido de los tres pasos.
  static const List<_OnboardingSlide> _slides = <_OnboardingSlide>[
    _OnboardingSlide(
      icon: Icons.self_improvement_rounded,
      title: 'Respira, estás en casa',
      body:
          'Unos minutos al día bastan para bajar el ruido y reencontrarte con '
          'la calma. Sin prisa y sin hacerlo bien o mal.',
      colors: <Color>[AppColors.lilac, AppColors.lilacSoft],
    ),
    _OnboardingSlide(
      icon: Icons.nightlight_round,
      title: 'Duerme mejor',
      body:
          'Sesiones suaves para soltar el día, aflojar el cuerpo y dejar que '
          'el sueño llegue solo.',
      colors: <Color>[AppColors.nightIndigo, AppColors.blueSoft],
    ),
    _OnboardingSlide(
      icon: Icons.auto_awesome_rounded,
      title: 'Tu ritmo, tu progreso',
      body:
          'Cada sesión suma a tu racha. Verás crecer tu constancia sin metas '
          'imposibles ni culpa por los días que fallas.',
      colors: <Color>[AppColors.blue, AppColors.breathAqua],
    ),
  ];

  bool get _isLastPage => _page == _slides.length - 1;

  @override
  void initState() {
    super.initState();
    // Animación muy lenta que hace "respirar" al círculo de cada slide.
    _breathController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 6),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pageController.dispose();
    _breathController.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await context.read<OnboardingController>().complete();
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(AppRoutes.login);
  }

  void _next() {
    if (_isLastPage) {
      _finish();
      return;
    }
    _pageController.nextPage(
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;

    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          child: Column(
            children: <Widget>[
              // Botón de saltar, arriba a la derecha.
              Align(
                alignment: Alignment.centerRight,
                child: Padding(
                  padding: const EdgeInsets.only(right: 12, top: 8),
                  child: AnimatedOpacity(
                    duration: const Duration(milliseconds: 250),
                    opacity: _isLastPage ? 0 : 1,
                    child: IgnorePointer(
                      ignoring: _isLastPage,
                      child: TextButton(
                        onPressed: _finish,
                        child: const Text('Saltar'),
                      ),
                    ),
                  ),
                ),
              ),

              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: _slides.length,
                  onPageChanged: (int index) => setState(() => _page = index),
                  itemBuilder: (BuildContext context, int index) {
                    final _OnboardingSlide slide = _slides[index];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                          _BreathingCircle(
                            animation: _breathController,
                            icon: slide.icon,
                            colors: slide.colors,
                          ),
                          const SizedBox(height: 48),
                          Text(
                            slide.title,
                            textAlign: TextAlign.center,
                            style: text.displaySmall,
                          ),
                          const SizedBox(height: 18),
                          Text(
                            slide.body,
                            textAlign: TextAlign.center,
                            style: text.bodyLarge,
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),

              // Puntos de posición.
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List<Widget>.generate(
                  _slides.length,
                  (int index) => AnimatedContainer(
                    duration: const Duration(milliseconds: 280),
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    height: 8,
                    width: index == _page ? 26 : 8,
                    decoration: BoxDecoration(
                      color: index == _page
                          ? AppColors.lilac
                          : AppColors.lilacSoft.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 32),
              Padding(
                padding: const EdgeInsets.fromLTRB(32, 0, 32, 20),
                child: FilledButton(
                  onPressed: _next,
                  child: Text(_isLastPage ? 'Empezar' : 'Siguiente'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Los datos de una de las tres pantallas.
class _OnboardingSlide {
  const _OnboardingSlide({
    required this.icon,
    required this.title,
    required this.body,
    required this.colors,
  });

  final IconData icon;
  final String title;
  final String body;
  final List<Color> colors;
}

/// Círculo con anillos concéntricos que crece y decrece muy despacio,
/// como una respiración.
class _BreathingCircle extends StatelessWidget {
  const _BreathingCircle({
    required this.animation,
    required this.icon,
    required this.colors,
  });

  final Animation<double> animation;
  final IconData icon;
  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (BuildContext context, Widget? child) {
        final double t = Curves.easeInOut.transform(animation.value);
        return Transform.scale(scale: 0.96 + (t * 0.08), child: child);
      },
      child: SizedBox(
        width: 240,
        height: 240,
        child: Stack(
          alignment: Alignment.center,
          children: <Widget>[
            _ring(240, colors.first.withValues(alpha: 0.10)),
            _ring(190, colors.first.withValues(alpha: 0.16)),
            Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: colors,
                ),
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: colors.first.withValues(alpha: 0.35),
                    blurRadius: 40,
                    offset: const Offset(0, 16),
                  ),
                ],
              ),
              child: Icon(icon, size: 58, color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }

  Widget _ring(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: color),
    );
  }
}
