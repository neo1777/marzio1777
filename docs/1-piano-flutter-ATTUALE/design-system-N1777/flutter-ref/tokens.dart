import 'package:flutter/material.dart';

/// N1777 Design tokens — extracted from cowork screenshots and preview.
/// Single source of truth per tutta l'app.
class DesignTokens {
  // Colors — dark theme with brass accent
  static const Color bgApp = Color(0xFF0A0A0C);
  static const Color bgSurface = Color(0xFF151518);
  static const Color bgCard = Color(0xFF1A1A1F);
  static const Color bgElevated = Color(0xFF212127);
  static const Color border = Color(0xFF252530);
  static const Color borderActive = Color(0xFF35354A);
  static const Color textPrimary = Color(0xFFEEEEF0);
  static const Color textSecondary = Color(0xFF9A9AA6);
  static const Color textMuted = Color(0xFF5C5C6A);
  static const Color brass = Color(0xFFC9A227);
  static const Color brassHover = Color(0xFFD4AF37);
  static const Color brassDim = Color(0x24C9A227); // 14% opacity
  static const Color inkRed = Color(0xFFEF4444);
  static const Color inkGreen = Color(0xFF22C55E);
  static const Color inkBlue = Color(0xFF3B82F6);
  static const Color inkPurple = Color(0xFFA855F7);

  // Spacing
  static const double radius = 16.0;
  static const double radiusSm = 10.0;
  static const double radiusXs = 8.0;
  static const double spaceXs = 4.0;
  static const double spaceSm = 8.0;
  static const double spaceMd = 16.0;
  static const double spaceLg = 24.0;
  static const double spaceXl = 32.0;

  // Typography
  static const String fontSans = 'Inter';
  static const String fontMono = 'JetBrains Mono';
  static const String fontSerif = 'Newsreader';

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bgApp,
      colorScheme: const ColorScheme.dark(
        primary: brass,
        onPrimary: bgApp,
        secondary: inkBlue,
        surface: bgSurface,
        onSurface: textPrimary,
        outline: border,
        error: inkRed,
        onError: textPrimary,
      ),
      fontFamily: fontSans,
      appBarTheme: const AppBarTheme(
        backgroundColor: bgSurface,
        foregroundColor: textPrimary,
        elevation: 0,
        scrolledUnderElevation: 1,
        titleTextStyle: TextStyle(
          fontFamily: fontSans,
          fontWeight: FontWeight.w600,
          fontSize: 18,
          color: textPrimary,
        ),
      ),
      cardTheme: const CardThemeData(
        color: bgCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(radius)),
          side: BorderSide(color: border, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: brass,
          foregroundColor: bgApp,
          padding: const EdgeInsets.symmetric(horizontal: spaceLg, vertical: spaceMd),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusSm),
          ),
          textStyle: const TextStyle(
            fontFamily: fontSans,
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: textSecondary,
          side: const BorderSide(color: border),
          padding: const EdgeInsets.symmetric(horizontal: spaceMd, vertical: spaceSm),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusXs),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: bgCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: const BorderSide(color: brass, width: 1.5),
        ),
        hintStyle: const TextStyle(color: textMuted, fontFamily: fontSans),
      ),
      dividerTheme: const DividerThemeData(
        color: border,
        thickness: 1,
        space: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: bgElevated,
        contentTextStyle: const TextStyle(fontFamily: fontSans, fontSize: 13),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusXs),
        ),
      ),
    );
  }
}
