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
| **IndexedDB (Dexie)** | Base de datos dentro del móvil | Trabajar sin cobertura (parte 4) |
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
- [ ] **Parte 2 · Socios**: listado con buscador, ficha del socio, alta, edición y baja.
- [ ] **Parte 3 · Fincas**: ficha completa, varios recintos SIGPAC, tipo de invernadero,
  superficie en ha y m², cultivo, campaña, certificaciones, fotos y última visita.
- [ ] **Parte 4 · Sin conexión**: copia de los datos en el móvil, cola de cambios pendientes
  y sincronización automática al recuperar cobertura.
- [ ] **Parte 5 · Mapa**: ortofoto PNOA + capa SIGPAC, contornos de las fincas, buscar
  parcela, «¿dónde estoy?» con su referencia SIGPAC y botón «Cómo llegar».
- [ ] **Parte 6 · Informes**: filtros por socio, municipio, cultivo, tipo y certificación;
  totales por cultivo; exportar a Excel.
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
   - **Branch to deploy**: `main`
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
| Gestionar usuarios (rol, dar o quitar acceso) | — | ✅ |

Estas reglas están en la propia base de datos (no solo en la app), así que se cumplen
siempre. Se pueden cambiar fácilmente en `supabase/01_esquema.sql`, sección 6.

Nada se borra de verdad: se marca como «eliminado» para que el borrado llegue también a
los móviles que estaban sin conexión, y se puede recuperar desde Supabase si hace falta.

---

## Costes

| Servicio | Plan gratuito | Cuándo pasar a pago |
|---|---|---|
| **Supabase** | 0 €: 500 MB de datos y 1 GB de fotos. El proyecto se **pausa si pasa una semana sin uso** (se reactiva con un clic). | En producción se recomienda el plan **Pro (25 $/mes)**: copias de seguridad diarias y sin pausas. |
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
├── public/                    Iconos de la app
├── supabase/
│   ├── 01_esquema.sql         La base de datos completa (tablas y reglas de seguridad)
│   └── pruebas/               Prueba automática de las reglas de seguridad
└── src/                       El código de la app
    ├── main.tsx               Punto de arranque
    ├── App.tsx                Mapa de pantallas (qué se ve en cada dirección)
    ├── index.css              Colores y estilos generales
    ├── config.ts              Lee las claves de Supabase y el nombre de la OP
    ├── auth/                  Inicio de sesión y perfil del usuario
    ├── components/            Piezas reutilizables: botones, campos, menú, cabecera…
    ├── hooks/                 Utilidades: ¿hay conexión?, ¿se puede instalar?
    ├── lib/                   Conexión con Supabase, tipos de datos, mensajes de error
    └── pages/                 Las pantallas: acceso, inicio, socios, fincas, mapa, más…
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
npm run prueba:bd            # prueba del esquema y de los permisos en un PostgreSQL en memoria
```
