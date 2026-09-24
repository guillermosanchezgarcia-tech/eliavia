"""Convierte una grabación de voz casera en el audio final de una sesión.

Uso normal:

    python3 procesar_voz.py grabacion.wav --fondo ../sonidos/cuencos.wav \
        --salida ../../assets/audio/pausa-entre-tareas.mp3

Qué hace, por orden:

  1. Lee la grabación (wav, mp3, flac, ogg, aiff — NO m4a).
  2. Pasa a mono y quita el retumbe grave de la habitación.
  3. Mide el ruido de fondo en los primeros segundos de silencio y lo resta
     del resto de la grabación. Por eso el guion pide grabar cinco segundos
     callado antes de la primera palabra.
  4. Recorta el silencio del principio y del final.
  5. Iguala el volumen a un nivel estándar y evita picos que saturen.
  6. Mezcla por debajo el sonido de fondo elegido, en bucle.
  7. Guarda un mp3 listo para meter en la app.

Si algo suena mal, los números del bloque AJUSTES son los que hay que tocar.
"""
import argparse
import os

import numpy as np
import soundfile as sf
from scipy import signal

AJUSTES = dict(
    silencio_inicial_seg=5.0,   # cuánto silencio hay al principio para medir el ruido
    fuerza_limpieza=2.0,        # cuánto ruido se resta. Más alto = más limpio pero
                                # la voz empieza a sonar metálica. Entre 1.5 y 3.
    suelo_ruido=0.08,           # nada se borra del todo: deja este resto para que
                                # el silencio no suene "muerto"
    corte_graves_hz=85,         # por debajo de esto solo hay retumbe, no voz
    volumen_voz_db=-16.0,       # nivel final de la voz (estándar de podcast)
    volumen_fondo_db=-30.0,     # el fondo, unos 14 dB por debajo de la voz
    margen_inicio_seg=0.4,      # silencio que se deja antes de la primera palabra
    margen_final_seg=2.5,       # silencio que se deja al final
    cola_fondo_seg=3.0,         # el fondo sigue sonando y se apaga al acabar la voz
)


# --- utilidades ----------------------------------------------------------

def leer(ruta):
    x, sr = sf.read(ruta, always_2d=True)
    return x.mean(axis=1), sr


def paso_alto(x, sr, hz, orden=4):
    b, a = signal.butter(orden, hz / (sr / 2), btype='high')
    return signal.filtfilt(b, a, x)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def nivel_activo(x):
    """Nivel medido solo donde hay sonido: los silencios no deben contar."""
    activo = x[np.abs(x) > np.percentile(np.abs(x), 60)]
    return rms_db(activo if activo.size else x)


def a_nivel(x, db_objetivo):
    """Sube o baja el audio hasta el nivel pedido."""
    return x * 10 ** ((db_objetivo - nivel_activo(x)) / 20)


def limitar(x, techo=0.95):
    """Aplasta suavemente los picos en vez de cortarlos en seco."""
    y = np.tanh(x / techo) * techo
    pico = np.max(np.abs(y))
    return y / pico * techo if pico > techo else y


# --- limpieza ------------------------------------------------------------

def quitar_ruido(x, sr, segundos_ruido, fuerza, suelo):
    """Resta del audio el 'color' del ruido medido en el silencio inicial.

    Técnicamente es una resta espectral: se parte el audio en trocitos, se
    mira cuánta energía hay en cada frecuencia, y se le quita la que ya
    estaba ahí cuando nadie hablaba.
    """
    muestras_ruido = int(segundos_ruido * sr)
    if muestras_ruido < sr // 2:
        print('  · aviso: no hay silencio inicial suficiente, no limpio ruido')
        return x

    f, t, Z = signal.stft(x, fs=sr, nperseg=2048, noverlap=1536)
    mag, fase = np.abs(Z), np.angle(Z)

    _, _, Zr = signal.stft(x[:muestras_ruido], fs=sr, nperseg=2048, noverlap=1536)
    perfil = np.mean(np.abs(Zr), axis=1, keepdims=True)

    limpio = np.maximum(mag - fuerza * perfil, suelo * mag)
    _, y = signal.istft(limpio * np.exp(1j * fase), fs=sr,
                        nperseg=2048, noverlap=1536)
    return y[:len(x)]


