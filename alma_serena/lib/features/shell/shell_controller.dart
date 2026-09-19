import 'package:flutter/foundation.dart';

/// Pestaña visible de la barra inferior.
enum ShellTab { home, library, profile }

/// Permite que una pantalla pida cambiar de pestaña.
/// Lo usa, por ejemplo, el botón "Ver todas" de Inicio para saltar a Explorar.
class ShellController extends ChangeNotifier {
  ShellTab _tab = ShellTab.home;

  ShellTab get tab => _tab;
  int get index => _tab.index;

  void goTo(ShellTab tab) {
    if (_tab == tab) return;
    _tab = tab;
    notifyListeners();
  }

  void goToIndex(int index) => goTo(ShellTab.values[index]);
}
