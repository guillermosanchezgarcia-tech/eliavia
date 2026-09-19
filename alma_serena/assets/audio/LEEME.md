# Audios de las sesiones

Esta carpeta está vacía a propósito: todavía no hay audios reales.

Cuando los tengas:

1. Deja aquí los archivos `.mp3` (por ejemplo `ans-01.mp3`, uno por sesión,
   usando el mismo identificador que aparece en
   `lib/data/mock/mock_content.dart`).
2. Descomenta las dos últimas líneas de `pubspec.yaml`:

   ```yaml
   assets:
     - assets/audio/
   ```

3. Rellena el campo `audioAsset` de cada sesión en `mock_content.dart`, por
   ejemplo `audioAsset: 'assets/audio/ans-01.mp3'`.
4. Sigue las instrucciones del comentario `TODO(audio)` de
   `lib/data/services/audio_service.dart` para que el reproductor suene de
   verdad.
