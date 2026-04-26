# Auditoría Técnica del Panel Admin
**Fecha:** 25 de abril de 2026
**Alcance:** Panel administrativo del Portal del Colegio Diego Thomson
**Auditor:** Claude Code (claude-sonnet-4-6)

---

## 1. Resumen Ejecutivo

Se auditaron los 3 endpoints API admin, el componente `app/admin/page.jsx` (1.944 líneas), el formulario `StudentRegistrationForm.jsx`, las reglas Firestore y el sistema de roles. Se identificaron **13 items técnicos**: 4 de seguridad, 3 de robustez, 4 de deuda técnica y 2 de performance.

La arquitectura backend es sólida: token Firebase verificado en cada request, transacciones atómicas con re-check de estado, y auditoría completa en `AuditoriaPagos`. El problema principal está en la **superficie de ataque del frontend y en inconsistencias entre los tres route handlers** que pueden dejar al rol secretaría bloqueado para crear estudiantes.

Los 3 items prioritarios para esta semana son: **(1) `/api/admin/crear-usuario` rechaza a secretaría**, **(2) cuotas creadas fuera del batch en matrícula**, **(3) `getRolEfectivo` duplicada en dos route handlers**. Cubren las tres categorías críticas y son todos esfuerzo S–M sin dependencias externas.

---

## 2. Inventario del Panel

### 2.1 Archivos del panel

| Archivo | Líneas | Función |
|---------|--------|---------|
| `app/admin/page.jsx` | 1.944 | Panel principal — revisiones, cuotas, estudiantes, estadísticas |
| `app/api/admin/confirmar-pago-manual/route.js` | 232 | Confirmar pago en efectivo / transferencia / cheque |
| `app/api/admin/procesar-revision/route.js` | 145 | Aprobar o rechazar comprobante subido |
| `app/api/admin/crear-usuario/route.js` | 71 | Crear cuenta Firebase Auth desde server (evita logout del admin) |
| `components/StudentRegistrationForm.jsx` | ~400 | Formulario de matrícula de alumno nuevo |
| `firestore.rules` | 225 | Reglas de seguridad Firestore |

### 2.2 Endpoints API admin y qué hacen

| Endpoint | Método | Protección actual | Operación |
|----------|--------|-------------------|-----------|
| `/api/admin/confirmar-pago-manual` | POST | `verifyIdToken` + `getRolEfectivo` (admin/secretaria) | Transacción atómica: marca cuota `pagado` + crea registro de auditoría + envía email |
| `/api/admin/procesar-revision` | POST | `verifyIdToken` + `getRolEfectivo` (admin/secretaria) | Transacción atómica: aprueba o rechaza comprobante + crea registro de auditoría |
| `/api/admin/crear-usuario` | POST | `verifyIdToken` + check `Admins/{uid}` en Firestore | Crea cuenta Firebase Auth sin afectar sesión del admin |

### 2.3 Validación de rol

**Frontend** (`app/admin/page.jsx` líneas 983–1006): dual check `getDoc(/Admins/{uid})` + `getIdTokenResult().claims.role`. Si falla `getIdTokenResult`, cae a solo Firestore. Los listeners se detienen si `!esAdmin`, pero la página no redirige de forma server-side.

**Backend** (función `getRolEfectivo` en dos routes): primero verifica custom claim (`role === 'admin'` o `'secretaria'`), luego fallback a `Admins/{uid}`. Excepción: `crear-usuario` no usa esta función —solo verifica presencia en `/Admins/{uid}`— bloqueando a secretaría.

**Firestore Rules**: `esAdmin()` acepta custom claim o presencia en `/Admins`. `esSecretaria()` solo acepta custom claim. `esPersonal()` es la unión. `deny-by-default` en la raíz.

### 2.4 Auditoría

Cada operación crítica escribe en `AuditoriaPagos` (Admin SDK, desde el server) dentro de la misma transacción Firestore. Contiene: `accion`, `admin_uid`, `admin_nombre`, `admin_rol`, `ip_caller`, `user_agent_caller`, `timestamp`. Solo lecturable por admin.

---

## 3. Hallazgos por Categoría

### 3.1 Seguridad

