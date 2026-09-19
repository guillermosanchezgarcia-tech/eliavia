import 'package:flutter/foundation.dart';

import '../../data/models/subscription_plan.dart';
import '../../data/repositories/subscription_repository.dart';

/// Única fuente de verdad sobre si el usuario tiene premium.
class SubscriptionController extends ChangeNotifier {
  SubscriptionController(this._repository)
    : _isPremium = _repository.isPremium(),
      _activePlanId = _repository.activePlanId();

  final SubscriptionRepository _repository;

  bool _isPremium;
  String? _activePlanId;
  bool _isProcessing = false;

  bool get isPremium => _isPremium;
  bool get isProcessing => _isProcessing;
  String? get activePlanId => _activePlanId;
  List<SubscriptionPlan> get plans => _repository.plans();

  SubscriptionPlan? get activePlan {
    for (final SubscriptionPlan plan in plans) {
      if (plan.id == _activePlanId) return plan;
    }
    return null;
  }

  /// `true` si esta sesión o categoría se puede abrir con la cuenta actual.
  bool canOpen({required bool isPremiumContent}) =>
      _isPremium || !isPremiumContent;

  Future<bool> subscribe(SubscriptionPlan plan) async {
    _isProcessing = true;
    notifyListeners();
    try {
      await _repository.purchase(plan);
      _isPremium = true;
      _activePlanId = plan.id;
      return true;
    } finally {
      _isProcessing = false;
      notifyListeners();
    }
  }

  Future<bool> restore() async {
    _isProcessing = true;
    notifyListeners();
    try {
      _isPremium = await _repository.restore();
      _activePlanId = _repository.activePlanId();
      return _isPremium;
    } finally {
      _isProcessing = false;
      notifyListeners();
    }
  }

  Future<void> cancel() async {
    await _repository.cancel();
    _isPremium = false;
    _activePlanId = null;
    notifyListeners();
  }
}
