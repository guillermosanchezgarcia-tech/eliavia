import 'dart:convert';

import '../models/session_record.dart';
import '../services/local_storage.dart';

/// Historial de sesiónes escuchadas y cálculo de la racha.
///
/// TODO(backend): guardar cada registro también en
/// `users/{uid}/history/{id}` de Firestore para que la racha sobreviva a un
/// cambio de teléfono.
class ProgressRepository {
  ProgressRepository(this._storage);

  final LocalStorage _storage;

  /// Historial ordenado de más reciente a más antiguo.
  List<SessionRecord> history() {
    final List<SessionRecord> records = <SessionRecord>[];
    for (final String raw in _storage.history) {
      try {
        records.add(
          SessionRecord.fromMap(jsonDecode(raw) as Map<String, dynamic>),
        );
      } on FormatException {
        // Registro corrupto: lo ignoramos en lugar de romper la pantalla.
        continue;
      }
    }
    records.sort(
      (SessionRecord a, SessionRecord b) =>
          b.completedAt.compareTo(a.completedAt),
    );
    return records;
  }

  Future<void> add(SessionRecord record) async {
    final List<String> raw = <String>[
      ..._storage.history,
      jsonEncode(record.toMap()),
    ];
    // Nos quedamos con los últimos 200 registros para no llenar el teléfono.
    final List<String> trimmed = raw.length > 200
        ? raw.sublist(raw.length - 200)
        : raw;
    await _storage.setHistory(trimmed);
  }

  Future<void> clear() => _storage.setHistory(<String>[]);

  /// Días seguidos meditando. Cuenta hasta hoy o hasta ayer (para no romper
  /// la racha de alguien que aún no ha meditado hoy).
  int streak([DateTime? today]) {
    final List<DateTime> days = activeDays();
    if (days.isEmpty) return 0;

    final DateTime reference = _dateOnly(today ?? DateTime.now());
    final int gap = reference.difference(days.first).inDays;
    if (gap > 1) return 0;

    int streak = 1;
    for (int i = 0; i < days.length - 1; i++) {
      if (days[i].difference(days[i + 1]).inDays == 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  /// Días distintos con al menos una sesión, del más reciente al más antiguo.
  List<DateTime> activeDays() {
    final Set<DateTime> days = history()
        .map((SessionRecord r) => _dateOnly(r.completedAt))
        .toSet();
    final List<DateTime> sorted = days.toList()
      ..sort((DateTime a, DateTime b) => b.compareTo(a));
    return sorted;
  }

  int totalSessions() => history().length;

  Duration totalTime() {
    return history().fold(
      Duration.zero,
      (Duration sum, SessionRecord r) => sum + r.listened,
    );
  }

  /// Minutos escuchados en los últimos 7 días (incluido hoy).
  int minutesThisWeek([DateTime? today]) {
    final DateTime reference = _dateOnly(today ?? DateTime.now());
    final DateTime from = reference.subtract(const Duration(days: 6));
    return history()
            .where(
              (SessionRecord r) => !_dateOnly(r.completedAt).isBefore(from),
            )
            .fold(
              Duration.zero,
              (Duration sum, SessionRecord r) => sum + r.listened,
            )
            .inSeconds ~/
        60;
  }

  static DateTime _dateOnly(DateTime date) =>
      DateTime(date.year, date.month, date.day);
}
