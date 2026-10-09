# NEON LOOP — Diseño del juego

## 1. Mecánica: "Cierra el circuito"

El tablero es una cuadrícula de piezas de neón (rectas, esquinas, T y cruces). Cada pieza tiene extremos de luz hacia sus lados.

- **Un toque gira una pieza 90° en sentido horario.** Es el único control.
- Una pieza **se enciende** cuando todos sus extremos encajan con un extremo de la pieza vecina. Un extremo que apunta al borde del tablero, o a una pieza que no lo enfrenta, queda **suelto** (se dibuja con un anillo ámbar).
- El tablero **se cierra** cuando todas las piezas están encendidas (ningún extremo suelto): la luz estalla, se suman puntos y segundos, y entra un tablero nuevo.
- La partida es **contrarreloj**. El tiempo empieza a correr con el **primer toque**. Cerrar tableros suma segundos. Termina cuando el tiempo llega a 0.

Regla de oro: **todo tablero tiene solución**, porque se genera *desde* una disposición cerrada y se mezcla después. No hay tableros imposibles ni suerte durante el tablero: si pierdes, fue por lectura o por rapidez.

### Por qué podría ser más interesante que un puzle de combinar colores

- **Deducción en lugar de reconocimiento de patrones**: se resuelve leyendo geometría, no buscando colores iguales.
- **Sin aleatoriedad durante el tablero**: nada de piezas que lleguen mal; el dominio se nota.
- **Maestría medible**: el `par` (giros de referencia) convierte "lo cerré" en "lo cerré en 11 giros de 10".
- **Respuesta inmediata**: cada pieza que se enciende suena con una nota más aguda mientras dure la racha (escala pentatónica).
- **Sin depender del color**: encendida = trazo grueso + halo + nodo relleno; apagada = trazo fino + nodo hueco; extremo suelto = anillo. Funciona en escala de grises.

### Honestidad sobre la originalidad

Girar piezas para conectarlas **es un género existente** (rompecabezas de tuberías/cables, p. ej. el genérico "Net" o "Infinity Loop"). Lo propio de este proyecto es la **capa arcade** —tiempo que se gana cerrando tableros, racha musical, puntuación por par, dificultad adaptativa y economía de tiempo equilibrada por simulación—, no un género nuevo. Que sea *divertido* solo lo pueden decir los jugadores: de ahí las métricas de `docs/` y la prueba cerrada antes de publicar.

## 2. Reglas exactas

### Puntuación

| Concepto | Valor |
|---|---|
| Encender una pieza **por primera vez en el tablero** | 10 × multiplicador de racha |
| Racha | cada encendido nuevo suma 1; se pierde si pasan 2,2 s sin encender nada nuevo |
| Multiplicador | `min(6, 1 + ⌊(racha − 1) / 3⌋)` (×1 hasta racha 3, ×2 hasta 6, … tope ×6) |
| Cerrar un tablero | `15 × piezas × eficiencia²` (+ 50 si no hay giros de más) |
| Eficiencia | `min(1, par / giros)`; **par** = giros mínimos hacia la disposición con la que se generó el tablero |
| Reencender una pieza ya encendida antes | 0 puntos (anti-exploit) |
| Piezas que nacen ya encendidas | 0 puntos |

### Tiempo

- Al cerrar un tablero se suma `clamp(piezas × bonusPorPieza, 3 s, 9 s) × decaimiento × (0,7 + 0,3 × eficiencia)`.
- **Decaimiento**: el bonus baja un 4 % por cada tablero cerrado (suelo del 35 %), igual para todos. Sin él, un jugador experto jugaría para siempre: la simulación lo detectó (ver §5).
- Durante la animación de cierre (0,75 s) el reloj **no corre** y los toques se ignoran.
- Un parón del JS (tick > 0,5 s) se recorta: nunca se descuenta tiempo de golpe al jugador.
- El tiempo no corre en pausa ni antes del primer toque. Salir de la app o apagar la pantalla pausa la partida automáticamente.

### Dificultades (todas disponibles desde el primer momento)

