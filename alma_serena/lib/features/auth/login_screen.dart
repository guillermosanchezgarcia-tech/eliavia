import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/gradient_background.dart';
import '../splash/splash_screen.dart';
import 'auth_controller.dart';
import 'auth_validators.dart';
import 'widgets/password_field.dart';

/// Entrada con correo y contraseña (y, opcionalmente, con Google).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final AuthController auth = context.read<AuthController>();
    final bool ok = await auth.signIn(
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
      _showError(auth.errorMessage);
    }
  }

  Future<void> _submitWithGoogle() async {
    final AuthController auth = context.read<AuthController>();
    final bool ok = await auth.signInWithGoogle();
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pushNamedAndRemoveUntil(
        AppRoutes.home,
        (Route<dynamic> route) => false,
      );
    } else {
      _showError(auth.errorMessage);
    }
  }

  void _showError(String? message) {
    if (message == null) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final TextTheme text = Theme.of(context).textTheme;
    final bool isBusy = context.watch<AuthController>().isBusy;

    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(28, 32, 28, 32),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    const Center(child: AppLogo(size: 76)),
                    const SizedBox(height: 28),
                    Text(
                      'Hola de nuevo',
                      textAlign: TextAlign.center,
                      style: text.displaySmall,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Entra para seguir con tu práctica.',
                      textAlign: TextAlign.center,
                      style: text.bodyMedium,
                    ),
                    const SizedBox(height: 34),

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

                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () {
                          // TODO(backend): recuperación de contraseña con
                          // FirebaseAuth.sendPasswordResetEmail(email).
                          ScaffoldMessenger.of(context)
                            ..hideCurrentSnackBar()
                            ..showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Disponible cuando conectemos el servidor.',
                                ),
                              ),
                            );
                        },
                        child: const Text('¿Has olvidado la contraseña?'),
                      ),
                    ),
                    const SizedBox(height: 10),

                    FilledButton(
                      onPressed: isBusy ? null : _submit,
                      child: isBusy
                          ? const _ButtonSpinner()
                          : const Text('Entrar'),
                    ),
                    const SizedBox(height: 22),

                    const _OrDivider(),
                    const SizedBox(height: 22),

                    OutlinedButton.icon(
                      onPressed: isBusy ? null : _submitWithGoogle,
                      icon: const Icon(
                        Icons.g_mobiledata_rounded,
                        size: 28,
                        color: AppColors.blue,
                      ),
                      label: const Text('Continuar con Google'),
                    ),
                    const SizedBox(height: 26),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: <Widget>[
                        Text('¿Aún no tienes cuenta?', style: text.bodyMedium),
                        TextButton(
                          onPressed: () => Navigator.of(context)
                              .pushNamed(AppRoutes.register),
                          child: const Text('Créala aquí'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OrDivider extends StatelessWidget {
  const _OrDivider();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        const Expanded(child: Divider(color: AppColors.lilacMist)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text('o', style: Theme.of(context).textTheme.bodySmall),
        ),
        const Expanded(child: Divider(color: AppColors.lilacMist)),
      ],
    );
  }
}

class _ButtonSpinner extends StatelessWidget {
  const _ButtonSpinner();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 22,
      width: 22,
      child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
    );
  }
}
