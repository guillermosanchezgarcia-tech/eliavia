import 'package:intl/intl.dart';

/// Pequeñas funciones para mostrar tiempos y fechas en castellano.
class Formatters {
  const Formatters._();

  /// "07:24" — el cronómetro del reproductor.
  static String clock(Duration duration) {
    final int totalSeconds = duration.inSeconds.abs();
    final String minutes = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final String seconds = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  /// "8 min" — duración corta en tarjetas.
  static String minutes(Duration duration) => '${duration.inMinutes} min';

  /// "2 h 15 min" — tiempo acumulado en el perfil.
  static String longDuration(Duration duration) {
    final int hours = duration.inHours;
    final int mins = duration.inMinutes.remainder(60);
    if (hours == 0) return '$mins min';
    if (mins == 0) return '$hours h';
    return '$hours h $mins min';
  }

  /// "Hoy", "Ayer", "Hace 4 días" o "12 de marzo".
  static String relativeDate(DateTime date, {DateTime? now}) {
    final DateTime today = _dateOnly(now ?? DateTime.now());
    final int days = today.difference(_dateOnly(date)).inDays;
    if (days <= 0) return 'Hoy';
    if (days == 1) return 'Ayer';
    if (days < 7) return 'Hace $days días';
    return DateFormat("d 'de' MMMM", 'es').format(date);
  }

  /// "martes, 12 de marzo" — cabecera de la pantalla de inicio.
  static String longDate(DateTime date) =>
      DateFormat("EEEE, d 'de' MMMM", 'es').format(date);

  /// Saludo según la hora del día.
  static String greeting(DateTime now) {
    final int hour = now.hour;
    if (hour < 6) return 'Buenas noches';
    if (hour < 13) return 'Buenos días';
    if (hour < 21) return 'Buenas tardes';
    return 'Buenas noches';
  }

  static DateTime _dateOnly(DateTime date) =>
      DateTime(date.year, date.month, date.day);
}