| | Tiempo inicial | Tableros (escalera) | Bonus/pieza |
|---|---|---|---|
| Fácil | 34 s | 3×3 → 5×5 | 0,48 s |
| Normal | 40 s | 4×4 → 6×6 | 0,44 s |
| Experto | 44 s | 5×5 → 6×7 | 0,42 s |

**Dificultad adaptativa sin trampas**: un `rating` interno sube +1 si cierras un tablero dentro del tiempo objetivo (`piezas × ms/pieza`), +0,5 si tardas hasta el doble y baja 0,5 si tardas más. El escalón de tablero es `⌊rating⌋`, nunca baja de 0. Nunca se manipula la dificultad para empujar a ver anuncios o comprar.

### Generador (`src/engine/generator.ts`)

1. Elige "caras" (cuadrados de 4 casillas) hasta cubrir la densidad pedida. La **frontera** de cualquier conjunto de caras es una unión de ciclos: ninguna pieza queda con extremos sueltos.
2. Añade "puentes" entre casillas vecinas (crean T y cruces) según la dificultad.
3. Mezcla cada pieza a una orientación aleatoria (uniforme entre sus orientaciones distintas), exigiendo que no nazca resuelto y que el par no sea trivial.
4. Es **determinista** respecto a la semilla (base del reto diario de la Fase B).

## 3. Psicología y diseño ético

| Principio | Cómo se aplica |
|---|---|
| Recompensa inmediata | Sonido, vibración y puntos flotantes por cada pieza que se enciende |
| Objetivos cortos | Cada tablero dura segundos; la pantalla de resultados propone un objetivo concreto y alcanzable (`src/progress/goals.ts`) |
| Progreso visible | Récord por dificultad, "te faltaron N puntos", eficiencia, mejor racha |
| Dificultad adaptativa | Ver §2; sin trampas |
| Aprender sin tutorial | Demostración animada con las piezas reales en la pantalla de inicio |

**No se hace** (y se comprueba al revisar cada fase): falsas urgencias, cuentas atrás engañosas, castigo por descansar, pérdida de progreso, cajas de botín, pagar por evitar dificultad injusta, notificaciones insistentes. Se puede silenciar sonido y vibración en cualquier momento, y abandonar una partida con un toque (lo jugado **se conserva**).

## 4. Arquitectura

```
UI (Expo Router + react-native-svg + Animated)
        │ taps / ticks                       ▲ snapshot + eventos
        ▼                                    │
 engine/  GameRun  ← generator, scoring, difficulty, board, tiles, rng   (TS puro)
        │ RunResult
        ▼
 storage/ applyRunResult (valida) → SaveData → AsyncStorage (+ copia)    audio/ haptics/ ← eventos
```

- **El motor no importa nada de React Native**: se prueba con Jest y se simula con bots.
- `GameRun` es una máquina de estados (`ready → playing ⇄ paused → transition → over`) con `tap`, `tick`, `pause`, `resume`, `abandon`. Devuelve **eventos** (`lock`, `clear`, `warn`, `over`…) que la UI traduce a animación, sonido y vibración.
- **Guardado robusto**: esquema versionado; `sanitizeSave` reconstruye campo a campo; `validateRunResult` rechaza partidas incoherentes antes de tocar los récords; escrituras serializadas con copia de seguridad; si el principal está dañado se restaura la copia.
- Dependencias principales: Expo SDK 57 (React Native 0.86, React 19.2), Expo Router, react-native-svg, async-storage, expo-audio, expo-haptics, expo-keep-awake, Rajdhani (OFL, empaquetada).

## 5. Equilibrio por simulación

`npm run sim` hace jugar al **motor real** a bots con tres niveles de habilidad (lectura del tablero + tiempo entre toques + errores). Es un *modelo*, no personas: sirve para detectar partidas infinitas o absurdas, no para predecir métricas reales.

Resultado actual (100 partidas por celda, segundos de juego efectivo):

