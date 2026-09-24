import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Campo de contraseña con el ojito para mostrarla u ocultarla.
class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    this.label = 'Contraseña',
    this.validator,
    this.textInputAction = TextInputAction.done,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final String? Function(String?)? validator;
  final TextInputAction textInputAction;
  final VoidCallback? onSubmitted;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _hidden = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      obscureText: _hidden,
      validator: widget.validator,
      textInputAction: widget.textInputAction,
      onFieldSubmitted: (_) => widget.onSubmitted?.call(),
      decoration: InputDecoration(
        labelText: widget.label,
        prefixIcon: const Icon(
          Icons.lock_outline_rounded,
          color: AppColors.inkFaint,
        ),
        suffixIcon: IconButton(
          onPressed: () => setState(() => _hidden = !_hidden),
          icon: Icon(
            _hidden
                ? Icons.visibility_outlined
                : Icons.visibility_off_outlined,
            color: AppColors.inkFaint,
          ),
          tooltip: _hidden ? 'Mostrar contraseña' : 'Ocultar contraseña',
        ),
      ),
    );
  }
}
