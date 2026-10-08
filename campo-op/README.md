# Campo OP · Socios y fincas

Aplicación para los técnicos de campo de una OPFH de Almería: socios, fincas, referencias
SIGPAC, mapa con ortofoto y trabajo sin conexión en el campo.

- **Una sola app web** que funciona en ordenador y en móvil, y que se instala en el móvil
  como una app más (PWA).
- **Funciona sin cobertura**: guarda los datos en el móvil y los envía cuando vuelve la red.
- **Datos y usuarios en la nube** con Supabase.
- Todo en español.

---

## Cómo está hecha (explicado sin tecnicismos)

| Pieza | Qué es | Para qué la usamos |
|---|---|---|
| **React + Vite** | Herramientas para construir la app | Las pantallas, botones y formularios |
| **Tailwind CSS** | Sistema de estilos | El diseño: colores, tamaños, móvil y ordenador |
| **PWA** | «Progressive Web App» | Que se instale en el móvil y abra sin conexión |
| **Supabase** | Base de datos en la nube | Guardar socios, fincas, fotos y usuarios |
| **IndexedDB (Dexie)** | Base de datos dentro del móvil | Trabajar sin cobertura y sincronizar después |
| **Leaflet** | Librería de mapas | Ortofoto PNOA y capa SIGPAC (parte 5) |
| **Netlify** | Alojamiento web | Publicar la app en internet con una dirección propia |

Los mapas y las referencias SIGPAC salen de servicios **públicos y gratuitos** del Estado:

- Ortofoto **PNOA** del Instituto Geográfico Nacional (`www.ign.es/wmts/pnoa-ma`).
- **SIGPAC** del FEGA (`sigpac-hubcloud.es`): capa de recintos, consulta de un recinto por
  coordenadas y búsqueda por provincia/municipio/polígono/parcela.

---

## Plan por partes

- [x] **Parte 1 · Cimientos**: proyecto, diseño, app instalable, base de datos completa con
  reglas de seguridad, inicio de sesión, roles, recuperar contraseña y gestión de usuarios.
- [x] **Parte 2 · Socios**: listado con buscador, ficha del socio, alta, edición, baja y
  eliminación. Incluye ya la **base del modo sin conexión**: todo se guarda primero en el
  móvil y se sincroniza solo con Supabase (ver «Cómo funciona sin conexión»).
- [x] **Parte 3 · Fincas**: listado con buscador y filtros (socio, municipio, cultivo, tipo
  y certificación), ficha completa, varios recintos SIGPAC con su contorno (por referencia
  o desde la posición del GPS), tipo de invernadero, superficie en ha y m², cultivo,
  campaña, certificaciones, punto GPS con «Cómo llegar», fotos (también sin cobertura) y
  fecha de la última visita.
- [ ] **Parte 4 · Sin conexión, remate**: descargar zonas del mapa de antemano para usarlas
  sin red (ahora solo se ve lo que ya se había mirado) y pruebas en el campo con móviles reales.
- [x] **Parte 5 · Mapa**: ortofoto PNOA + capa SIGPAC, contornos de las fincas, buscar
  parcela, «Mi posición» con su referencia SIGPAC, tocar un recinto para consultarlo,
  crear una finca desde un recinto y botón «Cómo llegar» (ver «El mapa»).
- [x] **Parte 6 · Informes**: totales por cultivo, municipio, certificación y tipo de finca
  (con filtros por campaña, tipo y socios de baja), cada fila lleva a su lista de fincas, y
  exportación a **Excel (.xlsx)** del informe y de los listados (ver «Informes y Excel»).
- [ ] **Parte 7 · Remate**: alta de técnicos desde la app, correo propio para los emails,
  pruebas en móviles reales y puesta en producción.

---

## Puesta en marcha (lo que tienes que hacer tú)

### Paso 1 · Crear el proyecto en Supabase

1. Entra en <https://supabase.com> y pulsa **Start your project**. Puedes registrarte con tu
   cuenta de GitHub.