| Dificultad | Habilidad | Duración p10 / mediana / p90 | Tableros | Puntos (mediana) |
|---|---|---|---|---|
| Fácil | novato | 46 / 51 / 52 | 4 | 863 |
| Fácil | medio | 65 / 71 / 81 | 7 | 3.231 |
| Fácil | experto | 123 / 130 / 137 | 20 | 16.889 |
| Normal | novato | 54 / 56 / 57 | 3 | 940 |
| Normal | medio | 73 / 80 / 82 | 6 | 3.712 |
| Normal | experto | 122 / 127 / 132 | 13 | 14.668 |
| Experto | novato | 59 / 60 / 61 | 2 | 1.139 |
| Experto | medio | 76 / 78 / 79 | 4 | 4.156 |
| Experto | experto | 116 / 122 / 129 | 10 | 14.846 |

**Lección de la simulación**: la primera versión no tenía decaimiento del bonus y un jugador experto en Fácil jugaba **17.500 s** (2.500 tableros) sin perder. Se corrigió y quedó cubierto por `balance.test.ts`.

> Los parámetros de los bots son supuestos. **Hay que recalibrar con datos de jugadores reales** (duración mediana, tableros por partida, abandonos) tras la prueba cerrada.

## 6. Definición de "MVP terminado"

**Producto**
- [ ] Fases A–D completas y verificadas.
- [ ] Probado en ≥ 3 dispositivos Android reales (gama baja, media y alta) con la lista de `docs/TESTING.md`.
- [ ] 30 min de juego continuo sin cierres ni fugas de memoria visibles.
- [ ] Una partida típica dura entre 30 y 90 s en dispositivo real (se mide, no se supone).
- [ ] ≥ 12 testers reales han jugado y dado feedback (también es requisito de Play para cuentas personales).

**Técnico**
- [ ] `tsc`, ESLint, `expo-doctor` y todos los tests en verde.
- [ ] `.aab` firmado con target API 36 generado con EAS; instala y arranca en dispositivo.
- [ ] Sin permisos innecesarios en el manifiesto (RECORD_AUDIO y servicios en primer plano bloqueados).

**Cumplimiento (no se afirma hasta verificarlo)**
- [ ] Política de privacidad publicada en una URL.
- [ ] Sección "Seguridad de los datos" y cuestionario de clasificación completados.
- [ ] Consentimiento publicitario (UMP) probado en una región del EEE.
- [ ] Nombre comercial libre en Play Store y registros de marcas.

**Monetización**
- [ ] Anuncio recompensado opcional con IDs de prueba; recompensa solo si el SDK la concede.
- [ ] Sin intersticiales hasta validar el flujo.
- [ ] Sin compras reales hasta verificar Play Billing con productos configurados.

## 7. Riesgos

**Técnicos**
- Sin dispositivo en el entorno de desarrollo: el tacto, la latencia del audio y el rendimiento reales **no están medidos**.
- `expo-audio` no es un SoundPool: crear ~20 reproductores puede pesar en gama baja y la latencia de efectos rápidos es desconocida. Plan B: reducir la escalera de notas o precargar menos.
- Dibujo SVG por pieza (hasta 42 `<Svg>`): debería ir bien, pero hay que medir fotogramas en gama baja.
- Con API 36, en pantallas ≥ 600 dp Android ignora el bloqueo de orientación: hay que probar en tablet/plegable.
- Los anuncios exigen compilación de desarrollo (no funcionan en Expo Go).
- El paquete incluye una fuente de 971 KB (`material-symbols`) arrastrada por `expo-router`/`expo-symbols` que el juego no usa: optimización pendiente.

**Monetización**
- Género saturado; los ingresos por anuncios recompensados son desconocidos y no se estiman aquí.
- En el EEE hay que obtener consentimiento antes de personalizar anuncios; declarar la app como no dirigida a menores y documentarlo.

**Publicación**
- **Nombre**: existen otras apps llamadas "Neon Loop" (una de ellas en Android y un juego de tuberías en itch.io): riesgo de ASO y de marca.
- **Identificador de paquete**: `io.github.guillermosanchezgarcia.neonloop` es **provisional** y es permanente tras la primera subida.
- **API objetivo 36** obligatoria para apps nuevas desde el 31/08/2026.
- **Cuenta personal nueva**: prueba cerrada con ≥ 12 testers durante 14 días antes de pedir producción.
