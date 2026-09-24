import 'package:flutter/foundation.dart';

import '../../data/models/meditation_session.dart';
import '../../data/models/session_record.dart';
import '../../data/repositories/progress_repository.dart';

/// Racha, historial y minutos escuchados.
class ProgressController extends ChangeNotifier {
  ProgressController(this._repository) {
    _load();
  }

  final ProgressRepository _repository;

  List<SessionRecord> _history = <SessionRecord>[];
  int _streak = 0;
  int _minutesThisWeek = 0;
  Duration _totalTime = Duration.zero;

  List<SessionRecord> get history => List<SessionRecord>.unmodifiable(_history);
  int get streak => _streak;
  int get totalSessions => _history.length;
  int get minutesThisWeek => _minutesThisWeek;
  Duration get totalTime => _totalTime;

  /// Días de la última semana (de lunes a domingo) en los que hubo sesión.
  /// Se usa para pintar la tira de 7 puntos del perfil.
  List<bool> weekActivity([DateTime? today]) {
    final DateTime reference = _dateOnly(today ?? DateTime.now());
    final DateTime monday = reference.subtract(
      Duration(days: reference.weekday - 1),
    );
    final Set<DateTime> active = _repository.activeDays().toSet();
    return List<bool>.generate(
      7,
      (int i) => active.contains(monday.add(Duration(days: i))),
    );
  }

  Future<void> registerSession({
    required MeditationSession session,
    required String categoryName,
    required Duration listened,
  }) async {
    await _repository.add(
      SessionRecord(
        sessionId: session.id,
        title: session.title,
        categoryName: categoryName,
        completedAt: DateTime.now(),
        listened: listened,
      ),
    );
    _load();
  }

  Future<void> clearHistory() async {
    await _repository.clear();
    _load();
  }

  void _load() {
    _history = _repository.history();
    _streak = _repository.streak();
    _minutesThisWeek = _repository.minutesThisWeek();
    _totalTime = _repository.totalTime();
    notifyListeners();
  }

  static DateTime _dateOnly(DateTime date) =>
      DateTime(date.year, date.month, date.day);
}
