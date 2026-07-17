# Arquitectura — Aplicca

> Este documento describe la arquitectura objetivo para la implementación real de
> Aplicca. El prototipo actual (`index.html` + `css/` + `js/`) es una maqueta
> estática de frontend — sin backend, base de datos ni servidor — pensada para
> validar flujos y diseño antes de construir el sistema descrito aquí, por
> ejemplo con Claude Code.

## 1. Separación de dominios

El sistema se divide en tres dominios con responsabilidades y permisos
independientes, reflejando lo que el prototipo ya distingue visualmente
(candidato / empresa / admin):

| Dominio | Responsabilidad | Quién accede |
| --- | --- | --- |
| **Candidatos** | Perfil, CV, búsqueda, postulaciones, alertas | Usuario candidato |
| **Empleadores** | Vacantes, candidatos recibidos, entrevistas, facturación | Usuario empresa |
| **Administración** | Moderación de vacantes, verificación de empresas, métricas de plataforma | Equipo interno de Aplicca únicamente |

Cada dominio debe tener sus propios límites de autorización a nivel de API —
un candidato nunca debe poder alcanzar endpoints de empleador o admin cambiando
parámetros, y viceversa (ver `SECURITY.md`, sección IDOR).

## 2. Motor de búsqueda

Búsqueda y filtrado de vacantes (puesto, ubicación, salario, modalidad,
categoría) mediante **Elasticsearch u OpenSearch**, no consultas directas a la
base transaccional:

- Índice de vacantes actualizado por evento (al publicar/editar/cerrar una
  vacante) en vez de reindexado completo periódico.
- Autocompletado y tolerancia a errores tipográficos en el buscador de puesto.
- Filtros combinables (los chips que ya existen en el prototipo — "Salario",
  "Modalidad", "Categoría" — deben traducirse a filtros reales del índice).

## 3. Motor de matching / recomendación

Sistema separado del motor de búsqueda, responsable de:

- Sugerencias de vacantes en el dashboard del candidato ("Sugerencias para
  ti", ya maquetado en el prototipo).
- El **AI Match Score** que ve la empresa en el detalle de cada candidato.
- Debe poder explicar el match (qué coincide, qué no) — no solo dar un
  porcentaje ciego, como ya se muestra en la maqueta ("habilidades verificadas
  vs. detectadas por IA").

## 4. Notificaciones desacopladas

Las alertas de empleo (email/WhatsApp/push) **no se envían de forma síncrona**
desde el request que las origina. Arquitectura recomendada:

```
Evento (nueva vacante, cambio de estatus, mensaje nuevo)
  → Cola (SQS, RabbitMQ, o similar)
    → Worker de envío (respeta límites de la Cloud API de WhatsApp,
      reintentos, backoff exponencial)
```

Esto evita que un pico de registros o de vacantes nuevas sature el sistema
principal, y permite reintentar envíos fallidos sin bloquear al usuario.

## 5. Diseño para picos de tráfico

Las bolsas de trabajo tienen estacionalidad marcada (temporadas de
contratación, crisis económicas que disparan registros). Recomendaciones:

- Autoescalado horizontal en la capa de aplicación (contenedores/Kubernetes o
  equivalente gestionado).
- Cache de resultados de búsqueda frecuentes (Redis) para no golpear
  Elasticsearch en cada request idéntico.
- Colas con capacidad de absorber ráfagas (ver punto 4) en vez de que el pico
  golpee directo la base de datos.

## 6. CDN para estáticos y documentos

- Assets del frontend (CSS, JS, imágenes) servidos vía CDN — el prototipo ya
  separa `assets/` del resto del código, lo que facilita este paso.
- CVs y logos de empresa **no se sirven como archivos públicos directos**:
  viven en almacenamiento tipo S3 con URLs firmadas y de corta duración (ver
  `SECURITY.md`, sección de archivos subidos e IDOR).

## 7. Backend

- **Parseo de CV**: extracción de habilidades/experiencia al subir un CV
  (texto plano vía librería de parseo de PDF/DOCX, opcionalmente enriquecido
  con un modelo de lenguaje) — alimenta tanto el perfil del candidato como el
  motor de matching.
- **API para integraciones con ATS**: endpoint documentado (OpenAPI/Swagger)
  para que empresas grandes con su propio sistema de reclutamiento puedan
  sincronizar vacantes y candidatos sin usar la interfaz web.
- **Modelo de datos** con separación clara entre `candidate_profiles`,
  `company_profiles`, `jobs`, `applications` — ya definido a nivel conceptual
  en las etapas tempranas de este proyecto — y **permisos a nivel de fila**
  (Row-Level Security), no solo checks a nivel de aplicación. Ver
  `SECURITY.md` para el porqué.
- **Colas** para el envío masivo de alertas (punto 4).

## 8. Frontend

- Flujos de UX distintos para candidato vs. empleador — ya resuelto en el
  prototipo (pantallas y navegación separadas para cada rol).
- Diseño **mobile-first** — el prototipo ya incluye una hoja de estilos
  responsive completa como base.
- Dashboards de seguimiento (postulaciones para candidato, gestión de
  vacantes/candidatos para empleador) — ya maquetados.
- **Accesibilidad (WCAG)**: el prototipo ya tiene `aria-label` en todos los
  botones de solo ícono. Pendiente para la implementación real: asociación
  formal `label for=/id=` en los ~50 campos de formulario (en el mockup
  estático los labels son solo visuales), contraste de color verificado
  contra WCAG AA, y navegación completa por teclado.

## 9. Estructura de carpetas de referencia (backend + frontend)

```
aplicca/
├── apps/
│   ├── web/                 # Frontend (evolución de este prototipo)
│   └── api/                 # Backend (dominio candidatos/empresas/admin separados)
├── packages/
│   └── shared-types/        # Contratos compartidos frontend/backend
├── infra/
│   ├── search/               # Config de Elasticsearch/OpenSearch
│   └── queues/                # Config de colas de notificaciones
└── docs/
    ├── ARCHITECTURE.md        # Este documento
    └── SECURITY.md
```
