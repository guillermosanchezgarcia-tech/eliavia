# NEON LOOP

Puzle arcade para Android: **gira las piezas de neón hasta que no quede ninguna luz suelta**, antes de que se acabe el tiempo.

> **Estado: Fase A (juego jugable) terminada y verificada en navegador; pendiente de prueba en un móvil real.**
> `NEON LOOP` es un **nombre de trabajo**: ya existen otras apps con ese nombre. Hay que cambiarlo antes de publicar (se centraliza en `APP_NAME`, `src/strings.ts`, y en `app.json`).

Documentación: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) (reglas, diseño, riesgos, criterios de "terminado"),
[`docs/TESTING.md`](docs/TESTING.md) (qué está probado y qué falta), [`docs/TODO.md`](docs/TODO.md) (pendientes por fase).

## Ejecutarlo en tu móvil (Windows PowerShell)

Requisitos (una sola vez): [Node.js 22 LTS](https://nodejs.org), [Git](https://git-scm.com) y la app **Expo Go** instalada en el móvil Android.

```powershell
git clone https://github.com/guillermosanchezgarcia-tech/eliavia.git
cd eliavia
git checkout ccr-c6803485-mad42z
cd neon-loop
npm install
npx expo start
```

Escanea el código QR con Expo Go. El móvil y el PC deben estar en la misma red Wi-Fi.

| Problema | Solución |
|---|---|
| El móvil no conecta (redes distintas, firewall, Wi-Fi de empresa) | `npx expo start --tunnel` |
| Cambios que no se ven / errores raros de caché | `npx expo start --clear` |
| Quieres un emulador | Instala Android Studio, crea un AVD y ejecuta `npx expo start --android` |
| Expo Go dice que el proyecto es de otra versión de SDK | Actualiza Expo Go desde Play Store. Si aún no admite el SDK 57, usa una compilación de desarrollo (`npx expo run:android`) |

> En esta fase todo el código usa módulos incluidos en Expo Go. **Los anuncios (Fase E) no funcionarán en Expo Go**: requerirán una compilación de desarrollo.

## Scripts

```powershell
npm test               # 139 tests (motor, puntuación, equilibrio, guardado, sonidos, piezas)
npm run typecheck      # TypeScript estricto
npx expo lint          # ESLint de Expo
npx expo-doctor        # coherencia de dependencias y configuración
npm run sim            # simulación de equilibrio con jugadores-bot
npm run sounds         # regenera los efectos de sonido (WAV) por síntesis
```

## Estructura

```
src/
  app/          Pantallas y navegación (Expo Router): inicio, partida, resultados
  engine/       Reglas, generador de tableros, puntuación, dificultad, partida (TS puro, sin React Native)
  storage/      Guardado versionado y validado (AsyncStorage), copia de seguridad, récords
  audio/        Efectos de sonido y traducción de eventos del motor a sonido/vibración
  haptics/      Vibración opcional
  progress/     Objetivo para la siguiente partida
  state/        Estado global (guardado, ajustes) y traspaso de resultados
  theme/        Tokens visuales (colores, tipografía)
  ui/           Componentes: piezas SVG, tablero, HUD, botones, pausa
tools/          Simulación de equilibrio, generador de sonidos, vista previa de tableros
assets/         Iconos originales y sonidos generados
docs/           Diseño, pruebas, pendientes
```

## Qué datos guarda

Solo en el dispositivo, con `AsyncStorage`: récords por dificultad, totales de juego (partidas, tableros, toques, tiempo) y ajustes de sonido/vibración. No hay cuentas, servidores, analítica ni SDK de terceros en esta fase.