| # | Item | Prioridad | Esfuerzo | Archivo |
|---|------|-----------|----------|---------|
| S1 | `crear-usuario` solo valida `Admins/{uid}`, rechaza secretaría con 403 | 🔴 Crítico | S | `app/api/admin/crear-usuario/route.js:38` |
| S2 | Password de cuenta estudiante = 6 primeros dígitos del RUT numérico | 🟡 Importante | S | `components/StudentRegistrationForm.jsx:202` |
| S3 | Sin `middleware.ts`: `/admin/*` se renderiza antes del check de rol client-side | 🟡 Importante | S | (no existe) |
| S4 | Validación MIME de comprobantes solo en cliente; servidor no verifica Content-Type | 🟡 Importante | M | `app/admin/page.jsx` (ModalConfirmarPago) |

### 3.2 Robustez

| # | Item | Prioridad | Esfuerzo | Archivo |
|---|------|-----------|----------|---------|
| R1 | 10 cuotas creadas con `Promise.all` fuera del batch — estado inconsistente si falla | 🔴 Crítico | M | `components/StudentRegistrationForm.jsx:286–300` |
| R2 | `cargarTodasCuotas` silencia error — solo `console.error`, UI no notifica al admin | 🟡 Importante | S | `app/admin/page.jsx:1069` |
| R3 | `procesar-revision` no envía email al rechazar comprobante — asimetría con aprobación | 🟡 Importante | M | `app/api/admin/procesar-revision/route.js:102–108` |

### 3.3 Deuda Técnica

| # | Item | Prioridad | Esfuerzo | Archivo |
|---|------|-----------|----------|---------|
| D1 | `getRolEfectivo` copiada literalmente en dos route handlers | 🟡 Importante | S | `confirmar-pago-manual/route.js:33` y `procesar-revision/route.js:16` |
| D2 | `crear-usuario` usa patrón de autorización distinto al resto — divergencia silenciosa | 🟡 Importante | S | `app/api/admin/crear-usuario/route.js:36–44` |
| D3 | Campos duplicados en schema `Cuotas`: `aprobado_por` / `confirmado_por` (y sus `_nombre`) | 🟢 Nice-to-have | L | Todos los route handlers admin |
| D4 | Año de matrícula hardcodeado a `new Date().getFullYear()` — matrícula fuera de plazo generará cuotas del año incorrecto | 🟡 Importante | S | `components/StudentRegistrationForm.jsx:285` |

### 3.4 Performance

| # | Item | Prioridad | Esfuerzo | Archivo |
|---|------|-----------|----------|---------|
| P1 | `getDocs(collection(db, 'Cuotas'))` sin `limit()` — descarga toda la colección | 🟡 Importante | M | `app/admin/page.jsx:1057` |
| P2 | `onSnapshot(collection(db, 'Estudiantes'))` sin filtro — WebSocket sobre colección completa | 🟡 Importante | M | `app/admin/page.jsx:1080` |

> **Nota P1/P2:** Con el volumen actual (colegio mediano), el impacto es tolerable. Se convierte en problema real al superar ~5.000 documentos o con conexiones lentas. Se incluye porque el patrón crecerá con el tiempo.

---

## 4. Top 3 Mejoras para Esta Semana

### 4.1 Autorización de secretaría en `/api/admin/crear-usuario`

- **Categoría:** SEGURIDAD
- **Por qué:** El endpoint verifica solo la presencia del UID en la colección `Admins`, ignorando el custom claim `role === 'secretaria'`. Una secretaría autenticada recibe 403 al intentar matricular un alumno nuevo, aunque el formulario esté visible en su panel. Los otros dos endpoints usan correctamente `getRolEfectivo` — este quedó desincronizado.
- **Riesgo si no se hace:** La secretaría no puede completar su tarea más frecuente (matrícula de alumnos) y el colegio depende del admin para cada alta nueva. Además, la inconsistencia entre routes puede causar regresos similares en futuros endpoints.
- **Implementación:**
  - Mover `getRolEfectivo` a un módulo compartido (`lib/admin/auth.js`) — ver D1.
  - Importar y llamar `getRolEfectivo(uid, decoded)` en `crear-usuario` en lugar del check directo de `Admins`.
  - Cambiar la condición de error de `!adminSnap.exists` a `!rol` con respuesta 403 descriptiva.
  - Considerar si solo `admin` o también `secretaria` puede crear usuarios (decisión de negocio; por coherencia con los otros endpoints, ambos roles deberían poder hacerlo).
  - Test manual: iniciar sesión como secretaria e intentar registrar un alumno.

