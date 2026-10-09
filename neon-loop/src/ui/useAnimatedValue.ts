import { useState } from 'react';
import { Animated } from 'react-native';

/**
 * Valor animado estable entre renders. Se crea una sola vez con el inicializador perezoso de
 * `useState` (a diferencia de `useRef(new Animated.Value())`, que construye uno nuevo en cada render).
 * Hook propio porque el de react-native no existe en react-native-web, que se usa para verificar la interfaz.
 */
export function useAnimatedValue(initial: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}
