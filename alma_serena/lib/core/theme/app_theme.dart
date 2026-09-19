import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Tema visual de la app: tipografía, formás y colores por defecto.
///
/// Mantenemos un estilo minimalista: fondos claros, esquinas muy redondeadas,
/// sin sombras duras y textos con bastante aire entre líneas.
class AppTheme {
  const AppTheme._();

  /// Radio de esquina estándar para tarjetas y botónes.
  static const double radius = 24;

  /// Separación base. Se usa en múltiplos: 8, 16, 24, 32...
  static const double gap = 8;

  static ThemeData get light {
    final ColorScheme scheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.lilac,
          brightness: Brightness.light,
        ).copyWith(
          primary: AppColors.lilac,
          secondary: AppColors.blue,
          surface: AppColors.surface,
          onSurface: AppColors.ink,
        );

    final TextTheme text = _textTheme;

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.backgroundTop,
      textTheme: text,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        iconTheme: IconThemeData(color: AppColors.ink),
        titleTextStyle: TextStyle(
          color: AppColors.ink,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.lilac,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(56),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.lilac,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          minimumSize: const Size.fromHeight(56),
          side: const BorderSide(color: AppColors.lilacSoft),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 18,
        ),
        hintStyle: const TextStyle(color: AppColors.inkFaint),
        labelStyle: const TextStyle(color: AppColors.inkSoft),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppColors.lilacMist),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppColors.lilacMist),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: AppColors.lilac, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Color(0xFFD98A8A)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Color(0xFFD98A8A), width: 1.6),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.ink,
        contentTextStyle: const TextStyle(color: Colors.white),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.lilacMist,
        thickness: 1,
        space: 1,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.lilac,
        unselectedItemColor: AppColors.inkFaint,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
    );
  }

  static const TextTheme _textTheme = TextTheme(
    displaySmall: TextStyle(
      fontSize: 32,
      height: 1.2,
      fontWeight: FontWeight.w300,
      color: AppColors.ink,
      letterSpacing: -0.2,
    ),
    headlineMedium: TextStyle(
      fontSize: 28,
      height: 1.25,
      fontWeight: FontWeight.w300,
      color: AppColors.ink,
    ),
    headlineSmall: TextStyle(
      fontSize: 22,
      height: 1.3,
      fontWeight: FontWeight.w500,
      color: AppColors.ink,
    ),
    titleLarge: TextStyle(
      fontSize: 19,
      height: 1.3,
      fontWeight: FontWeight.w600,
      color: AppColors.ink,
    ),
    titleMedium: TextStyle(
      fontSize: 16,
      height: 1.35,
      fontWeight: FontWeight.w600,
      color: AppColors.ink,
    ),
    bodyLarge: TextStyle(
      fontSize: 16,
      height: 1.55,
      fontWeight: FontWeight.w400,
      color: AppColors.inkSoft,
    ),
    bodyMedium: TextStyle(
      fontSize: 14.5,
      height: 1.55,
      fontWeight: FontWeight.w400,
      color: AppColors.inkSoft,
    ),
    bodySmall: TextStyle(
      fontSize: 13,
      height: 1.45,
      fontWeight: FontWeight.w400,
      color: AppColors.inkFaint,
    ),
    labelLarge: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: AppColors.ink,
      letterSpacing: 0.3,
    ),
  );
}
