import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../models/meditation_category.dart';
import '../models/meditation_session.dart';
import '../models/subscription_plan.dart';

/// Contenido de ejemplo de Alma Serena.
///
/// Todo lo que ve el usuario (categorías, sesiónes y planes) sale de aquí.
/// TODO(backend): sustituir este fichero por llamadas a Firestore. La forma de
/// los datos ya coincide con las colecciónes previstas:
///   categories/{id}, categories/{id}/sessions/{id}, plans/{id}.
class MockContent {
  const MockContent._();

  static const List<MeditationCategory> categories = <MeditationCategory>[
    MeditationCategory(
      id: 'ansiedad',
      name: 'Ansiedad',
      tagline: 'Baja el ruido de la mente',
      icon: Icons.spa_outlined,
      color: AppColors.calmTeal,
    ),
    MeditationCategory(
      id: 'sueno',
      name: 'Sueño',
      tagline: 'Suelta el día y descansa',
      icon: Icons.nightlight_round,
      color: AppColors.nightIndigo,
    ),
    MeditationCategory(
      id: 'enfoque',
      name: 'Enfoque',
      tagline: 'Una sola cosa a la vez',
      icon: Icons.center_focus_weak_outlined,
      color: AppColors.focusPeriwinkle,
    ),
    MeditationCategory(
      id: 'respiracion',
      name: 'Respiración',
      tagline: 'Vuelve al cuerpo en 5 minutos',
      icon: Icons.air_rounded,
      color: AppColors.breathAqua,
    ),
    MeditationCategory(
      id: 'autoestima',
      name: 'Autoestima',
      tagline: 'Hablarte con amabilidad',
      icon: Icons.favorite_outline_rounded,
      color: AppColors.lilac,
      isPremium: true,
    ),
    MeditationCategory(
      id: 'gratitud',
      name: 'Gratitud',
      tagline: 'Cerrar el día en positivo',
      icon: Icons.wb_twilight_rounded,
      color: AppColors.blue,
      isPremium: true,
    ),
  ];

