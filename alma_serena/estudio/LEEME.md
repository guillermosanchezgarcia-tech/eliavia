# El estudio de Alma Serena

Esta carpeta no es la app. Es el taller donde se fabrican los audios que la
app reproduce: los sonidos de fondo y las sesiones con voz. Nada de aquí se
compila ni se instala en el móvil; son herramientas para producir archivos.

```
estudio/
├── sonidos/    los sonidos de fondo, generados por ordenador
├── voz/        la herramienta que limpia tu grabación y la mezcla
└── guiones/    los textos que se leen en cada sesión
```

## Qué necesita el ordenador

Solo dos cosas, y se instalan una vez:

```
pip install numpy scipy soundfile lameenc
```

## 1. Los sonidos de fondo

No están grabados en ningún sitio: se calculan. Eso significa que se pueden
cambiar todo lo que haga falta sin volver a grabar nada.

| Archivo | Qué genera | Estado |
|---|---|---|
| `sonidos/cuencos.py` | Cuencos tibetanos, 5 minutos | **aprobado** |
| `sonidos/ambiente.py` | Tres versiones de lluvia y tres de mar | pendiente de elegir |

Para cambiar cómo suena un sonido, se abre el archivo, se toca un número del
bloque de arriba (cada uno lleva al lado qué hace) y se vuelve a ejecutar:

```
cd sonidos
python3 cuencos.py
```

Aparece un `cuencos.wav` en la misma carpeta. Si no gusta, se cambia otro
número y se repite. No se puede romper nada.

## 2. La voz

El proceso tiene cuatro pasos y solo uno es tuyo:

1. **El guion** lo escribo yo, y vive en `guiones/`.
2. **La grabación** la haces tú, leyendo el guion en voz alta.
3. **La limpieza** la hace `voz/procesar_voz.py`.
4. **El montaje en la app** lo hago yo.

### Cómo grabar

- Una habitación pequeña con cosas blandas (sofá, cortinas, cama). Los baños
  y las cocinas suenan a lata.
- Móvil en modo avión, apoyado en algo, a un palmo de la boca y un poco de
  lado, no de frente: así no revientan las *p* y las *b*.
- **Cinco segundos de silencio antes de la primera palabra.** No es un
  capricho: el programa mide ahí el ruido de la habitación para poder
  restarlo después. Sin esos cinco segundos la limpieza no funciona.
- Si te trabas, no empieces de cero: paras, respiras, y repites la frase.
  Los trozos malos se cortan luego.
- Guarda en **wav o mp3**. El **m4a de iPhone no se puede leer** aquí; en la
  grabadora del iPhone se cambia en Ajustes → Notas de voz → Calidad →
  Sin pérdidas, o se usa cualquier app que grabe en wav.

### Cómo se limpia

```
cd voz
python3 procesar_voz.py grabacion.wav --fondo ../sonidos/cuencos.wav \
    --salida ../../assets/audio/pausa-entre-tareas.mp3
```

El programa, por orden: quita el retumbe grave, mide el ruido de los cinco
segundos iniciales y lo resta de toda la grabación, recorta los silencios de
los extremos, iguala el volumen al nivel estándar de un podcast, mete el
sonido de fondo en bucle 14 dB por debajo de la voz, y guarda un mp3.

Si el resultado suena mal, se toca el bloque `AJUSTES` del archivo:

| Ajuste | Si el resultado suena… |
|---|---|
| `fuerza_limpieza` | metálico o con eco raro → bájalo. Con siseo → súbelo |
| `volumen_fondo_db` | fondo demasiado presente → bájalo (más negativo) |
| `margen_final_seg` | corta demasiado pronto al final → súbelo |
| `corte_graves_hz` | voz sin cuerpo → bájalo. Retumba → súbelo |

La herramienta está probada de punta a punta con una grabación de prueba
fabricada a propósito con siseo, zumbido de la red eléctrica y retumbe: baja
el ruido de los silencios unos 10 dB y deja el audio sin saturar.
