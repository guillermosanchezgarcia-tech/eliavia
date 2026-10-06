# Comunidad Fácil

Aplicación web para llevar la **contabilidad de comunidades de propietarios en España**, con dos caras:

- **Panel de administración** (administrador de fincas o propietario que administra): inmuebles, propietarios, presupuestos,
  cuotas, recibos, cobros, gastos con factura escaneada, informes y fondo de reserva. Varias comunidades desde una misma cuenta.
- **Portal del propietario** (pensado para el móvil): su saldo, sus recibos y pagos, las facturas escaneadas de la comunidad,
  las cuentas y los documentos comunes.

> ⚠️ **Aviso:** Comunidad Fácil es una herramienta de gestión. **No sustituye el asesoramiento de un administrador de fincas
> colegiado** ni de un profesional jurídico o fiscal.

---

## Índice

1. [Qué necesitas](#1-qué-necesitas)
2. [Instalación paso a paso (Windows)](#2-instalación-paso-a-paso-windows)
3. [Usuarios de prueba](#3-usuarios-de-prueba)
4. [Qué puedes probar (MVP)](#4-qué-puedes-probar-mvp)
5. [Uso diario](#5-uso-diario)
6. [Publicar en Internet (Vercel)](#6-publicar-en-internet-vercel)
7. [Seguridad y protección de datos](#7-seguridad-y-protección-de-datos)
8. [Cómo cumple la Ley de Propiedad Horizontal](#8-cómo-cumple-la-ley-de-propiedad-horizontal)
9. [Tests](#9-tests)
10. [Estructura del proyecto](#10-estructura-del-proyecto)
11. [Próximas fases](#11-próximas-fases)
12. [Problemas frecuentes](#12-problemas-frecuentes)

---

## 1. Qué necesitas

| Herramienta | Para qué | Coste |
|---|---|---|
| [Node.js](https://nodejs.org/es) (versión **LTS**, 20 o superior) | Ejecutar la aplicación en tu ordenador | Gratis |
| [Git](https://git-scm.com/download/win) | Descargar el código de GitHub | Gratis |
| Cuenta en [Supabase](https://supabase.com) | Base de datos, usuarios y almacén de facturas | Plan gratuito |
| Cuenta en [Vercel](https://vercel.com) (solo para publicar) | Tener la web en Internet | Plan gratuito |

Al instalar Node.js en Windows, deja todas las opciones por defecto.

## 2. Instalación paso a paso (Windows)

### Paso 1 · Descargar el código

Abre **PowerShell** (menú Inicio → escribe «PowerShell») y ejecuta:

```powershell
cd $HOME\Documents
git clone https://github.com/guillermosanchezgarcia-tech/eliavia.git
cd eliavia\comunidades
```

> Mientras los cambios no estén unidos a la rama principal, añade `-b ccr-f714d974-9cflsl` al `git clone`.

### Paso 2 · Crear el proyecto en Supabase

1. Entra en [supabase.com](https://supabase.com) → **New project**.
2. Nombre: `comunidad-facil`. Escribe una **contraseña de base de datos** y guárdala (la necesitarás).
3. Región: elige una de **Europa** (p. ej. *Frankfurt* o *Paris*). Así los datos se quedan en la UE (RGPD).
4. Espera 1–2 minutos a que se cree.

### Paso 3 · Copiar las claves en el archivo de configuración

En PowerShell (dentro de `eliavia\comunidades`):

```powershell
copy .env.example .env.local
notepad .env.local
```

Rellena los cuatro valores (en Supabase, botón **Connect** arriba o **Project Settings**):

| Variable | Dónde se encuentra en Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → *Project URL* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API Keys → *anon public* (o *Publishable key*) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → *service_role* (o *Secret key*) — **es secreta** |
| `DATABASE_URL` | Botón **Connect** → *Session pooler* → copia la URI y cambia `[YOUR-PASSWORD]` por tu contraseña |

> Si tu contraseña tiene símbolos como `@`, `#` o `/`, es más fácil cambiarla en Supabase por una solo con letras y números.

Guarda el archivo y cierra el Bloc de notas.

### Paso 4 · Instalar, crear las tablas y cargar los datos de ejemplo

```powershell
npm install
npm run db:setup
```

`db:setup` crea todas las tablas, permisos y funciones (carpeta `supabase/migrations`) y carga la comunidad de ejemplo con sus
facturas escaneadas. Al terminar verás la lista de usuarios de prueba.

### Paso 5 · Arrancar la aplicación

```powershell
npm run dev
```

Abre en el navegador **http://localhost:3000**. Para pararla, pulsa `Ctrl + C` en PowerShell.

### Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca la aplicación en tu ordenador |
| `npm run db:migrate` | Aplica las migraciones nuevas (cuando actualices el código) |
| `npm run db:seed -- --reset` | Borra y vuelve a crear los datos de ejemplo |
| `npm run db:remove-demo` | Borra los datos de ejemplo (antes de trabajar con datos reales) |
| `npm test` | Ejecuta los tests |
| `npm run build` | Comprueba que todo compila para publicarlo |

## 3. Usuarios de prueba

Contraseña para todos: **`Comunidad2026!`**

| Usuario | Rol | Qué verá |
|---|---|---|
| `admin@example.com` | Administradora | Panel completo de las dos comunidades de ejemplo |
| `presidente@example.com` | Presidenta (2ºB) | Su portal + página «Presidencia» con estado de cuentas y deudores |
| `propietario1a@example.com` | Propietaria del 1ºA y Garaje 1 | Solo sus recibos y pagos + documentos comunes |
| `propietario2a@example.com` | Propietario del 2ºA y Garaje 3 | Ídem |

La comunidad de ejemplo, **«Comunidad de Propietarios Calle del Olmo, 14»** (ficticia), tiene:

- 12 viviendas (1ºA a 4ºC), 2 locales y 8 garajes, con coeficientes que suman 100 %.
- El 3ºC es **piso turístico** con un incremento del 20 % (art. 17.12 LPH).
- Repartos: coeficiente general, ascensor (solo viviendas), solo garajes y partes iguales.
- Presupuesto ordinario 2026 de 18.300 € (cuotas trimestrales), 4 trimestres de recibos emitidos y cobrados, salvo **3 morosos**.
- ~40 facturas de proveedores con su PDF «escaneado» (una de ellas, la del abogado, **restringida**).
- Un ingreso por alquiler de la azotea (antena) e intereses bancarios.
- Un pago con cargo al fondo de reserva (bajante) que deja el fondo **por debajo del 10 %** → verás el aviso.
- Cambio de titular del 1ºB en 2025 (histórico de titulares).
- Una segunda comunidad, «Residencial Los Pinos», para probar la gestión de varias comunidades.

En el primer acceso cada usuario debe **aceptar la política de privacidad**.

## 4. Qué puedes probar (MVP)

1. **Gasto con factura escaneada visible para el 1ºA**
   - Entra como `admin@example.com` → *Gastos y facturas* → **Nuevo gasto**.
   - Sube un PDF o una foto, elige proveedor y partida y escribe la base: el IVA, la retención y el total se calculan solos.
   - Sal y entra como `propietario1a@example.com` → pestaña **Facturas**: aparece y puedes abrir el documento.
   - Si marcas el gasto como **restringido**, el propietario no lo verá.
2. **Pago visible solo en el histórico de su propietario**
   - Como administradora → *Cobros* → registra un pago de *Pablo Herrero Ortega*.
   - Como `propietario2a@example.com` → **Mis pagos**: aparece. Como `propietario1a@example.com`: no aparece.
3. **Informe que cuadra con los movimientos**: *Informes* → desglose de ingresos y gastos por partida, por meses o trimestres,
   presupuesto frente a real, tesorería y deudores. Botones **Excel** e **Imprimir / PDF**.
4. **Fondo de reserva**: en *Resumen* e *Informes* verás el saldo separado, el mínimo legal (10 % del presupuesto) y el aviso
   de que está por debajo, con la reposición propuesta.
5. **Un propietario no puede ver datos de otro**: como `propietario1a@example.com`, intenta abrir
   `/admin/...` (te devuelve a tu portal) o un recibo de otro vecino en `/api/recibos/<id>/pdf` (error 404). Estos permisos los
   aplica la propia base de datos (RLS), no solo la pantalla.

Otras cosas que ya funcionan: alta de comunidades, inmuebles (con aviso si los coeficientes no suman 100 %), grupos y repartos
alternativos, propietarios con acceso al portal, cambio de titular, presupuestos y **derramas** con emisión de recibos
numerados, recibos en PDF, extracto por propietario, documentos (actas, estatutos…), configuración y registro de auditoría.

## 5. Uso diario

**Administración** (`/admin`):

1. *Configuración*: datos de la comunidad, cuentas bancarias, % del fondo de reserva (10 %, o 5 % en Cataluña), política de
   privacidad y otros administradores.
2. *Inmuebles*: identificador, tipo, coeficiente, grupos y uso turístico.
3. *Propietarios*: alta, acceso al portal (con contraseña inicial), nombramiento de presidente y cambio de titular.
4. *Partidas y repartos*: plan de partidas precargado, grupos («solo portal 2», «solo garajes»…) y repartos por coeficiente,
   partes iguales o coeficientes específicos.
5. *Presupuestos y derramas*: partidas → cuota por inmueble calculada automáticamente → aprobación en junta → **emitir recibos**
   de cada plazo.
6. *Cobros*: registra cada pago (transferencia, domiciliación, efectivo, Bizum). Se aplica a los recibos más antiguos.
7. *Gastos y facturas*: sube la factura, revisa importes, asigna partida y reparto, marca si se paga con el fondo de reserva.
8. *Informes*: exporta a Excel o imprime en PDF.

**Portal del propietario** (`/portal`): Inicio (saldo y próximo recibo), Mis pagos (con descarga del recibo en PDF), Facturas,
Cuentas (presupuesto, gráfico de gastos y fondo de reserva) y Documentos.

## 6. Publicar en Internet (Vercel)

1. Sube el código a tu GitHub (ya está en `guillermosanchezgarcia-tech/eliavia`).
2. Entra en [vercel.com](https://vercel.com) → **Add New… → Project** → importa el repositorio `eliavia`.
3. En **Root Directory** elige **`comunidades`** (¡importante!). Framework: Next.js (lo detecta solo).
4. En **Environment Variables** añade las mismas variables de tu `.env.local`, **salvo `DATABASE_URL`** (solo se usa desde tu ordenador):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.
5. Pulsa **Deploy**. En 1–2 minutos tendrás una dirección del tipo `https://comunidad-facil.vercel.app`.
6. En Supabase → **Authentication → URL Configuration**:
   - *Site URL*: tu dirección de Vercel.
   - *Redirect URLs*: añade `https://TU-DIRECCION.vercel.app/auth/callback`.
7. (Recomendado) En Supabase → *Authentication → Sign In / Providers → Email*, desactiva **«Allow new users to sign up»** cuando
   ya tengas tu cuenta de administrador: así nadie podrá registrarse por su cuenta (los propietarios los das de alta tú).

Cada vez que subas cambios a GitHub, Vercel publicará la nueva versión automáticamente. Si hay migraciones nuevas, ejecuta
`npm run db:migrate` desde tu ordenador.

**Antes de usarla con datos reales**: crea tu propia cuenta en `/registro`, da de alta tu comunidad y borra los datos de
ejemplo con `npm run db:remove-demo` (después elimina los usuarios `@example.com` en Supabase → *Authentication → Users*).

> El envío de emails de Supabase (enlace mágico) está limitado en el plan gratuito a unos pocos por hora. En la fase 3
> configuraremos un servidor de correo propio (SMTP).

## 7. Seguridad y protección de datos

- **Permisos en la base de datos (Row Level Security)**: cada consulta se filtra en PostgreSQL según el usuario conectado.
  Un propietario solo puede leer sus fichas, recibos y pagos; los documentos restringidos y la contabilidad interna solo los
  ven administración y presidencia. Aunque alguien manipule la web, la base de datos no le devuelve datos ajenos.
- **Facturas en almacenamiento privado**: se abren con URLs firmadas que caducan a los 5 minutos.
- **La relación de deudores nunca se publica en el portal**: solo la ven la administración y la presidencia (la AEPD sanciona
  su difusión). Se incluirá en la convocatoria de la junta (fase 2).
- **Documentos restringidos**: para facturas con datos personales de terceros (p. ej. el abogado de un monitorio).
- **Registro de auditoría**: cada alta, modificación o baja queda registrada con el usuario y la fecha (*Auditoría*).
- **Política de privacidad editable** por comunidad y aceptación obligatoria en el primer acceso. La comunidad es responsable
  del tratamiento y el administrador, encargado. El texto incluido es un modelo: revísalo.
- La clave `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor para crear cuentas de acceso. **No la compartas nunca.**

## 8. Cómo cumple la Ley de Propiedad Horizontal

> Referencia: Ley 49/1960, de Propiedad Horizontal, texto consolidado (BOE-A-1960-10906), con las reformas de la Ley 10/2022 y la
> LO 1/2025. **Durante el desarrollo no se pudo consultar el BOE desde el entorno de trabajo**: revisa con tu administrador de
> fincas o colegio profesional que las reglas siguientes coinciden con la redacción vigente.

| Tema | Cómo lo hace la aplicación |
|---|---|
| Cuota de participación (art. 5 y 9.1.e) | Cada inmueble tiene su coeficiente (4 decimales) y se avisa si no suman 100 %. Repartos alternativos: partes iguales, por grupos o coeficientes específicos por partida. |
| Redondeo | Importes siempre en céntimos (números enteros). El céntimo sobrante de un reparto va al inmueble de mayor coeficiente. |
| Fondo de reserva (art. 9.1.f y DA 1ª) | Saldo separado (cuenta contable 113). Mínimo = % configurable (10 %, 5 % en Cataluña) del **último presupuesto ordinario aprobado**, calculado sobre los gastos sin contar la propia aportación al fondo. Aviso si baja del mínimo y propuesta de reposición. |
| Presupuesto y cuentas (art. 14 y 20) | Presupuesto por partidas, aprobación en junta, comparativa presupuesto frente a real e informe de ingresos y gastos. |
| Morosidad (art. 15.2, 16 y 21) | Relación de deudores con antigüedad de la deuda (solo administración/presidencia). Certificados en la fase 2. |
| Transmisión (art. 9.1.e) | Histórico de titulares por inmueble. Certificado de estar al corriente en la fase 2. |
| Custodia documental (art. 19 y 20) | Archivo de actas, estatutos, pólizas, contratos y facturas a disposición de los propietarios. |
| Pisos turísticos (art. 17.12) | Marca «uso turístico» con incremento de hasta el 20 % que se aplica en todos los repartos de ese inmueble (los demás pagan proporcionalmente menos). |

**Decisiones de diseño que conviene validar con un profesional:**

- Los cobros de cada propietario se aplican a sus recibos por **orden de antigüedad** (el más antiguo primero).
- Los informes usan el **criterio de devengo**: las cuotas cuentan por la fecha del recibo y los gastos por la fecha de la factura.
- La IVA soportada se considera **gasto** (las comunidades normalmente no pueden deducirla).

**Contabilidad por debajo:** cada recibo, cobro y gasto genera automáticamente su asiento de partida doble (cuentas 430
Propietarios, 572 Bancos, 570 Caja, 400 Proveedores, 4751 Retenciones, 600 Gastos, 700 Ingresos, 113 Fondo de reserva, 120
Remanente). Los ejercicios cerrados no se pueden modificar: la base de datos lo impide.

**Datos fiscales**: cada factura guarda base, % y cuota de IVA, % y cuota de retención IRPF, total y líquido a pagar; los
proveedores indican si llevan retención y si son suministros (excluidos del modelo 347). La exportación para los modelos 347,
111/190 y 184 llegará en la fase 3.

## 9. Tests

```powershell
npm test
```

Ejecuta los tests de cálculo (reparto por coeficientes, redondeos, cuotas, fondo de reserva, importes y fechas).

Los tests de base de datos (permisos RLS: «un propietario no puede leer pagos de otro», saldos, asientos que cuadran, ejercicio
cerrado, auditoría…) necesitan un PostgreSQL **local de pruebas** y se activan con la variable `TEST_DATABASE_URL`
(p. ej. `postgresql://postgres@127.0.0.1:5432/postgres`). Crean una base de datos temporal y la borran al acabar.
**No apuntes nunca `TEST_DATABASE_URL` a tu base de datos de Supabase.**

## 10. Estructura del proyecto

```
comunidades/
├── supabase/migrations/      Migraciones SQL numeradas (tablas, lógica contable, permisos RLS, informes, almacenamiento)
├── scripts/
│   ├── migrate.ts            Aplica las migraciones pendientes (npm run db:migrate)
│   └── seed.ts               Datos de ejemplo (npm run db:seed)
├── src/
│   ├── app/admin/            Panel de administración
│   ├── app/portal/           Portal del propietario
│   ├── app/api/              Descarga de documentos, recibos en PDF y Excel
│   ├── components/           Componentes de interfaz (estilo shadcn/ui)
│   └── lib/                  Lógica: importes, fechas, reparto, cuotas, PDF, informes
└── tests/                    Tests (Vitest)
```

Tecnología: Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 + componentes estilo shadcn/ui · Supabase (PostgreSQL, Auth,
Storage, RLS) · pdf-lib (PDF) · ExcelJS (Excel) · Vitest (tests).

## 11. Próximas fases

**Fase 2**: lectura automática de facturas (OCR con la API de Claude, desactivable), importación de extractos bancarios
CSV/Excel y conciliación, devoluciones de recibos, certificados de deuda (art. 21) y de estar al corriente (art. 9.1.e) con
firma del secretario y VºBº del presidente, relación de deudores para la convocatoria, liquidación anual y propuesta de
presupuesto en PDF, solicitud de certificado desde el portal.

**Fase 3**: remesas SEPA (pain.008), Norma 43, datos para los modelos 347, 111/190 y 184, tablón de avisos, convocatorias,
actas e incidencias con foto, envío de emails y cierre de ejercicio con asientos de rectificación.

## 12. Problemas frecuentes

| Problema | Solución |
|---|---|
| `npm` no se reconoce | Instala Node.js y **cierra y vuelve a abrir** PowerShell. |
| `Falta DATABASE_URL` | No has creado `.env.local` o le falta ese valor (paso 3). |
| `password authentication failed` | La contraseña de `DATABASE_URL` no es correcta. Puedes cambiarla en Supabase → Project Settings → Database. |
| `No se pudo conectar con Supabase Auth` | Revisa `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. |
| Los datos de ejemplo ya existen | `npm run db:seed -- --reset` los vuelve a crear desde cero. |
| No me llega el enlace por email | El plan gratuito de Supabase limita los emails. Entra con contraseña. |