  static const List<MeditationSession> sessions = <MeditationSession>[
    // --- Ansiedad ----------------------------------------------------------
    MeditationSession(
      id: 'ans-01',
      categoryId: 'ansiedad',
      title: 'Primeros auxilios para la ansiedad',
      description:
          'Una práctica breve para cuando el pecho se aprieta y la cabeza va '
          'demasiado rápido. Solo tienes que seguir la voz.',
      duration: Duration(minutes: 8),
      narrator: 'Lucía Marín',
    ),
    MeditationSession(
      id: 'ans-02',
      categoryId: 'ansiedad',
      title: 'Soltar la tensión del cuerpo',
      description:
          'Recorrido tranquilo por el cuerpo, de la cabeza a los pies, '
          'aflojando lo que se haya quedado en tensión.',
      duration: Duration(minutes: 15),
      narrator: 'Lucía Marín',
    ),
    MeditationSession(
      id: 'ans-03',
      categoryId: 'ansiedad',
      title: 'Cuando la mente no para',
      description:
          'Aprende a mirar los pensamientos sin subirte a ellos, como quien ve '
          'pasar nubes.',
      duration: Duration(minutes: 20),
      narrator: 'Diego Ferrer',
      isPremium: true,
    ),

    // --- Sueño -------------------------------------------------------------
    MeditationSession(
      id: 'sue-01',
      categoryId: 'sueno',
      title: 'Preparar el descanso',
      description:
          'Diez minutos para bajar revoluciones antes de meterte en la cama.',
      duration: Duration(minutes: 10),
      narrator: 'Elena Ruiz',
    ),
    MeditationSession(
      id: 'sue-02',
      categoryId: 'sueno',
      title: 'Nana para adultos',
      description:
          'Voz muy suave y silencios largos para acompañarte hasta que te '
          'quedes dormido.',
      duration: Duration(minutes: 25),
      narrator: 'Elena Ruiz',
      isPremium: true,
    ),
    MeditationSession(
      id: 'sue-03',
      categoryId: 'sueno',
      title: 'Si te despiertas de madrugada',
      description:
          'Práctica corta para volver a dormirte sin pelearte con el reloj.',
      duration: Duration(minutes: 12),
      narrator: 'Diego Ferrer',
      isPremium: true,
    ),

    // --- Enfoque -----------------------------------------------------------
    MeditationSession(
      id: 'enf-01',
      categoryId: 'enfoque',
      title: 'Empezar el día con claridad',
      description:
          'Ordena la cabeza antes de abrir el correo. Ideal nada más '
          'levantarte.',
      duration: Duration(minutes: 7),
      narrator: 'Diego Ferrer',
    ),
    MeditationSession(
      id: 'enf-02',
      categoryId: 'enfoque',
      title: 'Pausa entre tareas',
      description:
          'Cinco minutos para cerrar una cosa antes de empezar la siguiente.',
      duration: Duration(minutes: 5),
      narrator: 'Lucía Marín',
    ),
    MeditationSession(
      id: 'enf-03',
      categoryId: 'enfoque',
      title: 'Concentración profunda',
      description:
          'Práctica larga para entrenar la atención sostenida, pensada para '
          'estudiar o trabajar después.',
      duration: Duration(minutes: 18),
      narrator: 'Diego Ferrer',
      isPremium: true,
    ),

    // --- Respiración -------------------------------------------------------
    MeditationSession(
      id: 'res-01',
      categoryId: 'respiracion',
      title: 'Respiración 4-7-8',
      description:
          'Inspira en cuatro tiempos, retén siete, suelta en ocho. El clásico '
          'para calmarse rápido.',
      duration: Duration(minutes: 6),
      narrator: 'Elena Ruiz',
    ),
    MeditationSession(
      id: 'res-02',
      categoryId: 'respiracion',
      title: 'Respiración cuadrada',
      description:
          'Cuatro tiempos iguales que ordenan la respiración y, de paso, la '
          'cabeza.',
      duration: Duration(minutes: 9),
      narrator: 'Lucía Marín',
    ),
    MeditationSession(
      id: 'res-03',
      categoryId: 'respiracion',
      title: 'Respirar antes de hablar en público',
      description:
          'Para los minutos previos a una reunión, un examen o una entrevista.',
      duration: Duration(minutes: 11),
      narrator: 'Diego Ferrer',
      isPremium: true,
    ),

    // --- Autoestima (categoría premium) ------------------------------------
    MeditationSession(
      id: 'aut-01',
      categoryId: 'autoestima',
      title: 'Hablarte como a un amigo',
      description:
          'Práctica de autocompasión para los días en los que te exiges de '
          'más.',
      duration: Duration(minutes: 14),
      narrator: 'Lucía Marín',
      isPremium: true,
    ),
    MeditationSession(
      id: 'aut-02',
      categoryId: 'autoestima',
      title: 'Soltar la comparación',
      description:
          'Volver a tu propio ritmo cuando las vidas de los demás pesan '
          'demasiado.',
      duration: Duration(minutes: 16),
      narrator: 'Elena Ruiz',
      isPremium: true,
    ),

    // --- Gratitud (categoría premium) --------------------------------------
    MeditationSession(
      id: 'gra-01',
      categoryId: 'gratitud',
      title: 'Tres cosas buenas',
      description:
          'Un repaso amable del día antes de dormir, buscando lo que sí '
          'funcionó.',
      duration: Duration(minutes: 10),
      narrator: 'Elena Ruiz',
      isPremium: true,
    ),
    MeditationSession(
      id: 'gra-02',
      categoryId: 'gratitud',
      title: 'Gratitud por el cuerpo',
      description:
          'Reconciliarte con un cuerpo que lleva todo el día sosteniéndote.',
      duration: Duration(minutes: 13),
      narrator: 'Diego Ferrer',
      isPremium: true,
    ),
  ];

  /// Planes del muro de pago.
  static const List<SubscriptionPlan> plans = <SubscriptionPlan>[
    SubscriptionPlan(
      id: 'anual',
      period: PlanPeriod.yearly,
      title: 'Anual',
      price: '49,99 €',
      priceDetail: 'Equivale a 4,16 € al mes',
      highlight: 'Ahorras un 47 %',
    ),
    SubscriptionPlan(
      id: 'mensual',
      period: PlanPeriod.monthly,
      title: 'Mensual',
      price: '7,99 €',
      priceDetail: 'Facturado cada mes',
    ),
  ];

  /// Ventajas que se listan en el muro de pago.
  static const List<String> premiumBenefits = <String>[
    'Más de 200 sesiones guiadas en español',
    'Todas las categorías, incluidas Autoestima y Gratitud',
    'Descargas para escuchar sin conexión',
    'Sonidos de fondo y sesiones largas para dormir',
    'Sesiones nuevas cada semana',
  ];

  /// Frases de bienvenida que rotan en la pantalla de inicio.
  static const List<String> dailyQuotes = <String>[
    'Respira. Ya estás donde tienes que estar.',
    'No hace falta vaciar la mente, solo dejar de perseguirla.',
    'Un minuto de calma también cuenta.',
    'Lo que hoy pesa, mañana se mira distinto.',
    'Tu único objetivo ahora es estar aquí.',
    'La calma no se busca, se permite.',
    'Empieza de nuevo tantas veces como haga falta.',
  ];
}