2. Pulsa **New project** y rellena:
   - **Name**: `campo-op`
   - **Database Password**: pulsa *Generate a password* y **guárdala** en un sitio seguro.
   - **Region**: una de Europa, por ejemplo **West EU (Ireland)** o **Central EU (Frankfurt)**.
     Así los datos personales de los socios se quedan en la Unión Europea (RGPD).
3. Pulsa **Create new project** y espera un par de minutos.

### Paso 2 · Crear la base de datos

1. En el menú de la izquierda entra en **SQL Editor**.
2. Pulsa **New query**.
3. Abre el archivo [`supabase/01_esquema.sql`](supabase/01_esquema.sql), copia **todo** su
   contenido y pégalo.
4. Pulsa **Run**. Debe aparecer *Success. No rows returned*.

> Se puede ejecutar varias veces sin problema. En las próximas partes, si cambia, solo
> habrá que volver a pegarlo.

### Paso 3 · Cerrar el registro libre

Así nadie de fuera puede crearse una cuenta: los usuarios los das de alta tú.

1. Entra en **Authentication → Sign In / Providers**.
2. Desactiva **Allow new users to sign up** y guarda.

### Paso 4 · Crear tu usuario (serás el administrador)

1. Entra en **Authentication → Users**.
2. Pulsa **Add user → Create new user**.
3. Escribe tu email y una contraseña, marca **Auto Confirm User** y pulsa **Create user**.

El **primer usuario** que se crea pasa a ser **administrador** automáticamente. Los
siguientes se crean como **técnicos** (puedes cambiarlo luego desde la app).

### Paso 5 · Copiar las dos claves de conexión

1. Entra en **Project Settings → API Keys** y copia la **Publishable key**
   (empieza por `sb_publishable_…`).
2. Entra en **Project Settings → Data API** y copia la **Project URL**
   (algo como `https://abcdefgh.supabase.co`).

> ⚠️ La *publishable key* es pública por diseño y puede ir dentro de la app. **Nunca**
> compartas ni pegues en ningún sitio la **secret key** (o *service_role*): esa da acceso
> total a la base de datos.

### Paso 6 · Publicar la app en Netlify

1. Entra en <https://www.netlify.com> y regístrate con tu cuenta de GitHub.
2. Pulsa **Add new project → Import an existing project → GitHub** y elige el repositorio.
3. En la configuración:
   - **Branch to deploy**: la rama donde está la app. Mientras no se apruebe y fusione el
     *pull request*, es `ccr-d049b388-v927do`; después, la rama principal del repositorio.
   - **Base directory**: `campo-op`
   - El resto (*build command* y *publish directory*) se rellena solo.
4. En **Environment variables** añade estas tres:

   | Nombre | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | la Project URL del paso 5 |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | la Publishable key del paso 5 |
   | `VITE_NOMBRE_OP` | el nombre de tu OP, p. ej. `OPFH Campo de Dalías` |

5. Pulsa **Deploy**. En un minuto tendrás una dirección del tipo
   `https://campo-op.netlify.app` (se puede cambiar en *Site configuration → Change site name*).

> **Alternativa sin GitHub (para probar rápido):** si alguien te pasa la carpeta `dist` ya
> compilada (o un `.zip` con ella), entra en <https://app.netlify.com/drop>, arrástrala
> y Netlify te da una dirección al momento. Las claves del paso 5 ya van dentro de esa
> compilación. Sirve igual para el paso 7 y el paso 8.

### Paso 7 · Decirle a Supabase cuál es la dirección de la app

Necesario para que funcionen los enlaces de «He olvidado mi contraseña».

1. En Supabase entra en **Authentication → URL Configuration**.
2. **Site URL**: la dirección de Netlify (`https://campo-op.netlify.app`).
3. En **Redirect URLs** pulsa **Add URL** y añade `https://campo-op.netlify.app/**`.

