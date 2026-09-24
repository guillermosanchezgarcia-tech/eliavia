import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/gradient_background.dart';
import '../../data/models/meditation_category.dart';
import '../../data/models/meditation_session.dart';
import '../../data/repositories/content_repository.dart';
import '../../data/services/audio_service.dart';
import '../../data/services/local_storage.dart';
import '../profile/progress_controller.dart';
import 'player_controller.dart';
import 'widgets/progress_ring.dart';

/// Reproductor de una sesión: cronómetro, play/pausa y sonido de fondo.
class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  PlayerController? _player;
  MeditationSession? _session;
  MeditationCategory? _category;

  /// Evita apuntar dos veces la misma sesión en el historial.
  bool _registered = false;

  /// Evita que el aviso de "sesión completada" salga más de una vez.
  bool _completedDialogShown = false;

  @override
  void initState() {
    super.initState();
    _prepare();
  }

  void _prepare() {
    final ContentRepository content = context.read<ContentRepository>();
    final MeditationSession? session = content.sessionById(widget.sessionId);
    if (session == null) return;

    // Recuperamos el sonido de fondo que eligió la última vez.
    final BackgroundSound savedSound = BackgroundSound.fromName(
      context.read<LocalStorage>().backgroundSound,
    );

    final PlayerController player = PlayerController(
      audio: context.read<AudioService>(),
      session: session,
      initialBackgroundSound: savedSound,
    )..addListener(_onPlayerChanged);

    setState(() {
      _session = session;
      _category = content.categoryById(session.categoryId);
      _player = player;
    });
  }

  void _onPlayerChanged() {
    final PlayerController? player = _player;
    if (player != null && player.isCompleted && !_completedDialogShown) {
      _completedDialogShown = true;
      _registerProgress();
      _showCompletedDialog();
    }
  }

  Future<void> _registerProgress() async {
    final PlayerController? player = _player;
    final MeditationSession? session = _session;
    if (player == null || session == null || _registered) return;

    // Solo cuenta si ha escuchado al menos un minuto.
    if (player.position < const Duration(minutes: 1)) return;

    _registered = true;
    await context.read<ProgressController>().registerSession(
      session: session,
      categoryName: _category?.name ?? '',
      listened: player.position,
    );
  }

  Future<void> _showCompletedDialog() async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
        title: const Text('Sesión completada'),
        content: const Text(
          'Ya está. Tómate unos segundos antes de volver a lo de fuera.',
        ),
        actions: <Widget>[
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Gracias'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    Navigator.of(context).maybePop();
  }

  Future<void> _openBackgroundSoundPicker() async {
    final PlayerController? player = _player;
    if (player == null) return;

    final BackgroundSound? choice = await showModalBottomSheet<BackgroundSound>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (BuildContext context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              const SizedBox(height: 18),
              Text(
                'Sonido de fondo',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  'Se mezclará con la voz de la sesión.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              const SizedBox(height: 10),
              ...BackgroundSound.values.map(
                (BackgroundSound sound) => ListTile(
                  leading: Icon(sound.icon, color: AppColors.lilac),
                  title: Text(sound.label),
                  trailing: sound == player.backgroundSound
                      ? const Icon(
                          Icons.check_rounded,
                          color: AppColors.lilac,
                        )
                      : null,
                  onTap: () => Navigator.of(context).pop(sound),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );

    if (choice != null) {
      await player.setBackgroundSound(choice);
      if (!mounted) return;
      // TODO(audio): quitar este aviso cuando los sonidos de fondo suenen.
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(
              choice == BackgroundSound.none
                  ? 'Sonido de fondo desactivado.'
                  : 'Sonido de fondo: ${choice.label.toLowerCase()}.',
            ),
          ),
        );
      // Recordamos la elección para la próxima sesión.
      await context.read<LocalStorage>().setBackgroundSound(choice.name);
    }
  }

  @override
  void dispose() {
    _player?.removeListener(_onPlayerChanged);
    _player?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final MeditationSession? session = _session;
    final PlayerController? player = _player;

    if (session == null || player == null) {
      return const Scaffold(
        body: Center(child: Text('No hemos encontrado esta sesión.')),
      );
    }

    final Color color = _category?.color ?? AppColors.lilac;

    return PopScope(
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (didPop) _registerProgress();
      },
      child: Scaffold(
        extendBodyBehindAppBar: true,
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 30),
            tooltip: 'Cerrar',
            onPressed: () => Navigator.of(context).maybePop(),
          ),
          title: Text(_category?.name ?? ''),
        ),
        body: GradientBackground(
          child: SafeArea(
            child: ListenableBuilder(
              listenable: player,
              builder: (BuildContext context, _) {
                return Padding(
                  padding: const EdgeInsets.fromLTRB(28, 10, 28, 24),
                  child: Column(
                    children: <Widget>[
                      const Spacer(),

                      // --- Círculo con el cronómetro ---------------------
                      ProgressRing(
                        progress: player.progress,
                        color: color,
                        child: Container(
                          width: 210,
                          height: 210,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: AppColors.softGradient(color),
                            boxShadow: <BoxShadow>[
                              BoxShadow(
                                color: color.withValues(alpha: 0.30),
                                blurRadius: 40,
                                offset: const Offset(0, 18),
                              ),
                            ],
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: <Widget>[
                              Text(
                                Formatters.clock(player.position),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 42,
                                  fontWeight: FontWeight.w300,
                                  letterSpacing: 1,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'quedan ${Formatters.clock(player.remaining)}',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.85),
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 36),
                      Text(
                        session.title,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Con ${session.narrator}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),

                      const SizedBox(height: 22),

                      // --- Barra para moverse por la sesión --------------
                      SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          trackHeight: 3,
                          activeTrackColor: color,
                          inactiveTrackColor: AppColors.lilacMist,
                          thumbColor: color,
                          overlayShape: const RoundSliderOverlayShape(
                            overlayRadius: 16,
                          ),
                          thumbShape: const RoundSliderThumbShape(
                            enabledThumbRadius: 7,
                          ),
                        ),
                        child: Slider(
                          value: player.position.inSeconds
                              .clamp(0, session.duration.inSeconds)
                              .toDouble(),
                          max: session.duration.inSeconds.toDouble(),
                          onChanged: (double value) => player.seek(
                            Duration(seconds: value.round()),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: <Widget>[
                            Text(
                              Formatters.clock(player.position),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            Text(
                              Formatters.clock(session.duration),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 18),

                      // --- Controles --------------------------------------
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                          _RoundIconButton(
                            icon: Icons.replay_10_rounded,
                            tooltip: 'Atrás 10 segundos',
                            onPressed: () => player.skip(
                              const Duration(seconds: -10),
                            ),
                          ),
                          const SizedBox(width: 26),
                          _PlayButton(
                            isPlaying: player.isPlaying,
                            color: color,
                            onPressed: player.togglePlay,
                          ),
                          const SizedBox(width: 26),
                          _RoundIconButton(
                            icon: Icons.forward_10_rounded,
                            tooltip: 'Adelante 10 segundos',
                            onPressed: () => player.skip(
                              const Duration(seconds: 10),
                            ),
                          ),
                        ],
                      ),

                      const Spacer(),

                      // --- Sonido de fondo --------------------------------
                      TextButton.icon(
                        onPressed: _openBackgroundSoundPicker,
                        icon: Icon(player.backgroundSound.icon, size: 20),
                        label: Text(
                          player.backgroundSound == BackgroundSound.none
                              ? 'Añadir sonido de fondo'
                              : 'Fondo: ${player.backgroundSound.label}',
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// Botón redondo grande de play/pausa.
class _PlayButton extends StatelessWidget {
  const _PlayButton({
    required this.isPlaying,
    required this.color,
    required this.onPressed,
  });

  final bool isPlaying;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: isPlaying ? 'Pausar' : 'Reproducir',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          customBorder: const CircleBorder(),
          child: Ink(
            width: 78,
            height: 78,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: AppColors.brandGradient,
              boxShadow: <BoxShadow>[
                BoxShadow(
                  color: color.withValues(alpha: 0.38),
                  blurRadius: 26,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Icon(
              isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
              color: Colors.white,
              size: 38,
            ),
          ),
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      tooltip: tooltip,
      iconSize: 26,
      color: AppColors.inkSoft,
      style: IconButton.styleFrom(
        backgroundColor: Colors.white,
        padding: const EdgeInsets.all(14),
      ),
      icon: Icon(icon),
    );
  }
}
