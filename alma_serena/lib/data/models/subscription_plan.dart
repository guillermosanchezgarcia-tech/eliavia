import 'package:flutter/foundation.dart';

/// Periodicidad de cobro de un plan premium.
enum PlanPeriod { monthly, yearly }

/// Un plan de suscripción tal y como se muestra en el muro de pago.
///
/// TODO(pagos): los precios definitivos los devolverá Google Play Billing
/// (por ejemplo a través del paquete `in_app_purchase` o de RevenueCat), ya
/// convertidos a la moneda del usuario. Estos valores son solo de maqueta.
@immutable
class SubscriptionPlan {
  const SubscriptionPlan({
    required this.id,
    required this.period,
    required this.title,
    required this.price,
    required this.priceDetail,
    this.highlight,
  });

  final String id;
  final PlanPeriod period;
  final String title;

  /// Precio ya formateado, por ejemplo "7,99 €".
  final String price;

  /// Texto pequeno bajo el precio ("facturado cada mes").
  final String priceDetail;

  /// Etiqueta destacada opciónal ("Ahorras un 47 %").
  final String? highlight;
}