> El servidor de correo que trae Supabase de serie solo envía unos pocos emails por hora y
> solo a los miembros del equipo de Supabase. En la parte 7 configuraremos un correo propio.
> Mientras tanto, si un técnico olvida su contraseña, el administrador puede ponerle una
> nueva en **Authentication → Users → (el usuario) → Reset password / Update user**.

### Paso 8 · Instalarla en el móvil

- **Android (Chrome)**: abre la dirección → menú **⋮** → **Instalar aplicación**. También
  aparece un botón en la app, en **Más → Instalar la app**.
- **iPhone (Safari)**: abre la dirección → botón **Compartir** → **Añadir a pantalla de inicio**.

---

## Quién puede hacer qué

| Acción | Técnico | Administrador |
|---|:---:|:---:|
| Ver socios, fincas, mapa y fotos | ✅ | ✅ |
| Editar datos de socios | ✅ | ✅ |
| Dar de alta socios nuevos | — | ✅ |
| Crear y editar fincas, recintos SIGPAC y fotos | ✅ | ✅ |
| Quitar recintos o fotos de una finca | ✅ | ✅ |
| Eliminar socios o fincas | — | ✅ |
| Ver informes y exportar a Excel el informe y la lista de fincas | ✅ | ✅ |
| Exportar a Excel la lista de socios (lleva NIF, teléfonos y correos) | — | ✅ |
| Gestionar usuarios (rol, dar o quitar acceso) | — | ✅ |

Estas reglas están en la propia base de datos (no solo en la app), así que se cumplen
siempre. Se pueden cambiar fácilmente en `supabase/01_esquema.sql`, sección 6.

Si un técnico intenta algo que no le corresponde, la app ni siquiera le muestra el botón.

Nada se borra de verdad: se marca como «eliminado» para que el borrado llegue también a
los móviles que estaban sin conexión, y se puede recuperar desde Supabase si hace falta.

---

## Cómo funciona sin conexión

1. La app guarda **una copia de los datos de la OP dentro del móvil**. La primera vez que
   alguien entra en un dispositivo hace falta cobertura para descargarla.
2. Todo lo que se guarda (un socio nuevo, un teléfono corregido…) se escribe **primero en
   el móvil**, al instante, y se apunta en una lista de **cambios pendientes**.
3. En cuanto hay conexión, la app **envía los pendientes** a Supabase y **descarga** lo que
   hayan cambiado los demás. Lo hace sola: al abrir la app, al volver la cobertura, unos
   segundos después de guardar y cada cinco minutos.
4. Si dos personas cambian **campos distintos** del mismo socio, se conservan los dos
   cambios. Si cambian el **mismo campo**, se queda el último que llega al servidor.
5. Si el servidor **rechaza** un cambio (por ejemplo, dos altas sin conexión con el mismo
   código de socio), aparece en **Más → Sincronización** con el motivo, para reintentarlo o
   descartarlo. El resto de cambios siguen enviándose.

En la cabecera siempre se ve el estado: «Sin conexión», «3 sin enviar», «Sincronizando» o
«1 con error». Si no se ve nada, es que todo está al día.

Al **cerrar sesión** se borran los datos del móvil. Si quedan cambios sin enviar, la app
avisa antes.

### Fotos

- Las fotos se **reducen** a 1.600 píxeles de lado al hacerlas (de 4-8 MB a unos 200-400 KB)
  y se guardan en el móvil al instante.
- Se **suben** a Supabase en cuanto hay conexión; hasta entonces llevan un icono naranja de
  «pendiente de subir». Si el servidor rechaza una subida, aparece en **Más → Sincronización**
  para reintentarla.
- Las fotos de otros compañeros se descargan **al abrir la finca** y quedan guardadas, así que
  las que ya has visto se siguen viendo sin cobertura.
- Al eliminar una foto desaparece de la ficha, pero el archivo se conserva en Supabase
  (Storage → `fotos`) por si hay que recuperarla.

## Recintos SIGPAC

