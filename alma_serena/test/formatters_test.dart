import 'package:alma_serena/core/utils/formatters.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting('es');
  });

  group('Formatters.clock', () {
    test('rellena con ceros a la izquierda', () {
      expect(Formatters.clock(const Duration(seconds: 5)), '00:05');
      expect(Formatters.clock(const Duration(minutes: 7, seconds: 24)), '07:24');
    });

    test('las horas se suman a los minutos', () {
      expect(Formatters.clock(const Duration(hours: 1, minutes: 5)), '65:00');
    });
  });

  group('Formatters.longDuration', () {
    test('menos de una hora', () {
      expect(Formatters.longDuration(const Duration(minutes: 45)), '45 min');
    });

    test('horas exactas', () {
      expect(Formatters.longDuration(const Duration(hours: 2)), '2 h');
    });

    test('horas y minutos', () {
      expect(
        Formatters.longDuration(const Duration(hours: 2, minutes: 15)),
        '2 h 15 min',
      );
    });
  });

  group('Formatters.relativeDate', () {
    final DateTime now = DateTime(2026, 3, 12);

    test('hoy y ayer', () {
      expect(Formatters.relativeDate(now, now: now), 'Hoy');
      expect(
        Formatters.relativeDate(now.subtract(const Duration(days: 1)), now: now),
        'Ayer',
      );
    });

    test('esta semana', () {
      expect(
        Formatters.relativeDate(now.subtract(const Duration(days: 4)), now: now),
        'Hace 4 días',
      );
    });

    test('más de una semana usa la fecha', () {
      expect(
        Formatters.relativeDate(DateTime(2026, 3, 1), now: now),
        '1 de marzo',
      );
    });
  });

  group('Formatters.greeting', () {
    test('cambia según la hora', () {
      expect(Formatters.greeting(DateTime(2026, 3, 12, 9)), 'Buenos días');
      expect(Formatters.greeting(DateTime(2026, 3, 12, 17)), 'Buenas tardes');
      expect(Formatters.greeting(DateTime(2026, 3, 12, 23)), 'Buenas noches');
      expect(Formatters.greeting(DateTime(2026, 3, 12, 3)), 'Buenas noches');
    });
  });
}
