"""Lluvia y olas, segunda versión.

Cambios de fondo frente a la primera:
  - El ruido ya no es blanco (plano y sintético) sino coloreado, que es como
    suena la naturaleza: mucho grave y poco agudo.
  - Nada es periódico. La lluvia respira despacio y las olas llegan a
    intervalos irregulares, como en el mar de verdad.
  - Se recorta el agudo que hacía que la lluvia sonara a sartén.
"""
import numpy as np
from scipy import signal
import wave

SR = 44100


def ruido(n, semilla, color):
    """color: 0 = blanco, 0.5 = rosa (natural), 1 = marrón (grave, denso)."""
    x = np.random.default_rng(semilla).normal(0, 1, n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    X *= (f / 200.0) ** (-color)
    y = np.fft.irfft(X, n)
    return y / (np.max(np.abs(y)) + 1e-9)


def bajo(x, hz, orden=2):
    b, a = signal.butter(orden, min(hz, SR / 2 - 100) / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def alto(x, hz, orden=2):
    b, a = signal.butter(orden, hz / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def respiracion(n, semilla, hz=0.06, hondura=0.25):
    """Variación lenta y aleatoria de intensidad: nada suena plano en la vida real."""
    e = bajo(np.random.default_rng(semilla).normal(0, 1, n), hz, orden=1)
    e /= np.max(np.abs(e)) + 1e-9
    return 1.0 + hondura * e


def lluvia(seg, cuerpo_hz, agudo, gotas_seg, hondura, semilla=1):
    n = SR * seg
    # Cuerpo: ruido rosa filtrado. El grave es el que da sensación de agua.
    cuerpo = bajo(ruido(n, semilla, 0.55), cuerpo_hz, orden=3)
    # Brillo controlado: banda estrecha, y con techo para que no silbe.
    brillo = bajo(alto(ruido(n, semilla + 1, 0.35), 2200), 6500) * agudo
    # Goterones: impulsos con resonancia corta y suave.
    rng = np.random.default_rng(semilla + 2)
    gotas = np.zeros(n)
    largo = SR // 10
    t = np.arange(largo) / SR
    for pos in rng.integers(0, n - largo, int(gotas_seg * seg)):
        tono = rng.uniform(600, 1700)
        gotas[pos:pos + largo] += (
            np.sin(2 * np.pi * tono * t) * np.exp(-t * 70) * rng.uniform(0.15, 0.7)
        )
    gotas = bajo(gotas, 3000)
    mezcla = (cuerpo + brillo + gotas * 0.3) * respiracion(n, semilla + 3, hondura=hondura)
    return mezcla / (np.max(np.abs(mezcla)) + 1e-9)


def olas(seg, cada_min, cada_max, profundidad, espuma, semilla=10):
    n = SR * seg
    rng = np.random.default_rng(semilla)
    # Fondo marino constante, muy grave y bajo de volumen.
    salida = bajo(ruido(n, semilla, 0.95), 320, orden=3) * 0.18
    rumor = bajo(ruido(n, semilla + 1, 0.9), profundidad, orden=3)
    burbuja = bajo(alto(ruido(n, semilla + 2, 0.4), 1500), 7000)
    # Cada ola es un suceso propio, y llegan a destiempo.
    t_ola = rng.uniform(0.5, 2.5)
    while t_ola < seg:
        dur = rng.uniform(5.0, 8.0)
        ini = int(t_ola * SR)
        largo = min(n - ini, int(dur * SR))
        if largo < SR:
            break
        t = np.linspace(0, 1, largo)
        subida = rng.uniform(0.28, 0.42)          # cuánto tarda en crecer
        env = np.where(t < subida,
                       (t / subida) ** 2,
                       np.exp(-(t - subida) * rng.uniform(3.5, 5.5)))
        fuerza = rng.uniform(0.6, 1.0)
        salida[ini:ini + largo] += rumor[ini:ini + largo] * env * fuerza
        # La espuma llega justo después de la cresta, no a la vez.
        env_esp = np.roll(env, int(0.25 * largo)) ** 2.5
        salida[ini:ini + largo] += burbuja[ini:ini + largo] * env_esp * espuma * fuerza
        t_ola += rng.uniform(cada_min, cada_max)
    return salida / (np.max(np.abs(salida)) + 1e-9)


def guardar(nombre, x, volumen=0.55):
    fade = int(2.0 * SR)
    x = x.copy() * volumen
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(nombre, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
    print(nombre)


if __name__ == '__main__':
    # --- Tres lluvias, de más lejana a más presente -------------------------
    guardar('lluvia-1-tras-la-ventana.wav',
            lluvia(20, cuerpo_hz=700, agudo=0.06, gotas_seg=5, hondura=0.30))
    guardar('lluvia-2-sobre-el-tejado.wav',
            lluvia(20, cuerpo_hz=1100, agudo=0.13, gotas_seg=22, hondura=0.22, semilla=40))
    guardar('lluvia-3-en-el-bosque.wav',
            lluvia(20, cuerpo_hz=1600, agudo=0.20, gotas_seg=40, hondura=0.16, semilla=70))

    # --- Tres mares --------------------------------------------------------
    guardar('olas-1-orilla-tranquila.wav',
            olas(30, cada_min=7.0, cada_max=11.0, profundidad=520, espuma=0.16))
    guardar('olas-2-mar-de-fondo.wav',
            olas(30, cada_min=9.0, cada_max=14.0, profundidad=340, espuma=0.07, semilla=55))
    guardar('olas-3-rompiente.wav',
            olas(30, cada_min=5.0, cada_max=8.0, profundidad=700, espuma=0.34, semilla=88))