Los recintos se consultan al servicio público del SIGPAC (FEGA), que **necesita conexión**:

- **Por referencia**: provincia, municipio, polígono y parcela. Si no se indica el recinto, la
  app enseña todos los de la parcela para marcar los de la finca.
- **Desde mi posición**: usa el GPS y busca el recinto en el que estás.

De cada recinto se guardan la superficie, el uso SIGPAC (p. ej. «IV · Invernaderos») y el
**contorno**, que servirá para dibujarlo en el mapa (parte 5). Si la finca no tenía
superficie ni municipio, se rellenan con los del primer recinto.

El servicio del SIGPAC a veces corta la conexión: la app reintenta sola tres veces antes de
avisar.

---

## El mapa

Se abre desde la pestaña **Mapa**, desde **«Ver en el mapa»** en la ficha de una finca o de un
socio, desde el botón **Mapa** del listado de fincas (lleva los filtros que tengas puestos) y
desde **«¿Dónde estoy?»** del inicio (que además te localiza al abrir).

- **Fondo**: la ortofoto del PNOA (por defecto) o el mapa de calles del IGN. Encima, las líneas de
  los **recintos SIGPAC** en magenta, como en el visor oficial. Todo se cambia desde el botón de
  capas (arriba a la derecha) y se recuerda.
- **Fincas**: se dibuja el contorno de sus recintos (de lejos, un punto por finca). Las que solo
  tienen punto GPS salen como un punto. Al tocar una, aparece su tarjeta con **Ver ficha** y
  **Cómo llegar**. Las fincas sin recinto ni GPS no salen: el panel de capas dice cuántas faltan.
- **Mi posición** (botón verde): marca dónde estás con su precisión y consulta en qué recinto SIGPAC
  te encuentras, a qué finca pertenece (si es de alguna) y permite **crear una finca** con él.
- **Tocar el mapa** (con el zoom cerca) consulta el recinto que hay en ese punto, igual que el
  visor SIGPAC.
- **Buscar parcela**: municipio, polígono y parcela (y recinto, si se quiere). Dibuja todos los
  recintos de la parcela y dice cuáles ya están en alguna finca.
- **Cómo llegar** abre Google Maps con la ruta hasta el centro del recinto o el punto GPS.

**Sin conexión** se siguen viendo y eligiendo las fincas (están en el móvil), y el fondo solo donde
ya se había mirado antes: las teselas visitadas se guardan en el móvil. Consultar el SIGPAC
(tocar el mapa, mi posición, buscar parcela) **necesita cobertura**. Descargar zonas de antemano
llegará en la parte 4.

Los datos del mapa son de servicios públicos: ortofoto y mapa base © Instituto Geográfico Nacional
(PNOA, licencia CC BY 4.0) y recintos © FEGA, Ministerio de Agricultura (SIGPAC). La app muestra esa
atribución en el panel de capas.

---

## Informes y Excel

Se abren desde **Inicio → Informes** o **Más → Informes y Excel**.

- **Resumen**: socios con fincas, número de fincas y hectáreas. Por defecto cuenta solo las
  fincas de socios **activos** (las mismas cifras que el Inicio); «Incluir socios de baja» las
  suma todas. También se puede filtrar por **campaña** y por **tipo de finca**.
- **Totales por** cultivo, municipio, certificación o tipo de finca: fincas, socios y hectáreas de
  cada uno, con su parte sobre el total. «Tomate», «tomate» y «Tómate» cuentan como el mismo
  cultivo (se muestra la forma más usada). La fila «Sin…» agrupa las fincas a las que les falta
  ese dato. Una finca con varias certificaciones cuenta en cada una (las filas de certificación
  no suman el total, y la app lo avisa).
- **Pulsar una fila** abre la lista de fincas con esos mismos filtros (cultivo, campaña, solo
  socios activos…), que se pueden ajustar y también exportar.
