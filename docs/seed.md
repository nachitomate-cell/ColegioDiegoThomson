# Demo Seed — Colegio Diego Thomson

Script: `scripts/seedDemo.js`  
Comando: `npm run seed:demo`

---

## Requisitos previos

Las variables de entorno del Admin SDK deben estar en `.env.local`:

```
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_PRIVATE_KEY_ID=
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_CLIENT_ID=
```

---

## Qué hace

1. Elimina todas las cuentas Auth del dominio `@colegiodiegothompson.cl` (evita UIDs huérfanos).
2. Borra las colecciones `Estudiantes` y `Cuotas` completamente.
3. Crea 15 cuentas Auth + documentos `Estudiantes/{uid}`.
4. Crea 10 cuotas por estudiante (meses Marzo–Diciembre 2026).
5. Crea el usuario admin y su documento `Admins/{uid}`.

**Total documentos Firestore:** ~165 (150 cuotas + 15 estudiantes).

---

## Credenciales

### Admin
| Campo | Valor |
|-------|-------|
| RUT | `98.765.432-5` |
| Email | `987654325@colegiodiegothompson.cl` |
| Contraseña | `Admin2026!` |

> El admin tiene su documento en `Admins/{uid}`. Para acceso de secretaria, asigna el claim con `node scripts/asignar-rol.js <uid> secretaria`.

### Estudiantes (apoderados)
Contraseña única para todos: **`Demo2026!`**

Email de acceso: `{rut_limpio}@colegiodiegothompson.cl`  
Ejemplo: RUT `15.123.456-9` → email `151234569@colegiodiegothompson.cl`

---

## Familias (prueba de hermanos)

### Familia A — 2 hermanos
**Apoderado:** Jorge García Muñoz · RUT `12.345.678-5` · `jorge.garcia.m@gmail.com`

| RUT | Nombre | Curso | Estado |
|-----|--------|-------|--------|
| `15.123.456-9` | María José García Soto | 3° Básico A | Marzo+Abril pagados |
| `16.234.567-2` | Tomás García Soto | 6° Básico B | Marzo pagado, Abril atrasado |

Login del apoderado: cualquiera de los dos RUTs (ambos tienen `apoderado_rut_limpio = 12345678K`... `12345678-5`).

### Familia B — 3 hermanos
**Apoderado:** Ricardo Pérez Soto · RUT `11.222.333-9` · `ricardo.perez.s@gmail.com`

| RUT | Nombre | Curso | Estado |
|-----|--------|-------|--------|
| `17.345.678-6` | Sofía Pérez Muñoz | 8° Básico A | Marzo+Abril atrasados |
| `18.456.789-K` | Matías Pérez Muñoz | 4° Básico B | Marzo pagado, Abril en revisión |
| `19.567.890-1` | Elena Pérez Muñoz | 7° Básico A | Marzo+Abril pagados (becada $60.000) |

### Familia C — 2 mellizos
**Apoderado:** Carmen Lagos Moreno · RUT `13.456.789-9` · `carmen.lagos.m@gmail.com`

| RUT | Nombre | Curso | Estado |
|-----|--------|-------|--------|
| `20.678.901-8` | Benjamín Rojas Lagos | Kinder A | Marzo+Abril atrasados |
| `21.789.012-8` | Isidora Rojas Lagos | Kinder B | Marzo pagado, Abril atrasado |

---

## Estudiantes solos

| RUT | Nombre | Curso | Apoderado | Estado |
|-----|--------|-------|-----------|--------|
| `22.890.123-7` | Camila Torres Vega | 7° Básico A | Luis Torres Vega | Abril en revisión |
| `14.901.234-6` | Fernanda López Díaz | 8° Básico B | Jorge López Díaz | Todo atrasado |
| `15.012.345-3` | Andrés Peña Salazar | 2° Básico A | Elena Peña Salazar | Al día (becado $45.000) |
| `16.123.456-7` | Catalina Ríos Espinoza | 5° Básico A | Marco Ríos Espinoza | Marzo pagado, Abril atrasado |
| `17.234.567-0` | Joaquín Flores Medina | 8° Básico B | Sonia Flores Medina | Todo atrasado |
| `18.345.678-4` | Renata Guzmán Pinto | Kinder A | Miguel Guzmán Pinto | Al día |
| `19.456.789-8` | Felipe Araya Cárdenas | 6° Básico A | Carmen Araya Cárdenas | Marzo pagado, Abril atrasado (becado $65.000) |
| `20.567.890-5` | Antonia Castro Reyes | 6° Básico A | Francisco Castro Reyes | Abril en revisión |

---

## Casos de prueba habilitados

| Caso | Cómo probar |
|------|-------------|
| Flujo de hermanos | Login con RUT de cualquier hijo de Familia B → debe ver las 3 cuotas de sus 3 hermanos |
| Pago para hermano distinto | Iniciar pago de cuota de Sofía estando logueado con RUT de Matías → no debe dar 403 |
| Comprobante en revisión | Admin aprueba/rechaza cuotas de Matías (B2), Camila (S1) y Antonia (S8) |
| Moroso grave | Fernanda (S2) y Sofía (B1) tienen Marzo+Abril atrasados |
| Becados | Elena (B3 $60k), Andrés (S3 $45k) y Felipe (S7 $65k) |

---

## Asignar rol secretaria

```bash
node scripts/asignar-rol.js <uid> secretaria
```

Obtén el UID desde Firebase Console → Authentication, o desde la salida del seed.
El usuario debe cerrar sesión y volver a ingresar para que el claim sea efectivo.
