import '../mock/mock_content.dart';
import '../models/subscription_plan.dart';
import '../services/local_storage.dart';

/// Estado de la suscripción premium.
///
/// Ahora mismo "suscribirse" solo escribe una marca en el teléfono, sin cobrar
/// nada. Sirve para probar el flujo completo del muro de pago.
///
/// TODO(pagos): conectar con Google Play Billing. La opción más sencilla es el
/// paquete `in_app_purchase` (oficial) o RevenueCat si prefieres no gestiónar
/// los recibos tú mismo. Habrá que:
///   1. Crear los productos "alma_mensual" y "alma_anual" en Play Console.
///   2. Sustituir `purchase()` por la compra real.
///   3. Comprobar el estado al arrancar con `restore()`.
class SubscriptionRepository {
  SubscriptionRepository(this._storage);

  final LocalStorage _storage;

  List<SubscriptionPlan> plans() => MockContent.plans;

  bool isPremium() => _storage.isPremium;

  String? activePlanId() => _storage.planId;

  Future<void> purchase(SubscriptionPlan plan) async {
    // Pequeña espera para imitar el diálogo de pago de Google Play.
    await Future<void>.delayed(const Duration(milliseconds: 900));
    await _storage.setPremium(true);
    await _storage.setPlanId(plan.id);
  }

  /// Restaurar compras: en la versión real preguntaría a Google Play.
  Future<bool> restore() async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    return _storage.isPremium;
  }

  Future<void> cancel() async {
    await _storage.setPremium(false);
    await _storage.setPlanId(null);
  }
}
