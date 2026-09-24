import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/gradient_background.dart';
import '../../data/mock/mock_content.dart';
import '../../data/models/subscription_plan.dart';
import 'subscription_controller.dart';

/// Muro de pago: ventajas de premium y elección de plan.
class PaywallScreen extends StatefulWidget {
  const PaywallScreen({super.key});

  @override
  State<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends State<PaywallScreen> {
  /// Empezamos con el plan anual marcado: es el que más conviene al usuario
  /// y el que mejor funciona en este tipo de apps.
  late SubscriptionPlan _selected =
      context.read<SubscriptionController>().plans.first;

  Future<void> _subscribe() async {
    final SubscriptionController subscription =
        context.read<SubscriptionController>();
    final bool ok = await subscription.subscribe(_selected);
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(content: Text('¡Ya tienes Alma Serena Premium!')),
        );
      Navigator.of(context).pop();
    }
  }

  Future<void> _restore() async {
    final bool restored =
        await context.read<SubscriptionController>().restore();
    if (!mounted) return;
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
    if (restored) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final SubscriptionController subscription =
        context.watch<SubscriptionController>();

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          tooltip: 'Cerrar',
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ),
      body: GradientBackground(
        child: SafeArea(
          child: Column(
            children: <Widget>[
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 8),
                  children: <Widget>[
                    Center(
                      child: Container(
                        width: 96,
                        height: 96,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: AppColors.brandGradient,
                          boxShadow: <BoxShadow>[
                            BoxShadow(
                              color: AppColors.lilac.withValues(alpha: 0.35),
                              blurRadius: 34,
                              offset: const Offset(0, 16),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.auto_awesome_rounded,
                          color: Colors.white,
                          size: 40,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'Alma Serena Premium',
                      textAlign: TextAlign.center,
                      style: text.displaySmall,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Toda la biblioteca, sin límites, para cuidarte cada día.',
                      textAlign: TextAlign.center,
                      style: text.bodyLarge,
                    ),
                    const SizedBox(height: 28),

                    ...MockContent.premiumBenefits.map(
                      (String benefit) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Container(
                              width: 24,
                              height: 24,
                              decoration: const BoxDecoration(
                                color: AppColors.lilacMist,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.check_rounded,
                                size: 15,
                                color: AppColors.lilac,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(benefit, style: text.bodyMedium),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 22),

                    ...subscription.plans.map(
                      (SubscriptionPlan plan) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _PlanCard(
                          plan: plan,
                          selected: plan.id == _selected.id,
                          onTap: () => setState(() => _selected = plan),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // --- Botón de compra -----------------------------------------
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                child: Column(
                  children: <Widget>[
                    FilledButton(
                      onPressed: subscription.isProcessing ? null : _subscribe,
                      child: subscription.isProcessing
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Empezar 7 días gratis'),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Después ${_selected.price} · cancela cuando quieras',
                      textAlign: TextAlign.center,
                      style: text.bodySmall,
                    ),
                    TextButton(
                      onPressed:
                          subscription.isProcessing ? null : _restore,
                      child: const Text('Restaurar compra'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tarjeta de un plan (mensual o anual) con su marca de selección.
class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.selected,
    required this.onTap,
  });

  final SubscriptionPlan plan;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final BorderRadius radius = BorderRadius.circular(AppTheme.radius);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: radius,
            border: Border.all(
              color: selected ? AppColors.lilac : AppColors.lilacMist,
              width: selected ? 2 : 1,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: <Widget>[
                Icon(
                  selected
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_unchecked_rounded,
                  color: selected ? AppColors.lilac : AppColors.inkFaint,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Text(plan.title, style: text.titleMedium),
                          if (plan.highlight != null) ...<Widget>[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.goldSoft,
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: Text(
                                plan.highlight!,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.gold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(plan.priceDetail, style: text.bodySmall),
                    ],
                  ),
                ),
                Text(
                  plan.price,
                  style: text.titleLarge?.copyWith(
                    color: selected ? AppColors.lilac : AppColors.ink,
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