- **Prompt para Claude Code:**
  ```
  En este proyecto Next.js + Firebase, el endpoint
  `app/api/admin/crear-usuario/route.js` rechaza a usuarios con
  custom claim `role='secretaria'` porque solo verifica presencia en
  la colección Admins (línea 38), ignorando el claim.

  Tarea:
  1. Crea el archivo `lib/admin/auth.js` que exporte la función
     `getRolEfectivo(uid, decodedToken)` (el mismo código que ya
     existe en confirmar-pago-manual/route.js:33-39 y
     procesar-revision/route.js:16-22).
  2. En `crear-usuario/route.js`, reemplaza el bloque de verificación
     actual (líneas 36-44) por: verificar token, llamar
     getRolEfectivo, devolver 403 si !rol.
  3. En `confirmar-pago-manual/route.js` y `procesar-revision/route.js`,
     elimina la función local getRolEfectivo e importa desde
     lib/admin/auth.js.

  No cambies ninguna otra lógica. No modifiques los tests ni el
  manejo de errores existente.
  ```

---

### 4.2 Cuotas dentro del batch en `StudentRegistrationForm`

- **Categoría:** ROBUSTEZ
- **Por qué:** El `writeBatch` del formulario de matrícula incluye el apoderado y el estudiante, pero las 10 cuotas se crean después con `Promise.all(cuotasPromises)` fuera del batch (línea 286–300). Si cualquiera de los 10 `addDoc` falla (error de red, cuota de Firestore, regla de validación), el estudiante queda registrado sin cuotas. La UI muestra éxito parcial y el admin tendría que detectar y corregir el inconsistente estado manualmente.
- **Riesgo si no se hace:** Alumnos matriculados sin cuotas generadas — estado huérfano difícil de detectar y corregir en producción, especialmente al inicio del año escolar con muchas matrículas simultáneas.
- **Implementación:**
  - Agregar las 10 operaciones `batch.set(doc(db, 'Cuotas', ...))` al mismo `writeBatch` que ya existe.
  - `writeBatch` de Firebase soporta hasta 500 operaciones; 2 (apoderado + estudiante) + 10 (cuotas) = 12, bien dentro del límite.
  - Si `tieneCGPA`, la cuota CGPA puede ir en el mismo batch o en uno separado inmediatamente después (es idempotente por la verificación de `yaExiste`).
  - Asignar IDs de cuota explícitos con `doc(collection(db, 'Cuotas'))` antes del batch para obtener refs.
  - Verificar que el toast de éxito y el `onSuccess` solo se llamen tras `await batch.commit()`.

- **Prompt para Claude Code:**
  ```
  En `components/StudentRegistrationForm.jsx`, las cuotas de un
  alumno nuevo se crean con Promise.all de 10 addDoc independientes
  (líneas 286–300), fuera del writeBatch que ya existe para
  Apoderados y Estudiantes. Si falla un addDoc, el alumno queda
  registrado sin cuotas.

  Tarea: mover la creación de las 10 cuotas dentro del mismo
  writeBatch. Para cada cuota, generar una ref con
  `const cuotaRef = doc(collection(db, 'Cuotas'))` y usar
  `batch.set(cuotaRef, { ... })`. Hacer lo mismo con la cuota
  CGPA si aplica (aunque esta puede ir en un segundo batch
  separado dado que tiene lógica de deduplicación). El batch.commit()
  ya existente es el único punto de fallo.

  No cambiar ningún campo de los documentos de cuota. No cambiar
  la lógica de beca, CGPA ni validación de RUT.
  ```

---

### 4.3 Módulo compartido `lib/admin/auth.js` para `getRolEfectivo`

