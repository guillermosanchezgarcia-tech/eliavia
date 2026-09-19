import 'package:flutter/material.dart';

/// Paleta de Alma Serena: lilas y azules suaves sobre fondos muy claros.
///
/// Todos los colores de la app salen de aquí. Si algún día quieres cambiar el
/// aspecto de la aplicación entera, este es el único fichero que hay que tocar.
class AppColors {
  const AppColors._();

  // --- Colores principales -------------------------------------------------
  static const Color lilac = Color(0xFF8E7CD8);
  static const Color lilacSoft = Color(0xFFB9ADEC);
  static const Color lilacMist = Color(0xFFEDE8FB);

  static const Color blue = Color(0xFF6C8FD6);
  static const Color blueSoft = Color(0xFFA6C2EE);
  static const Color blueMist = Color(0xFFE6EEFB);

  // --- Texto ---------------------------------------------------------------
  static const Color ink = Color(0xFF2E2A4A);
  static const Color inkSoft = Color(0xFF6E6A8A);
  static const Color inkFaint = Color(0xFF9E9AB4);

  // --- Superficies ---------------------------------------------------------
  static const Color surface = Color(0xFFFFFFFF);
  static const Color backgroundTop = Color(0xFFF8F5FF);
  static const Color backgroundBottom = Color(0xFFEBF1FD);

  // --- Acentos por categoría ----------------------------------------------
  static const Color calmTeal = Color(0xFF79BFC4);
  static const Color nightIndigo = Color(0xFF6C63B5);
  static const Color focusPeriwinkle = Color(0xFF7D8FE0);
  static const Color breathAqua = Color(0xFF8FC7DD);

  // --- Premium -------------------------------------------------------------
  static const Color gold = Color(0xFFD1A054);
  static const Color goldSoft = Color(0xFFF6EAD5);

  /// Degradado de fondo que usan casí todas las pantallas.
  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: <Color>[backgroundTop, backgroundBottom],
  );

  /// Degradado de marca (botónes principales, círculos del onboarding).
  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: <Color>[lilac, blue],
  );

  /// Degradado suave a partir de un color de categoría.
  static LinearGradient softGradient(Color color) {
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: <Color>[
        Color.lerp(color, Colors.white, 0.10)!,
        Color.lerp(color, Colors.white, 0.45)!,
      ],
    );
  }
}
