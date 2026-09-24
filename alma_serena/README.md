# Alma Serena

App de **meditación y bienestar en español** para Android, hecha con Flutter.
Modelo *freemium*: hay contenido gratuito y un grupo de sesiones y categorías
reservadas a quien tenga suscripción.

> Esta carpeta es un proyecto Flutter completo e independiente. El resto del
> repositorio no tiene nada que ver con la app.

---

## Cómo probarla

Necesitas tener Flutter instalado (guía oficial:
<https://docs.flutter.dev/get-started/install>). Después:

```bash
cd alma_serena
flutter pub get      # descarga las librerías (solo la primera vez)
flutter run          # abre la app en el móvil o el emulador conectado
```

Para generar el archivo que se sube a Google Play:

```bash
flutter build appbundle --release
```

Antes de subirla a Play habrá que firmarla con tu propia clave; ahora mismo usa
la clave de pruebas que crea Flutter (está indicado con un `TODO` en
`android/app/build.gradle.kts`).

---

## Qué pantallas hay

| Pantalla | Qué hace |
|---|---|
| **Presentación** (onboarding) | Tres pasos con los círculos animados. Solo se ve la primera vez. |
| **Acceso / registro** | Entrar con correo y contraseña, o con Google. |
| **Inicio** | Saludo, frase del día, sesión recomendada, categorías y sesiones cortas. |
| **Explorar** | Todas las categorías, buscador y filtro "solo gratis". |
| **Categoría** | Las sesiones de una categoría concreta. |
| **Reproductor** | Cronómetro, play/pausa, ±10 s, barra de progreso y sonido de fondo. |
| **Perfil** | Racha, estadísticas, semana, estado de la suscripción e historial. |
| **Ajustes** | Recordatorio diario, borrar historial, gestionar suscripción, cerrar sesión. |
| **Premium** (paywall) | Ventajas y elección entre plan mensual y anual. |

---

## Lo que todavía es de mentira

Para poder ver la app entera funcionando sin servidor ni audios, hay tres cosas
simuladas. Todas están marcadas en el código con comentarios `TODO`:

1. **No suena audio.** El reproductor lleva la cuenta del tiempo, pero no
   reproduce sonido: aún no hay archivos. Está preparado para enchufar el audio
   real cambiando una sola línea (`lib/data/services/audio_service.dart`).
2. **Las cuentas se guardan solo en el móvil.** El registro y el acceso
   funcionan, pero contra la memoria del propio teléfono, no contra un servidor
   (`lib/data/repositories/auth_repository.dart`).
3. **La suscripción no cobra nada.** El botón de premium marca la cuenta como
   suscrita al momento, sin pasar por Google Play
   (`lib/data/repositories/subscription_repository.dart`).

El contenido (categorías, sesiones, planes) está escrito a mano en
`lib/data/mock/mock_content.dart`; ahí se cambian los textos sin tocar nada más.

---

## Cómo está organizado el código

```
lib/
  main.dart            Arranque: crea todo y lo reparte por la app
  app.dart             Tema, idioma y navegación
  core/                Cosas compartidas por todas las pantallas
    theme/             Colores y estilos (toda la paleta sale de aquí)
    router/            Nombres de las pantallas y cómo se abren
    utils/             Formato de horas y fechas
    widgets/           Piezas reutilizables (tarjetas, fondos, etiquetas)
  data/                De dónde salen los datos
    models/            Qué es una sesión, una categoría, un usuario...
    mock/              El contenido de ejemplo
    repositories/      Los puntos por donde entrará el servidor
    services/          Guardado local y reproductor de audio
  features/            Una carpeta por parte de la app
    onboarding/ auth/ home/ library/ player/ profile/ paywall/ shell/ splash/
test/                  Pruebas automáticas
```

### Decisiones técnicas y por qué

- **`provider`** para el estado: es la opción oficial más sencilla de leer;
  `bloc` o `riverpod` serían mucho código para una app de este tamaño.
- **Rutas con nombre de Flutter**, sin librerías de navegación: aquí no hay
  enlaces profundos ni webs que requieran algo más complejo.
- **`shared_preferences`** para guardar en el móvil: suficiente para una racha,
  un historial y unas preferencias.
- **El audio detrás de una interfaz (`AudioService`)**: así el día que existan
  los audios reales no hay que tocar ninguna pantalla.

---

## Pruebas

```bash
flutter test      # 26 pruebas: formato de fechas, racha, acceso, catálogo y onboarding
flutter analyze   # revisa el código en busca de errores
```

---

## El estudio de audio

La carpeta `estudio/` es el taller donde se fabrican los audios: los sonidos
de fondo (que se generan por ordenador, así que se pueden retocar sin volver a
grabar) y las sesiones con voz, con la herramienta que limpia una grabación
casera y la mezcla con el fondo. Está explicado paso a paso, sin tecnicismos,
en [`estudio/LEEME.md`](estudio/LEEME.md).

No forma parte de la app: no se compila ni se instala en el móvil.

---

## Siguientes pasos sugeridos

1. Grabar o comprar los audios y enchufarlos (`just_audio`).
2. Conectar Firebase Auth + Firestore para cuentas y contenido reales.
3. Conectar Google Play Billing para cobrar de verdad.
4. Notificaciones del recordatorio diario.
5. Descargas para escuchar sin conexión.
