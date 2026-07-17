# Desplegar Aplicca en Vercel + Supabase

Esta guía asume que ya tienes (o vas a crear) una cuenta gratuita en
[supabase.com](https://supabase.com) y en [vercel.com](https://vercel.com).
Ninguno de estos pasos los puede hacer Claude por ti — requieren tus propias
credenciales.

## Parte 1 — Supabase (backend)

1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Ponle un nombre (por ejemplo `aplicca`), elige una contraseña de base de
   datos segura (guárdala), y la región más cercana a México
   (`us-east-1` o similar).
3. Espera 1-2 minutos a que el proyecto termine de crearse.
4. Ve a **SQL Editor** (ícono de la izquierda) → **New query**.
5. Abre el archivo `supabase/schema.sql` de este proyecto, copia **todo** su
   contenido, pégalo en el editor, y dale **Run**.
   - Deberías ver "Success. No rows returned".
   - Ve a **Table Editor** para confirmar que aparecieron las tablas:
     `profiles`, `candidate_profiles`, `company_profiles`, `jobs`,
     `applications`, `messages`, `saved_searches`, `subscriptions`, `reports`.
6. Ve a **Project Settings** (ícono de engrane) → **API**.
   - Copia el valor de **Project URL**.
   - Copia el valor de **anon public** (la llave pública, NO la `service_role`).
7. Abre `js/supabase-client.js` en este proyecto y reemplaza:
   ```js
   var SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
   var SUPABASE_ANON_KEY = 'TU-ANON-KEY-AQUI';
   ```
   con los valores que copiaste.
8. (Opcional pero recomendado) En **Authentication → Providers**, confirma
   que "Email" esté habilitado. Por defecto Supabase exige confirmar el
   correo antes de poder iniciar sesión — puedes desactivar esa exigencia en
   **Authentication → Settings → Email Auth** mientras pruebas, y
   reactivarla antes de lanzar con usuarios reales.

## Parte 2 — Vercel (frontend)

**Opción A — Sin usar terminal (recomendada si no usas Git seguido):**

1. Sube la carpeta completa de este proyecto a un repositorio nuevo en
   GitHub (puedes arrastrar los archivos directo en github.com → New
   repository → "uploading an existing file").
2. Entra a [vercel.com](https://vercel.com) → **Add New** → **Project**.
3. Conecta tu cuenta de GitHub y elige el repositorio que acabas de crear.
4. Vercel detecta que es un sitio estático automáticamente — no necesitas
   cambiar ninguna configuración de build. Dale **Deploy**.
5. En 1-2 minutos tendrás una URL pública (`algo.vercel.app`).

**Opción B — Con Vercel CLI (si tienes Node.js instalado):**

```bash
npm install -g vercel
cd aplicca-prototipo
vercel
```

Sigue las instrucciones en pantalla (te pedirá iniciar sesión la primera
vez). Al terminar te da la URL pública.

## Qué SÍ funciona de verdad después de esto

- Registro de candidato (crea usuario real en Supabase Auth + su fila en
  `candidate_profiles`)
- Registro de empresa (igual, con su fila en `company_profiles`)
- Login con correo y contraseña, que redirige al dashboard correcto según
  el rol guardado en la base de datos
- Cerrar sesión de verdad

## Qué sigue siendo simulación (a propósito, por ahora)

Todo lo demás — buscar vacantes, el kanban de candidatos, mensajes,
notificaciones, planes, etc. — sigue funcionando como maqueta visual, sin
leer ni escribir en Supabase todavía. Es información falsa fija en el HTML,
no viene de la base de datos.

**Sugerencia de orden para seguir conectando** (de más a menos crítico):
1. Publicar vacante (`INSERT` en `jobs`) + Buscar vacantes (`SELECT` de
   `jobs` con status = 'activa')
2. Postularme (`INSERT` en `applications`) + Mis postulaciones (`SELECT`
   filtrado por `candidate_id`)
3. Candidatos recibidos / kanban (`SELECT` de `applications` filtrado por
   las vacantes de esa empresa, `UPDATE` de `status` al arrastrar tarjetas)
4. Mensajería (`INSERT`/`SELECT` en `messages`)
5. Todo lo demás (planes, analítica, moderación, etc.)

Cuando quieras seguir con el punto 1, dile a Claude "conecta publicar
vacante y buscar vacantes a Supabase" y seguimos desde ahí.