- **Categoría:** DEUDA TÉCNICA
- **Por qué:** La función `getRolEfectivo` (14 líneas) está copiada literal e idénticamente en `confirmar-pago-manual/route.js` (línea 33) y `procesar-revision/route.js` (línea 16). Cualquier cambio en la lógica de roles (por ejemplo, agregar un tercer rol como `tesorero`) requiere editar dos archivos. Este item es también el prerequerisito técnico de S1 — al extraerlo primero, S1 se implementa en minutos.
- **Riesgo si no se hace:** Los dos archivos divergen silenciosamente en el futuro. Un parche aplicado en uno pero olvidado en el otro puede crear una brecha de autorización específica de endpoint.
- **Implementación:**
  - Crear `lib/admin/auth.js` exportando `getRolEfectivo(uid, decodedToken)`.
  - Importar desde ambos route handlers existentes y desde `crear-usuario` (que lo necesita como parte de S1).
  - Verificar que los imports en los route handlers usen path relativo correcto (`../../../../lib/admin/auth`).
  - No cambiar ninguna lógica — es refactor de extracción puro.

- **Prompt para Claude Code:**
  ```
  Extrae la función getRolEfectivo a un módulo compartido.

  La función existe de forma idéntica en dos archivos:
  - app/api/admin/confirmar-pago-manual/route.js líneas 33–39
  - app/api/admin/procesar-revision/route.js líneas 16–22

  Tarea:
  1. Crear `lib/admin/auth.js` con esa función exportada como named
     export. Necesita importar adminDb desde
     `../../../firebase/adminConfig`.
  2. En ambos route handlers, eliminar la definición local e importar
     desde lib/admin/auth.js.
  3. En app/api/admin/crear-usuario/route.js, importar también
     getRolEfectivo y usarla reemplazando las líneas 36–44.

  No cambiar ningún otro comportamiento. Verificar que el path de
  import sea correcto desde cada route handler.
  ```

---

## 5. Backlog Para Después

| # | Item | Categoría | Prioridad | Esfuerzo |
|---|------|-----------|-----------|----------|
| S2 | Password cuenta estudiante = 6 dígitos del RUT | SEGURIDAD | 🟡 | S |
| S3 | Crear `middleware.ts` para redirección server-side en `/admin/*` | SEGURIDAD | 🟡 | S |
| S4 | Validar Content-Type del comprobante en server (no solo client) | SEGURIDAD | 🟡 | M |
| R2 | `cargarTodasCuotas` muestra error en UI cuando falla (no solo `console.error`) | ROBUSTEZ | 🟡 | S |
| R3 | `procesar-revision` enviar email best-effort también al rechazar | ROBUSTEZ | 🟡 | M |
| D3 | Unificar campos `aprobado_por` / `confirmado_por` en schema `Cuotas` | DEUDA | 🟢 | L |
| D4 | Año de matrícula configurable desde `configuracion/periodo_escolar` en lugar de `new Date().getFullYear()` | DEUDA | 🟡 | S |
| P1 | `getDocs(Cuotas)` con `limit(500)` + paginación cursor | PERFORMANCE | 🟡 | M |
| P2 | `onSnapshot(Estudiantes)` reemplazar por `getDocs` puntual + refresh manual | PERFORMANCE | 🟡 | M |

---

## 6. Hallazgos No Esperados

**`crear-usuario` no usa `getRolEfectivo`:** El más llamativo. Los otros dos endpoints evolucionaron para usar la función dual (custom claim + Firestore), pero `crear-usuario` quedó en la versión original solo-Firestore. No hay evidencia de que esto sea intencional — parece un olvido de sincronización.

**Password predecible por diseño documentado:** `components/StudentRegistrationForm.jsx:202` genera la contraseña como `rutLimpio.replace(/[^0-9]/g, '').slice(0, 6)` — los primeros 6 dígitos del RUT numérico. Esto es intencional (primer login simplificado), pero no hay comentario que explique la política de cambio obligatorio de clave ni qué pasa si el RUT tiene menos de 6 dígitos numéricos (el guard en línea 204–207 lo captura). Documentar o revisar la política antes del lanzamiento.

**`esHermano()` en Firestore Rules hace dos `get()` por evaluación:** La función `esHermano()` en `firestore.rules:76–82` hace dos lecturas documentales por evaluación (`exists` + `get`). Esto consume facturación de lecturas Firestore en cada query de cuotas por parte de un alumno. No es un bug, pero es costoso a escala.

**Cuota CGPA busca duplicados con `where('apoderado_id', '==', ...)` sin índice explícito:** `StudentRegistrationForm.jsx:305–306`. Si la colección `Cuotas` crece, este query puede requerir un índice compuesto. Verificar en Firebase Console que el índice automático existe o crearlo explícitamente.

---

*Reporte generado para uso interno del equipo de desarrollo.*
