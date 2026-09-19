import 'package:alma_serena/data/models/session_record.dart';
import 'package:alma_serena/data/repositories/progress_repository.dart';
import 'package:alma_serena/data/services/local_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Comprueba el cálculo de la racha, que es la regla de negocio con más
/// posibilidades de fallar.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ProgressRepository repository;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    repository = ProgressRepository(await LocalStorage.create());
  });

  Future<void> addSessionOn(DateTime date) {
    return repository.add(
      SessionRecord(
        sessionId: 'ans-01',
        title: 'Primeros auxilios para la ansiedad',
        categoryName: 'Ansiedad',
        completedAt: date,
        listened: const Duration(minutes: 8),
      ),
    );
  }

  test('sin historial la racha es cero', () {
    expect(repository.streak(), 0);
    expect(repository.totalSessions(), 0);
  });

  test('tres días seguidos hasta hoy cuentan tres', () async {
    final DateTime today = DateTime(2026, 3, 12, 8);
    await addSessionOn(today);
    await addSessionOn(today.subtract(const Duration(days: 1)));
    await addSessionOn(today.subtract(const Duration(days: 2)));

    expect(repository.streak(today), 3);
  });

  test('varias sesiones el mismo día cuentan como un solo día', () async {
    final DateTime today = DateTime(2026, 3, 12, 8);
    await addSessionOn(today);
    await addSessionOn(today.add(const Duration(hours: 6)));

    expect(repository.streak(today), 1);
    expect(repository.totalSessions(), 2);
  });

  test('la racha no se rompe si todavía no has meditado hoy', () async {
    final DateTime today = DateTime(2026, 3, 12, 8);
    await addSessionOn(today.subtract(const Duration(days: 1)));
    await addSessionOn(today.subtract(const Duration(days: 2)));

    expect(repository.streak(today), 2);
  });

  test('un hueco de dos días rompe la racha', () async {
    final DateTime today = DateTime(2026, 3, 12, 8);
    await addSessionOn(today.subtract(const Duration(days: 3)));
    await addSessionOn(today.subtract(const Duration(days: 4)));

    expect(repository.streak(today), 0);
  });

  test('los minutos de la semana suman solo los últimos siete días', () async {
    final DateTime today = DateTime(2026, 3, 12, 8);
    await addSessionOn(today);
    await addSessionOn(today.subtract(const Duration(days: 3)));
    await addSessionOn(today.subtract(const Duration(days: 20)));

    expect(repository.minutesThisWeek(today), 16);
    expect(repository.totalTime(), const Duration(minutes: 24));
  });
}