- **Botón Excel** (icono verde de la cabecera):
  - en **Informes**: un libro con las hojas *Resumen*, *Por cultivo*, *Por municipio*, *Por
    certificación*, *Por tipo de finca* y *Detalle de fincas* (una fila por finca);
  - en **Fincas**: la lista tal como la estás viendo (con búsqueda y filtros);
  - en **Socios** (solo administradores): la lista de socios con sus datos de contacto y las
    hectáreas que llevan.

  En el móvil el archivo se descarga (o, en iPhone, se abre la hoja de «Compartir» para
  guardarlo en *Archivos* o enviarlo por correo o WhatsApp). Funciona **sin conexión**, porque
  los datos están en el móvil.

> **Protección de datos:** la lista de socios incluye NIF, teléfono y correo. Por eso solo la
> pueden sacar a un archivo los administradores. Los técnicos sí ven esos datos en la ficha de
> cada socio (así lo pide el trabajo de campo). Si preferís otro criterio, se cambia en
> `src/pages/socios/ListaSocios.tsx`.

---

## Costes

| Servicio | Plan gratuito | Cuándo pasar a pago |
|---|---|---|
| **Supabase** | 0 €: 500 MB de datos y 1 GB de fotos (unas 3.000-4.000 fotos reducidas). El proyecto se **pausa si pasa una semana sin uso** (se reactiva con un clic). | En producción se recomienda el plan **Pro (25 $/mes)**: copias de seguridad diarias y sin pausas. |
| **Netlify** | 0 € para una app de este tamaño (uso comercial permitido). | No debería hacer falta. |
| **Mapas PNOA y SIGPAC** | Gratuitos (servicios públicos). | — |

---

## Estructura del proyecto

```
campo-op/
├── index.html                 Página de entrada de la app
├── netlify.toml               Ajustes para publicar en Netlify
├── vite.config.ts             Ajustes de la app instalable (nombre, icono, modo sin conexión)
├── .env.example               Plantilla de las claves de Supabase
├── public/                    Iconos de la app y reglas de publicación (_redirects, _headers)
├── supabase/
│   ├── 01_esquema.sql         La base de datos completa (tablas y reglas de seguridad)
│   └── pruebas/               Prueba automática de las reglas de seguridad
├── pruebas/                   Prueba de la app completa contra un Supabase local
└── src/                       El código de la app
    ├── main.tsx               Punto de arranque
    ├── App.tsx                Mapa de pantallas (qué se ve en cada dirección)
    ├── index.css              Colores y estilos generales
    ├── config.ts              Lee las claves de Supabase y el nombre de la OP
    ├── auth/                  Inicio de sesión y perfil del usuario
    ├── components/            Piezas reutilizables: botones, campos, menú, cabecera…
    ├── hooks/                 Utilidades: ¿hay conexión?, ¿se puede instalar?, exportar a Excel
    ├── datos/                 Base de datos del móvil y sincronización con Supabase
    ├── mapa/                  Mapa (Leaflet): capas PNOA y SIGPAC, dibujo de las fincas
    ├── lib/                   Conexión con Supabase, tipos, validación de NIF, formatos
    └── pages/                 Las pantallas: acceso, inicio, socios, fincas, mapa, informes, más…
```

### Cambiar el color de la app

Los colores están en `src/index.css` (bloque `@theme`). Cambiando los valores
`--color-marca-…` por el color corporativo de la OP, toda la app se adapta.

---

## Para quien programe

Requisitos: Node.js 22.

```bash
cd campo-op
npm install
cp .env.example .env.local   # y rellenar las claves
npm run dev                  # app en http://localhost:5173
npm run build                # comprobación de tipos + versión de producción en dist/
npm run lint                 # revisión del código
npm test                     # pruebas unitarias (validación de NIF, formatos…)
npm run prueba:bd            # prueba del esquema y de los permisos en un PostgreSQL en memoria
```

La prueba de la app completa contra un Supabase local está explicada en
[`pruebas/README.md`](pruebas/README.md).
