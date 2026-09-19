import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../data/models/meditation_session.dart';
import '../../features/paywall/subscription_controller.dart';
import 'app_router.dart';

/// Abre una sesión, o el muro de pago si hace falta suscripción.
///
/// Está aquí, en un único sitio, para que todas las pantallas se comporten
/// igual: da igual desde dónde se toque una sesión premium.
Future<void> openSession(
  BuildContext context,
  MeditationSession session, {
  bool categoryIsPremium = false,
}) async {
  final bool needsPremium = session.isPremium || categoryIsPremium;
  final SubscriptionController subscription =
      context.read<SubscriptionController>();

  if (subscription.canOpen(isPremiumContent: needsPremium)) {
    await Navigator.of(context).pushNamed(
      AppRoutes.player,
      arguments: session.id,
    );
    return;
  }

  await Navigator.of(context).pushNamed(AppRoutes.paywall);
}
