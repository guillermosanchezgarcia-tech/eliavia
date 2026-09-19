import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/gradient_background.dart';
import '../../core/widgets/soft_card.dart';
import '../../data/services/local_storage.dart';
import '../auth/auth_controller.dart';
import '../onboarding/onboarding_controller.dart';
import '../paywall/subscription_controller.dart';
import 'progress_controller.dart';

/// Ajustes de la cuenta y de la app.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late bool _reminder = context.read<LocalStorage>().dailyReminder;

  Future<void> _setReminder(bool value) async {
    await context.read<LocalStorage>().setDailyReminder(value);
    if (!mounted) return;
    setState(() => _reminder = value);
    // TODO(notificaciones): programar el aviso diario de verdad con el
    // paquete `flutter_local_notifications` (y pedir permiso en Android 13+).
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(
            value
                ? 'Te avisaremos cada día cuando activemos las notificaciones.'
                : 'Recordatorio desactivado.',
          ),
        ),
      );
  }

  Future<bool> _confirm({
    required String title,
    required String message,
    required String confirmLabel,
  }) async {
    final bool? answer = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
        ),
        title: Text(title),
        content: Text(message),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    return answer ?? false;
  }

  Future<void> _signOut() async {
    final bool ok = await _confirm(
      title: 'Cerrar sesión',
      message: 'Podrás volver a entrar con tu correo y tu contraseña.',
      confirmLabel: 'Cerrar sesión',
    );
    if (!ok || !mounted) return;
    await context.read<AuthController>().signOut();
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoutes.login,
      (Route<dynamic> route) => false,
    );
  }

  Future<void> _clearHistory() async {
    final bool ok = await _confirm(
      title: 'Borrar historial',
      message:
          'Se borrarán tus sesiones guardadas y tu racha volverá a empezar.',
      confirmLabel: 'Borrar',
    );
    if (!ok || !mounted) return;
    await context.read<ProgressController>().clearHistory();
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('Historial borrado.')));
  }

  Future<void> _cancelSubscription() async {
    final bool ok = await _confirm(
      title: 'Cancelar premium',
      message:
          'Seguirás teniendo acceso a las sesiones gratuitas. '
          '(En la versión final esto te llevará a Google Play.)',
      confirmLabel: 'Cancelar premium',
    );
    if (!ok || !mounted) return;
    // TODO(pagos): la cancelación real se hace desde la ficha de Google Play;
    // aquí solo habría que abrir ese enlace.
    await context.read<SubscriptionController>().cancel();
  }

  Future<void> _replayOnboarding() async {
    await context.read<OnboardingController>().reset();
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoutes.onboarding,
      (Route<dynamic> route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final SubscriptionController subscription =
        context.watch<SubscriptionController>();

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(title: const Text('Ajustes')),
      body: GradientBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: <Widget>[
              _SettingsGroup(
                title: 'Práctica',
                children: <Widget>[
                  SwitchListTile(
                    value: _reminder,
                    onChanged: _setReminder,
                    activeThumbColor: AppColors.lilac,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Recordatorio diario'),
                    subtitle: const Text('Un aviso suave cada día'),
                  ),
                  _SettingsTile(
                    icon: Icons.replay_rounded,
                    title: 'Ver la introducción otra vez',
                    onTap: _replayOnboarding,
                  ),
                  _SettingsTile(
                    icon: Icons.delete_outline_rounded,
                    title: 'Borrar historial y racha',
                    onTap: _clearHistory,
                  ),
                ],
              ),
              const SizedBox(height: 16),

              _SettingsGroup(
                title: 'Suscripción',
                children: <Widget>[
                  if (subscription.isPremium)
                    _SettingsTile(
                      icon: Icons.workspace_premium_outlined,
                      title: 'Cancelar premium',
                      subtitle:
                          'Plan ${subscription.activePlan?.title.toLowerCase() ?? 'activo'}',
                      onTap: _cancelSubscription,
                    )
                  else
                    _SettingsTile(
                      icon: Icons.auto_awesome_rounded,
                      title: 'Hazte premium',
                      subtitle: 'Todas las sesiones y descargas',
                      onTap: () =>
                          Navigator.of(context).pushNamed(AppRoutes.paywall),
                    ),
                  _SettingsTile(
                    icon: Icons.restore_rounded,
                    title: 'Restaurar compra',
                    onTap: () async {
                      final bool restored = await context
                          .read<SubscriptionController>()
                          .restore();
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context)
                        ..hideCurrentSnackBar()
                        ..showSnackBar(
                          SnackBar(
                            content: Text(
                              restored
                                  ? 'Hemos recuperado tu suscripción.'
                                  : 'No hay ninguna compra que restaurar.',
                            ),
                          ),
                        );
                    },
                  ),
                ],
              ),
              const SizedBox(height: 16),

              _SettingsGroup(
                title: 'Cuenta',
                children: <Widget>[
                  _SettingsTile(
                    icon: Icons.logout_rounded,
                    title: 'Cerrar sesión',
                    onTap: _signOut,
                  ),
                ],
              ),
              const SizedBox(height: 26),

              Center(
                child: Text(
                  'Alma Serena · versión 1.0.0',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.only(left: 6, bottom: 10),
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
        SoftCard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Column(children: children),
        ),
      ],
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: AppColors.lilac),
      title: Text(title),
      subtitle: subtitle == null ? null : Text(subtitle!),
      trailing: const Icon(
        Icons.chevron_right_rounded,
        color: AppColors.inkFaint,
      ),
      onTap: onTap,
    );
  }
}