def recortar(x, sr, margen_ini, margen_fin):
    """Quita el silencio sobrante de los extremos, dejando un margen."""
    env = np.abs(signal.lfilter([1], [1, -0.999], np.abs(x)))
    env /= np.max(env) + 1e-12
    umbral = 0.02
    fuertes = np.flatnonzero(np.abs(x) > umbral * np.max(np.abs(x)))
    if fuertes.size == 0:
        return x
    ini = max(0, fuertes[0] - int(margen_ini * sr))
    fin = min(len(x), fuertes[-1] + int(margen_fin * sr))
    return x[ini:fin]


# --- mezcla y salida -----------------------------------------------------

def bucle(fondo, largo, sr, cruce_seg=2.0):
    """Repite el sonido de fondo hasta cubrir la sesión, sin costura audible."""
    if len(fondo) >= largo:
        return fondo[:largo].copy()
    cruce = min(int(cruce_seg * sr), len(fondo) // 3)
    paso = len(fondo) - cruce
    salida = np.zeros(largo + len(fondo))
    rampa = np.linspace(0, 1, cruce)
    pos = 0
    while pos < largo:
        trozo = fondo.copy()
        if pos > 0:
            trozo[:cruce] *= rampa
            salida[pos:pos + cruce] *= rampa[::-1]
        salida[pos:pos + len(trozo)] += trozo
        pos += paso
    return salida[:largo]


def escribir_mp3(ruta, x, sr, kbps=128):
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    datos = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    with open(ruta, 'wb') as f:
        f.write(enc.encode(datos))
        f.write(enc.flush())


def procesar(entrada, fondo_ruta, salida, ajustes=AJUSTES):
    voz, sr = leer(entrada)
    print(f'· leído {os.path.basename(entrada)}: '
          f'{len(voz) / sr / 60:.1f} min a {sr} Hz')

    voz = paso_alto(voz, sr, ajustes['corte_graves_hz'])
    voz = quitar_ruido(voz, sr, ajustes['silencio_inicial_seg'],
                       ajustes['fuerza_limpieza'], ajustes['suelo_ruido'])
    voz = recortar(voz, sr, ajustes['margen_inicio_seg'],
                   ajustes['margen_final_seg'])
    voz = a_nivel(voz, ajustes['volumen_voz_db'])
    print(f'· voz limpia: {len(voz) / sr / 60:.1f} min, '
          f'nivel {nivel_activo(voz):.1f} dB')

    mezcla = voz
    if fondo_ruta:
        fondo, sr_f = leer(fondo_ruta)
        if sr_f != sr:
            fondo = signal.resample(fondo, int(len(fondo) * sr / sr_f))
        largo = len(voz) + int(ajustes['cola_fondo_seg'] * sr)
        cama = a_nivel(bucle(fondo, largo, sr), ajustes['volumen_fondo_db'])
        # El fondo entra y sale despacio.
        fade = int(2.5 * sr)
        cama[:fade] *= np.linspace(0, 1, fade)
        cama[-fade:] *= np.linspace(1, 0, fade)
        mezcla = np.pad(voz, (0, largo - len(voz))) + cama
        print(f'· mezclado con {os.path.basename(fondo_ruta)}')

    mezcla = limitar(mezcla)
    if salida.lower().endswith('.mp3'):
        escribir_mp3(salida, mezcla, sr)
    else:
        sf.write(salida, mezcla, sr)
    print(f'· guardado {salida}  ({len(mezcla) / sr / 60:.1f} min, '
          f'{os.path.getsize(salida) / 1024:.0f} KB)')
    return salida


if __name__ == '__main__':
    p = argparse.ArgumentParser(description='Limpia y mezcla una sesión guiada.')
    p.add_argument('entrada', help='grabación de voz (wav/mp3/flac/ogg)')
    p.add_argument('--fondo', default=None, help='sonido de fondo opcional')
    p.add_argument('--salida', default='sesion.mp3')
    a = p.parse_args()
    procesar(a.entrada, a.fondo, a.salida)
