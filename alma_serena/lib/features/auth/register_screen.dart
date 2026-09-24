import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/gradient_background.dart';
import 'auth_controller.dart';
import 'auth_validators.dart';
import 'widgets/password_field.dart';

/// Alta de una cuenta nueva con nombre, correo y contraseña.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final AuthController auth = context.read<AuthController>();
    final bool ok = await auth.register(
      name: _name.text,
      email: _email.text,
      password: _password.text,
    );
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pushNamedAndRemoveUntil(
        AppRoutes.home,
        (Route<dynamic> route) => false,
      );
    } else {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text(auth.errorMessage ?? 'No se pudo crear la cuenta.')),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final bool isBusy = context.watch<AuthController>().isBusy;

    return Scaffold(
      appBar: AppBar(title: const Text('Crear cuenta')),
      extendBodyBehindAppBar: true,
      body: GradientBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(28, 24, 28, 32),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  const SizedBox(height: 12),
                  Text('Empieza tu práctica', style: text.displaySmall),
                  const SizedBox(height: 10),
                  Text(
                    'Creamos tu cuenta para guardar tu racha y tu historial.',
                    style: text.bodyMedium,
                  ),
                  const SizedBox(height: 30),

                  TextFormField(
                    controller: _name,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    validator: AuthValidators.name,
                    decoration: const InputDecoration(
                      labelText: 'Tu nombre',
                      prefixIcon: Icon(
                        Icons.person_outline_rounded,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autofillHints: const <String>[AutofillHints.email],
                    validator: AuthValidators.email,
                    decoration: const InputDecoration(
                      labelText: 'Correo electrónico',
                      prefixIcon: Icon(
                        Icons.mail_outline_rounded,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  PasswordField(
                    controller: _password,
                    validator: AuthValidators.password,
                    onSubmitted: _submit,
                  ),
                  const SizedBox(height: 26),

                  FilledButton(
                    onPressed: isBusy ? null : _submit,
                    child: isBusy
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.4,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Crear cuenta'),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Al crear la cuenta aceptas las condiciones de uso y la '
                    'política de privacidad de Alma Serena.',
                    textAlign: TextAlign.center,
                    style: text.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: () =>
                        Navigator.of(context).pushReplacementNamed(AppRoutes.login),
                    child: const Text('Ya tengo cuenta'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
