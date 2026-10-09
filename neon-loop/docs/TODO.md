# NEON LOOP — Pendientes

## Fase A — Juego funcional ✅ (falta solo la prueba en móvil real)
- [x] Pantalla de inicio con demostración animada y botón JUGAR
- [x] Mecánica completa, puntuación, efectos visuales y sonoros
- [x] Final de partida y pantalla de resultados (récord + objetivo siguiente)
- [x] Récord persistente y guardado local robusto
- [x] Pausa/reanudación (botón, tecla Atrás y salir de la app) y reinicio seguro
- [ ] **Probar en un móvil Android real** (`docs/TESTING.md`) y ajustar tacto/ritmo

## Fase B — Progresión
- [ ] Estadísticas de partidas y mejores puntuaciones
- [ ] Reto diario (semilla `AAAA-MM-DD`, modo `daily` ya soportado por el motor)
- [ ] Misiones diarias sin conexión
- [ ] Logros
- [ ] Temas visuales desbloqueables (el `Theme` ya está desacoplado)
- [ ] Récord del reto diario (hoy el modo `daily` no toca los récords libres)

## Fase C — Compartir
- [ ] Compartir con el menú nativo (`Share` de React Native)
- [ ] Resumen de partida y enlace sin obligar a instalar
- [ ] Dejar preparado el contrato para clasificación en línea (sin implementarla)

## Fase D — Ajustes y cumplimiento
- [ ] Pantalla de ajustes: música y efectos por separado, vibración
- [ ] Música de fondo (hoy solo hay efectos)
- [ ] Instrucciones breves
- [ ] Accesibilidad: movimiento reducido, tema de alto contraste, tamaños de fuente
- [ ] Política de privacidad accesible desde ajustes
- [ ] Borrar progreso (con confirmación)

## Fase E — Monetización (solo con compilación de desarrollo)
- [ ] `react-native-google-mobile-ads` 17.x con IDs de prueba
- [ ] Consentimiento UMP y reapertura desde ajustes
- [ ] Anuncio recompensado opcional (+10 s una vez por partida), con explicación previa
- [ ] Interfaz de compras preparada (sin pagos reales hasta verificar Play Billing)
- [ ] Analítica local desactivable

## Fase F — Publicación
- [ ] **Elegir el nombre definitivo** y comprobar disponibilidad
- [ ] **Fijar el identificador de paquete** (hoy provisional)
- [ ] Textos de la ficha, capturas, gráfico de funciones
- [ ] Política de privacidad en una URL, Seguridad de los datos, clasificación por edades
- [ ] `eas build` con firma → `.aab`; prueba cerrada (12 testers × 14 días si la cuenta es personal)

## Deuda técnica y mejoras anotadas
- [ ] Quitar la fuente `material-symbols` (971 KB) que arrastra `expo-router`
- [ ] Medir memoria/latencia de los ~20 reproductores de `expo-audio`; plan B si pesan
- [ ] Recalibrar tiempos y bonus con datos reales (los bots son un modelo)
- [ ] Vulnerabilidades de `npm audit`: son de herramientas de compilación de Expo, no viajan en la app; no usar `audit fix --force` (rompe versiones del SDK)
