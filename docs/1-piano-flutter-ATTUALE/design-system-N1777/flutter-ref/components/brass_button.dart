import 'package:flutter/material.dart';
import '../../utils/result.dart';

class BrassButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final ButtonVariant variant;
  final IconData? icon;

  const BrassButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
    this.variant = ButtonVariant.filled,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    Widget child = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (isLoading)
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2, color: const Color(0xFF0A0A0C)),
          )
        else if (icon != null)
          Icon(icon, size: 18, color: _textColor)
        else
          const SizedBox.shrink(),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(fontFamily: 'Inter')),
      ],
    );

    switch (variant) {
      case ButtonVariant.filled:
        return ElevatedButton(onPressed: isLoading ? null : onPressed, child: child);
      case ButtonVariant.outlined:
        return OutlinedButton(onPressed: isLoading ? null : onPressed, child: child);
      case ButtonVariant.ghost:
        return TextButton(onPressed: isLoading ? null : onPressed, child: child);
    }
  }

  Color get _textColor {
    switch (variant) {
      case ButtonVariant.filled:
        return const Color(0xFF0A0A0C);
      case ButtonVariant.outlined:
      case ButtonVariant.ghost:
        return const Color(0xFFC9A227);
    }
  }
}

enum ButtonVariant { filled, outlined, ghost }
