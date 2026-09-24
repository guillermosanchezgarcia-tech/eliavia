import 'package:alma_serena/data/models/meditation_session.dart';
import 'package:alma_serena/data/repositories/content_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const ContentRepository content = ContentRepository();

  test('la sesión del día siempre es gratuita', () async {
    // Recorremos un año entero: ningún día puede proponer contenido de pago.
    for (int day = 0; day < 366; day++) {
      final DateTime date = DateTime(2026).add(Duration(days: day));
      final MeditationSession session = await content.sessionOfTheDay(date);

      expect(session.isPremium, isFalse, reason: 'día $day');
      expect(
        content.categoryById(session.categoryId)?.isPremium,
        isFalse,
        reason: 'día $day',
      );
    }
  });

  test('la sesión del día cambia de un día para otro', () async {
    final MeditationSession today = await content.sessionOfTheDay(
      DateTime(2026, 3, 12),
    );
    final MeditationSession tomorrow = await content.sessionOfTheDay(
      DateTime(2026, 3, 13),
    );

    expect(today.id, isNot(tomorrow.id));
  });

  test('todas las sesiones pertenecen a una categoría existente', () async {
    for (final MeditationSession session in await content.sessions()) {
      expect(
        content.categoryById(session.categoryId),
        isNotNull,
        reason: session.id,
      );
    }
  });

  test('la frase del día es estable dentro del mismo día', () {
    expect(
      content.quoteOfTheDay(DateTime(2026, 3, 12, 8)),
      content.quoteOfTheDay(DateTime(2026, 3, 12, 23)),
    );
  });
}
