# Seguridad — Aplicca

> Igual que `ARCHITECTURE.md`: esto es la especificación de seguridad para la
> implementación real. El prototipo estático actual no maneja datos reales de
> usuarios, así que nada de esto aplica todavía en `index.html` — es la guía
> para cuando exista backend.

## 1. Por qué esto es delicado

Los CV contienen datos personales sensibles: nombre completo, domicilio,
teléfono, historial laboral, y a veces salario o identificaciones. Aplica:

- **LFPDPPP** (México) — protección de datos personales en posesión de
  particulares.
- **GDPR** — si hay usuarios en la Unión Europea.

Requisitos mínimos:

- Cifrado de datos en reposo (a nivel de disco/base de datos, no solo en
  tránsito).
- Control de acceso estricto a perfiles — nadie ve un CV o perfil que no le
  corresponde (ver sección IDOR).
- Mecanismo real de **derecho al olvido**: borrado efectivo de cuenta y CV,
  no solo un flag de "inactivo". El prototipo ya incluye la pantalla
  ("Eliminar mi cuenta" en Configuración) — falta la lógica real detrás.

## 2. IDOR (Insecure Direct Object Reference)

El problema clásico de bolsas de trabajo: un candidato o un tercero accede a
CVs o solicitudes ajenas solo cambiando un ID en la URL
(`/candidatos/1234` → `/candidatos/1235`).

**Esto se debe probar explícitamente**, no asumir que "no va a pasar":

- Todo endpoint que reciba un ID de recurso (perfil, postulación, CV, mensaje)
  debe verificar que el usuario autenticado tiene permiso sobre ese recurso
  específico — no solo que está autenticado.
- Preferir IDs no-secuenciales (UUID) sobre autoincrementales, como capa
  adicional (no sustituye la verificación de permisos, la complementa).
- Row-Level Security a nivel de base de datos como segunda barrera, para que
  incluso un bug en la lógica de aplicación no exponga datos de otro usuario.
- Estas pruebas deben ser parte del checklist de QA/seguridad antes de cada
  release, no un ejercicio único.

## 3. Archivos subidos (CVs en PDF/DOCX)

- **Verificar tipo real de archivo**, no solo la extensión (un `.pdf` puede
  no ser un PDF válido) — inspección de los primeros bytes del archivo
  (magic numbers), no solo el nombre.
- **Escaneo antimalware** en el pipeline de subida antes de almacenar o
  servir el archivo.
- **Cuidado con XXE** (XML External Entity) si se parsea el contenido de un
  `.docx` (que internamente es XML) — deshabilitar la resolución de entidades
  externas en el parser.
- Límite de tamaño (el prototipo ya lo comunica en la UI: "máximo 8 MB") debe
  aplicarse también en el servidor, no solo validarse en el navegador.
- Archivos servidos desde almacenamiento con URLs firmadas de corta duración,
  nunca como archivo público permanente (relacionado con IDOR: una URL
  firmada que expira limita el daño si se filtra un link).

## 4. Anti-scraping

Protección para que terceros no extraigan masivamente los datos de
candidatos o vacantes:

- Rate limiting por IP/cuenta en endpoints de listado y perfil.
- Detección de patrones de scraping (muchas requests secuenciales a IDs
  consecutivos, user-agents sospechosos).
- CAPTCHA o challenge similar si se detecta comportamiento automatizado.

## 5. Rate limiting y CAPTCHA en registro/login

- Limita intentos de login por IP y por cuenta (previene fuerza bruta).
- CAPTCHA en registro para reducir cuentas falsas — relevante también para
  el problema de vacantes fraudulentas (sección 6): cuentas de empresa falsas
  suelen crearse en volumen.

## 6. Vacantes fraudulentas

Vector de estafa muy común en bolsas de trabajo: publicar empleos falsos para
robar datos o dinero a candidatos. El prototipo ya modela la respuesta a
esto (pantallas **Moderación** y **Verificación de empresas** en el panel
admin) — la parte pendiente es la lógica real detrás:

- Verificación de dominio corporativo antes de permitir publicar (el
  prototipo ya muestra el badge "Dominio verificado").
- Cola de revisión manual para empresas nuevas antes de su primera
  publicación (ya maquetada).
- Sistema de reportes de candidatos sobre vacantes sospechosas, con acción
  rápida de moderación (ya maquetado, con motivos categorizados: pago por
  adelantado, posible vacante falsa, contenido discriminatorio).
- Reglas heurísticas automáticas como primera línea (sueldo
  desproporcionadamente alto para el puesto, empresa sin sitio web, etc.) que
  prioricen qué revisa el equipo humano primero.

## 7. Pagos

Si se manejan pagos de empleadores (planes premium, vacantes destacadas — ya
definidos en el modelo de negocio de Aplicca):

- **Nunca** manejar números de tarjeta directamente.
- Usar un procesador certificado **PCI DSS** (Stripe, Conekta, Mercado Pago,
  etc.) — la tarjeta nunca toca los servidores de Aplicca, solo un token del
  procesador.

## 8. Pruebas de seguridad dirigidas (antes de lanzar)

Checklist mínimo de pentesting/QA de seguridad enfocado en los puntos de
mayor riesgo de este tipo de producto:

- [ ] IDOR en endpoints de perfiles y postulaciones (candidato A no puede ver
      datos de candidato B; empresa A no puede ver candidatos de empresa B).
- [ ] Subida de archivos maliciosos (extensión falsa, payloads XXE, archivos
      con malware).
- [ ] Inyección en filtros de búsqueda (parámetros de Elasticsearch mal
      escapados).
- [ ] Bypass de protecciones anti-scraping.
- [ ] Límites de autorización entre roles (candidato/empleador/admin)
      infranqueables — un usuario candidato no puede alcanzar rutas de admin
      cambiando su token o parámetros, y viceversa.

## 9. En el ciclo de desarrollo

- **SAST** (análisis estático) y **DAST** (análisis dinámico) integrados en
  CI/CD, no como paso manual ocasional.
- **Threat modeling** temprano — antes de escribir código de un módulo
  nuevo, no después.
- **Pentesting** enfocado en los puntos de la sección 8, ejecutado antes de
  cada lanzamiento mayor, no solo una vez al año.
