# NEON LOOP — Qué está probado y qué no

## Verificado (automático)

| Qué | Cómo | Resultado |
|---|---|---|
| Reglas, generador, puntuación, tiempo, pausa, fin de partida, anti-exploits | `npm test` (Jest) | 139 tests en verde |
| Equilibrio (ninguna partida infinita ni absurda) | `balance.test.ts` + `npm run sim` | en verde |
| Guardado: récords, corrupción, copia de seguridad, fallos de disco, escrituras concurrentes | `storage.test.ts`, `asyncStore.test.ts` | en verde |
| Los tests detectan fallos | Mutación manual de 2 reglas (reencender con puntos; reloj corriendo en la transición) | ambas detectadas |
| Tipos | `npm run typecheck` (TS estricto) | sin errores |
| Estilo y reglas de hooks | `npx expo lint` | sin avisos |
| Dependencias y configuración | `npx expo-doctor` | 21/21 |
| Empaquetado para Android | `npx expo export --platform android` (Hermes) | genera el bundle de 2,9 MB |
| El gancho de pruebas no viaja en producción | búsqueda en el bundle de producción | 0 coincidencias |

## Verificado en navegador (Chromium + Playwright, versión web solo para pruebas)

23 comprobaciones sobre la app real (`tools/e2e/`): partida completa, tiempo que no corre antes del primer toque, pausa y reanudación, cierre de tablero y tablero nuevo, fin por tiempo, pantalla de resultados, récord guardado, jugar de nuevo, dificultad Experto, reinicio con confirmación (y que lo jugado se conserva), salir al inicio, ajustes persistentes tras recargar y **recuperación automática desde la copia de seguridad con el guardado corrupto**.

```powershell
# Compilar la versión web con el gancho de pruebas y servirla
$env:EXPO_PUBLIC_E2E = "1"
npx expo export --platform web --output-dir dist-e2e
node tools/e2e/server.mjs dist-e2e 8099
# En otra terminal (requiere: npm i --no-save playwright-core ; npx playwright install chromium)
node tools/e2e/flow.mjs
node tools/e2e/flow2.mjs
```

## NO verificado (hay que probarlo en un móvil real)

La versión web usa otro renderizador, otro motor de audio y otro sistema de toques que Android. **No se ha ejecutado en ningún dispositivo ni emulador Android.**

- [ ] Instala y arranca con Expo Go (SDK 57) y/o una compilación de desarrollo.
- [ ] El tacto: ¿responde el giro al instante? ¿Se pierden toques si se pulsa muy rápido?
- [ ] Latencia y solapamiento de sonidos (¿se oye la escalera de notas sin retraso?).
- [ ] Vibración: intensidad y frecuencia agradables, y se desactiva desde los ajustes.
- [ ] Fotogramas fluidos en tableros 6×7 en un móvil de gama baja.
- [ ] El halo de las piezas (SVG con recorte) se dibuja sin costuras en Android.
- [ ] Botón Atrás: en partida abre la pausa (no sale); en la pausa la cierra; en resultados vuelve al inicio.
- [ ] Salir de la app o bloquear la pantalla pausa la partida y no se pierde tiempo.
- [ ] Barra de estado y de navegación (edge-to-edge): nada queda bajo ellas.
- [ ] Rotar el móvil / tablet / plegable (con API 36 el bloqueo de orientación no se respeta en ≥ 600 dp).
- [ ] TalkBack: se anuncian las piezas ("Pieza esquina, fila 2, columna 3, apagada. Toca para girar").
- [ ] Tamaño de fuente del sistema al máximo: la interfaz no se rompe.
- [ ] Modo avión: todo funciona sin conexión.
- [ ] ¿Es divertido? Observa a 3-5 personas jugando sin explicarles nada: ¿entienden la regla en menos de 10 s?
