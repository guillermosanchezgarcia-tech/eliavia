# Fluxoria — web comercial (v2)

Web de una sola página para **Fluxoria**, empresa de **automatización de procesos con IA para empresas**.

Evolución de la versión anterior: se conserva la identidad visual (fondo oscuro, azul/violeta,
gradientes, glassmorphism, partículas, grid en perspectiva, agente de IA, animaciones) y se
reescribe el contenido para que venda un servicio real de automatización.

## Archivos

```
index.html            La web completa (HTML + CSS + JS en un solo archivo)
robots.txt
sitemap.xml
assets/img/
  logo-mark.png       Marca Fluxoria con fondo transparente (nav y pie)
  logo-fluxoria.png   Logotipo completo con wordmark y tagline
  og-image.png        Imagen para redes sociales (1200 × 630)
  favicon-32.png      Favicon
  apple-touch-icon.png
  icon-512.png
```

No hay dependencias, build ni framework: se sube tal cual a cualquier hosting estático.

## Puesta en marcha

Subir el contenido del repositorio a la raíz del dominio. Para probar en local:

```bash
npx http-server -p 8000 .
# http://127.0.0.1:8000
```

## Conectar el formulario de contacto

El formulario funciona ya, sin backend: valida los campos y abre el programa de correo del
visitante con el mensaje redactado hacia `info@fluxoria.es`.

Para enviarlo a un backend propio, basta con indicar el endpoint en `index.html`:

```html
<form class="fx glass hud reveal" id="contactForm" data-endpoint="https://tu-endpoint/contacto" novalidate>
```

Recibirá un `POST` con `Content-Type: application/json` y este cuerpo:

```json
{
  "nombre":   "…",
  "empresa":  "…",
  "email":    "…",
  "telefono": "…",
  "proceso":  "…",
  "mensaje":  "…"
}
```

Si la respuesta es `2xx`, el formulario se limpia y muestra la confirmación. Si falla, se ofrece
el correo como alternativa.

## Antes de publicar

- **Dominio**: `index.html` usa `https://fluxoria.es/` en `canonical`, Open Graph, Twitter Cards
  y Schema.org, y `sitemap.xml`/`robots.txt` hacen lo mismo. Si el dominio final es otro, hay que
  sustituirlo en esos sitios.
- **Precios**: los planes de automatización (490 € / 890 € / a medida) se muestran siempre con
  «desde» y con una nota que aclara que el importe depende de la complejidad. Los precios de
  infraestructura (hosting, VPS, correo y dominios) están confirmados y se mantienen como están.

## Criterio de contenido

La web no incluye número de clientes, automatizaciones realizadas, años de experiencia,
testimonios, casos de éxito, porcentajes de mejora, horas ahorradas ni logos de clientes.
Fluxoria es una empresa nueva y la web está escrita para transmitir eso: pequeña,
especializada y seria. Cualquier dato que no se tenga se expresa con «desde», «según
necesidades» o «dependiendo de la integración».

La comparativa Antes/Después es **cualitativa**: las barras son un recurso visual y así se
indica al pie de la sección.

## Rendimiento y accesibilidad

- Los dos `canvas` (red de señales del hero y esfera del agente) se pausan cuando salen del
  viewport o la pestaña queda oculta, limitan el `devicePixelRatio` a 2 y reducen partículas en
  pantallas pequeñas.
- `prefers-reduced-motion: reduce` desactiva animaciones y transiciones: los `canvas` se pintan
  una sola vez en estático y todo el contenido queda visible.
- Las animaciones de entrada tienen un respaldo por scroll, de modo que ningún bloque puede
  quedarse invisible.
- Navegación por teclado con `:focus-visible`, enlace de salto al contenido, menú móvil con
  `aria-expanded` y cierre con `Escape`.
- Comprobado sin scroll horizontal entre 320 px y 1440 px.
