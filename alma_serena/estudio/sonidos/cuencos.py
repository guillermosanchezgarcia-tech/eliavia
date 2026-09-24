"""Cuencos tibetanos — sonido de fondo aprobado.

Este es el único sonido de fondo que ya está dado por bueno. Para cambiar
cómo suena solo hay que tocar los números del bloque CUENCOS de abajo y
volver a ejecutar el archivo:

    python3 cuencos.py

Qué hace cada número está explicado al lado. No hace falta entender el resto
del archivo.
"""
import wave

import numpy as np
from scipy import signal

SR = 44100          # calidad de CD, no tocar
DURACION = 300      # segundos que dura el archivo generado (300 = 5 min)

CUENCOS = dict(
    nota_hz=196.0,      # tono del cuenco. Más bajo = más grave. 196 = sol grave
    cada_seg=6.5,       # segundos entre golpe y golpe. Más alto = más espaciado
    decaimiento=5.5,    # segundos que tarda en apagarse cada golpe
    batido_hz=0.7,      # el vaivén lento del metal. 0 = plano, 2 = muy ondulante
    volumen=0.26,       # volumen general (0 a 1)
)

# Un cuenco no da una nota limpia como un piano: vibra en armónicos
# "torcidos" (no múltiplos exactos), y eso es lo que le da el color metálico.
PARCIALES = [(1.0, 1.0), (2.01, 0.45), (2.72, 0.28), (4.08, 0.15), (5.9, 0.08)]


def _ruido(n, semilla):
    return np.random.default_rng(semilla).normal(0, 1, n)


def _paso_bajo(x, corte, orden=2):
    b, a = signal.butter(orden, corte / (SR / 2), btype='low')
    return signal.lfilter(b, a, x)


def cuencos(p, duracion=DURACION):
    n = SR * duracion
    salida = np.zeros(n)
    rng = np.random.default_rng(21)
    for golpe in np.arange(0.4, duracion, p['cada_seg']):
        ini = int(golpe * SR)
        largo = min(n - ini, int(p['decaimiento'] * 2 * SR))
        if largo <= 0:
            break
        t = np.arange(largo) / SR
        voz = np.zeros(largo)
        for mult, peso in PARCIALES:
            f = p['nota_hz'] * mult
            # Los armónicos agudos se apagan antes que el fundamental.
            caida = np.exp(-t / (p['decaimiento'] / (1 + mult * 0.35)))
            # Dos ondas casi iguales: al sumarse crean el batido del metal.
            voz += peso * caida * (
                np.sin(2 * np.pi * f * t)
                + np.sin(2 * np.pi * (f + p['batido_hz']) * t + rng.uniform(0, 6))
            ) / 2
        # El "toc" del mazo al tocar el borde.
        mazo = _paso_bajo(_ruido(largo, 30), 5000) * np.exp(-t * 90) * 0.4
        salida[ini:ini + largo] += voz + mazo
    return salida * p['volumen']


def guardar(nombre, x, fade_seg=1.5):
    # Entrada y salida suaves, para que no empiece ni acabe de golpe.
    fade = int(fade_seg * SR)
    x = x.copy()
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    x = np.clip(x, -1, 1)
    with wave.open(nombre, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((x * 32767).astype('<i2').tobytes())
    print(f'{nombre}  {len(x) / SR:.0f} s  pico={np.max(np.abs(x)):.2f}')


if __name__ == '__main__':
    guardar('cuencos.wav', cuencos(CUENCOS))
