import '../mock/mock_content.dart';
import '../models/meditation_category.dart';
import '../models/meditation_session.dart';

/// Acceso al catálogo de categorías y sesiónes.
///
/// Hoy devuelve los datos de `MockContent` de forma inmediata. Los métodos son
/// `Future` a propósito: así, cuando el contenido venga de un servidor, las
/// pantallas no tendrán que cambiar.
///
/// TODO(backend): reemplazar el cuerpo de cada método por una consulta a
/// Firestore (`FirebaseFirestore.instance.collection('categories')...`).
class ContentRepository {
  const ContentRepository();

  Future<List<MeditationCategory>> categories() async => MockContent.categories;

  Future<List<MeditationSession>> sessions() async => MockContent.sessions;

  Future<List<MeditationSession>> sessionsByCategory(String categoryId) async {
    return MockContent.sessions
        .where((MeditationSession s) => s.categoryId == categoryId)
        .toList();
  }

  MeditationCategory? categoryById(String id) {
    for (final MeditationCategory category in MockContent.categories) {
      if (category.id == id) return category;
    }
    return null;
  }

  MeditationSession? sessionById(String id) {
    for (final MeditationSession session in MockContent.sessions) {
      if (session.id == id) return session;
    }
    return null;
  }

  /// Sesión recomendada del día.
  ///
  /// Es la misma durante todo el día para todos los usuarios: elegimos según
  /// el número de día del año, así cambia cada mañana sin necesidad de
  /// servidor.
  ///
  /// Solo proponemos sesiones gratuitas: la recomendación del día tiene que
  /// poder escucharla cualquiera, también quien no tenga suscripción.
  Future<MeditationSession> sessionOfTheDay([DateTime? now]) async {
    final DateTime date = now ?? DateTime.now();
    final List<MeditationSession> pool = freeSessions();
    return pool[_dayOfYear(date) % pool.length];
  }

  /// Sesiones abiertas a todo el mundo (ni la sesión ni su categoría son
  /// premium).
  List<MeditationSession> freeSessions() {
    final List<MeditationSession> free = MockContent.sessions
        .where(
          (MeditationSession session) =>
              !session.isPremium &&
              !(categoryById(session.categoryId)?.isPremium ?? false),
        )
        .toList();
    // Si algún día todo el catálogo fuese premium, mejor devolver algo que
    // dejar la pantalla de inicio vacía.
    return free.isEmpty ? MockContent.sessions : free;
  }

  /// Frase de bienvenida del día, elegida igual que la sesión recomendada.
  String quoteOfTheDay([DateTime? now]) {
    final DateTime date = now ?? DateTime.now();
    return MockContent.dailyQuotes[_dayOfYear(date) %
        MockContent.dailyQuotes.length];
  }

  static int _dayOfYear(DateTime date) {
    return date.difference(DateTime(date.year)).inDays;
  }
}
