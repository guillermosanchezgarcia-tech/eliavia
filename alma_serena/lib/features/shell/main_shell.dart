import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../home/home_screen.dart';
import '../library/library_screen.dart';
import '../profile/profile_screen.dart';
import 'shell_controller.dart';

/// Contenedor con la barra inferior de tres pestañas.
///
/// Usamos `IndexedStack` para que cada pestaña conserve su estado (la posición
/// del scroll, por ejemplo) al cambiar de una a otra.
class MainShell extends StatelessWidget {
  const MainShell({super.key});

  static const List<Widget> _tabs = <Widget>[
    HomeScreen(),
    LibraryScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<ShellController>(
      create: (_) => ShellController(),
      child: Consumer<ShellController>(
        builder: (BuildContext context, ShellController shell, _) {
          return Scaffold(
            body: IndexedStack(index: shell.index, children: _tabs),
            bottomNavigationBar: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: AppColors.lilac.withValues(alpha: 0.12),
                    blurRadius: 24,
                    offset: const Offset(0, -6),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: NavigationBar(
                  selectedIndex: shell.index,
                  onDestinationSelected: shell.goToIndex,
                  backgroundColor: Colors.transparent,
                  surfaceTintColor: Colors.transparent,
                  elevation: 0,
                  height: 68,
                  indicatorColor: AppColors.lilacMist,
                  labelBehavior:
                      NavigationDestinationLabelBehavior.alwaysShow,
                  destinations: const <NavigationDestination>[
                    NavigationDestination(
                      icon: Icon(Icons.home_outlined),
                      selectedIcon: Icon(
                        Icons.home_rounded,
                        color: AppColors.lilac,
                      ),
                      label: 'Inicio',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.grid_view_outlined),
                      selectedIcon: Icon(
                        Icons.grid_view_rounded,
                        color: AppColors.lilac,
                      ),
                      label: 'Explorar',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.person_outline_rounded),
                      selectedIcon: Icon(
                        Icons.person_rounded,
                        color: AppColors.lilac,
                      ),
                      label: 'Perfil',
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
