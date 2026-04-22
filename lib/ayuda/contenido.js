// ─────────────────────────────────────────────────────────────────────────────
// lib/ayuda/contenido.js
// Base de conocimiento estática del Centro de Ayuda.
// Solo admin y secretaría ven este contenido. No requiere backend.
//
// Para agregar una nueva sección:
//   1. Elige la categoría que corresponde (o crea una nueva al final).
//   2. Agrega un objeto al array `secciones` con id, titulo, keywords y contenido.
//   3. Los campos de `contenido` son opcionales: resumen, pasos, tabla, alerta, verTambien.
//
// Para editar contenido existente:
//   1. Busca la sección por su `id` o `titulo`.
//   2. Modifica los campos que necesitas.
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Array<import('./tipos').CategoriaAyuda>} */
export const CATEGORIAS_AYUDA = [
  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORÍA 1 — Pagos y cuotas
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'pagos-cuotas',
    titulo: 'Pagos y cuotas',
    icono: 'CreditCard',
    secciones: [
      {
        id: 'confirmar-pago-manual',
        titulo: '¿Cómo confirmo un pago manual de un apoderado?',
        keywords: [
          'confirmar', 'pago', 'manual', 'efectivo', 'transferencia',
          'cheque', 'registrar pago', 'pago en efectivo',
        ],
        contenido: {
          resumen:
            'Cuando un apoderado paga en efectivo, por transferencia u otro método fuera del portal, ' +
            'debes registrarlo manualmente desde el panel.',
          pasos: [
            'Ve al tab "Pagos manuales" en el panel administrativo.',
            'Busca la cuota del apoderado usando el buscador (nombre) o el filtro de mes.',
            'Haz clic en el botón "Confirmar pago" de la fila correspondiente.',
            'Selecciona el método de pago: Transferencia, Efectivo, Cheque, Webpay (diferido), Khipu (diferido) u Otro.',
            'Ingresa la fecha del pago y una observación (mínimo 10 caracteres).',
            'Si corresponde, ingresa el número de comprobante o voucher.',
            'Opcionalmente adjunta una imagen o PDF del comprobante (máximo 5 MB).',
            'Haz clic en "Confirmar pago". El sistema generará un recibo PDF automáticamente.',
          ],
          alerta: {
            tipo: 'info',
            mensaje:
              'El sistema registra automáticamente quién confirmó el pago, su rol y la hora exacta. ' +
              'Esta información queda en la auditoría y no se puede modificar.',
          },
        },
      },
      {
        id: 'aprobar-rechazar-comprobante',
        titulo: '¿Cómo apruebo o rechazo un comprobante subido por el apoderado?',
        keywords: [
          'comprobante', 'aprobar', 'rechazar', 'revision', 'en revision',
          'revisar comprobante', 'verificar pago',
        ],
        contenido: {
          resumen:
            'Cuando un apoderado sube un comprobante de pago, la cuota queda en estado "En revisión". ' +
            'Tú debes verificar si el pago es válido y aprobar o rechazar.',
          pasos: [
            'Ve al tab "Comprobantes" en el panel.',
            'Verás la lista de cuotas con comprobantes pendientes de revisión.',
            'Haz clic en el ícono de imagen para abrir y revisar el comprobante adjunto.',
            'Si el pago es válido: haz clic en "Aprobar". La cuota pasará a estado "Pagado".',
            'Si el comprobante no es válido o el monto no corresponde: haz clic en "Rechazar". La cuota vuelve a "Pendiente" o "Atrasado".',
          ],
          alerta: {
            tipo: 'warning',
            mensaje:
              'Al rechazar, el apoderado no recibe notificación automática. ' +
              'Comunícate directamente con él para avisarle y explicarle el motivo.',
          },
        },
      },
      {
        id: 'estados-cuota',
        titulo: '¿Qué significa cada estado de una cuota?',
        keywords: [
          'estado', 'pendiente', 'atrasado', 'en revision', 'pagado',
          'estados cuota', 'colores cuota',
        ],
        contenido: {
          resumen: 'Cada cuota puede estar en uno de estos cuatro estados:',
          tabla: [
            {
              label: 'Pendiente',
              descripcion:
                'La cuota está vigente y no se ha pagado. El apoderado puede pagar en línea o subir un comprobante.',
            },
            {
              label: 'Atrasado',
              descripcion:
                'La fecha de vencimiento ya pasó y la cuota no está pagada. Aparece en rojo en el panel.',
            },
            {
              label: 'En revisión',
              descripcion:
                'El apoderado subió un comprobante y está esperando que la secretaría o el admin lo apruebe.',
            },
            {
              label: 'Pagado',
              descripcion:
                'El pago fue confirmado. Puede ser por pago en línea (Webpay o Khipu) o por confirmación manual del panel.',
            },
          ],
        },
      },
      {
        id: 'apoderado-dice-pago',
        titulo: '¿Qué hago si un apoderado dice que pagó pero no aparece?',
        keywords: [
          'no aparece', 'pago no registrado', 'dice que pago', 'no actualizo',
          'pago perdido', 'no se registro',
        ],
        contenido: {
          resumen:
            'Sigue estos pasos para verificar la situación antes de confirmar manualmente.',
          pasos: [
            'Pide al apoderado el comprobante del pago (captura del banco, voucher de Webpay o Khipu, etc.).',
            'Revisa el tab "Comprobantes": puede que esté en revisión y nadie lo haya aprobado aún.',
            'Si pagó con Khipu o Webpay, revisa el tab "Todas las cuotas" (solo Admin) para ver el estado actual.',
            'Si el pago fue por transferencia y tienes el comprobante, confírmalo manualmente desde "Pagos manuales".',
            'Si el problema es con Khipu, revisa la sección de Khipu en esta ayuda.',
            'Si el problema es con Webpay, revisa la sección de Webpay en esta ayuda.',
          ],
          verTambien: ['pago-khipu-no-actualizo', 'pago-webpay-no-actualizo', 'confirmar-pago-manual'],
        },
      },
      {
        id: 'anular-pago-confirmado',
        titulo: '¿Puedo anular o revertir un pago ya confirmado?',
        keywords: [
          'anular', 'revertir', 'deshacer', 'pago confirmado', 'eliminar pago',
          'error confirmacion',
        ],
        contenido: {
          resumen:
            'El portal no tiene función de anulación automática de pagos ya confirmados.',
          pasos: [
            'Si fue un error de confirmación manual, contacta al desarrollador para revertir el estado directamente en la base de datos.',
            'Para pagos online (Webpay o Khipu), la devolución debe gestionarse con Transbank o Khipu según sus políticas.',
            'Registra siempre una observación clara al confirmar pagos para facilitar revisiones futuras.',
          ],
          alerta: {
            tipo: 'danger',
            mensaje:
              'No modifiques ni elimines documentos directamente en Firestore sin respaldo y sin coordinación con el desarrollador. ' +
              'Hacerlo puede romper la auditoría.',
          },
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORÍA 2 — Gestión de estudiantes
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'gestion-estudiantes',
    titulo: 'Gestión de estudiantes',
    icono: 'Users',
    secciones: [
      {
        id: 'matricular-estudiante',
        titulo: '¿Cómo se matricula un nuevo estudiante?',
        keywords: [
          'matricular', 'nuevo estudiante', 'registro', 'agregar alumno',
          'apoderado nuevo', 'crear estudiante',
        ],
        contenido: {
          resumen: 'Solo el rol Admin puede registrar nuevos estudiantes.',
          pasos: [
            'Ve al tab "Estudiantes" (solo visible para Admin).',
            'Haz clic en el botón "Registrar estudiante" en la parte superior.',
            'Completa el formulario: nombre del estudiante, RUT, curso y datos del apoderado (nombre, RUT, email, teléfono).',
            'Si el apoderado ya tiene otro hijo en el colegio, ingresa el mismo RUT para que el sistema los vincule automáticamente.',
            'Haz clic en "Registrar". El sistema creará el estudiante y generará las cuotas del año escolar.',
            'El apoderado recibirá un email de bienvenida con sus credenciales de acceso al portal.',
          ],
          alerta: {
            tipo: 'info',
            mensaje:
              'Los cursos disponibles van de Kinder a 8° Básico. ' +
              'Si necesitas agregar otro nivel o modificar los cursos disponibles, contacta al desarrollador.',
          },
        },
      },
      {
        id: 'cambiar-datos-apoderado',
        titulo: '¿Cómo cambio datos de un apoderado (email, teléfono)?',
        keywords: [
          'cambiar email', 'actualizar telefono', 'editar apoderado',
          'datos apoderado', 'corregir', 'modificar apoderado',
        ],
        contenido: {
          resumen: 'Puedes editar los datos de un apoderado desde el tab "Estudiantes".',
          pasos: [
            'Ve al tab "Estudiantes" (solo Admin).',
            'Busca al estudiante cuyo apoderado quieres modificar.',
            'Haz clic en el ícono de edición (lápiz) en la fila del estudiante.',
            'Actualiza los campos necesarios: email, teléfono, nombre del apoderado.',
            'Guarda los cambios.',
          ],
          alerta: {
            tipo: 'warning',
            mensaje:
              'Cambiar el email en el sistema no actualiza la cuenta de acceso del apoderado (Firebase Auth). ' +
              'Si necesitas cambiar el email con el que inicia sesión, contacta al desarrollador.',
          },
        },
      },
      {
        id: 'vincular-hermanos',
        titulo: '¿Cómo vinculo hermanos con el mismo apoderado?',
        keywords: [
          'hermanos', 'mismo apoderado', 'vincular', 'familia',
          'varios hijos', 'hermano', 'apoderado compartido',
        ],
        contenido: {
          resumen:
            'El sistema vincula hermanos automáticamente cuando comparten el mismo RUT de apoderado.',
          pasos: [
            'Al registrar un nuevo estudiante cuyo apoderado ya tiene una cuenta, ingresa exactamente el mismo RUT del apoderado.',
            'El sistema detectará que ese apoderado ya existe y vinculará al nuevo estudiante a su cuenta.',
            'El apoderado verá a todos sus hijos en su portal con sus respectivas cuotas.',
          ],
          alerta: {
            tipo: 'info',
            mensaje:
              'Si los hermanos tienen apoderados distintos (por ejemplo, padre y madre con cuentas separadas), ' +
              'cada uno debe tener su propio RUT en el sistema.',
          },
          verTambien: ['matricular-estudiante'],
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORÍA 3 — Panel administrativo
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'panel-administrativo',
    titulo: 'Panel administrativo',
    icono: 'Settings',
    secciones: [
      {
        id: 'admin-vs-secretaria',
        titulo: '¿Qué puede hacer el rol Admin vs el rol Secretaría?',
        keywords: [
          'admin', 'secretaria', 'rol', 'permisos', 'diferencia',
          'acceso', 'que puede hacer',
        ],
        contenido: {
          resumen: 'El portal tiene dos roles con distintos niveles de acceso:',
          tabla: [
            {
              label: 'Comprobantes',
              descripcion: 'Ambos roles pueden revisar, aprobar y rechazar comprobantes de pago.',
            },
            {
              label: 'Pagos manuales',
              descripcion: 'Ambos roles pueden confirmar pagos realizados fuera del portal.',
            },
            {
              label: 'Todas las cuotas',
              descripcion: 'Solo Admin. Permite ver todas las cuotas y su estado.',
            },
            {
              label: 'Estudiantes',
              descripcion: 'Solo Admin. Permite ver, registrar y editar estudiantes y apoderados.',
            },
            {
              label: 'Resumen financiero',
              descripcion: 'Solo Admin. Muestra estadísticas de recaudación.',
            },
            {
              label: 'Configuración',
              descripcion: 'Solo Admin.',
            },
          ],
          alerta: {
            tipo: 'info',
            mensaje:
              'Para crear una cuenta de secretaría, el Admin debe asignar el custom claim ' +
              'role=secretaria desde Firebase Console. Contacta al desarrollador si no sabes cómo hacerlo.',
          },
        },
      },
      {
        id: 'exportar-excel',
        titulo: '¿Cómo exporto la información a Excel?',
        keywords: [
          'excel', 'exportar', 'descargar', 'reporte', 'planilla',
          'xlsx', 'exportar excel',
        ],
        contenido: {
          resumen:
            'El panel permite exportar dos tipos de reportes a Excel (formato .xlsx), ' +
            'disponibles solo para el rol Admin.',
          pasos: [
            'En el tab "Todas las cuotas", busca el botón "Exportar Excel" para descargar un reporte de todas las cuotas con su estado actual.',
            'En el tab "Estudiantes", puedes exportar el listado de apoderados con sus datos de contacto.',
            'El archivo se descargará automáticamente en tu computador.',
          ],
          alerta: {
            tipo: 'info',
            mensaje:
              'Los reportes Excel son solo para Admin. La Secretaría no tiene acceso a estos tabs.',
          },
        },
      },
      {
        id: 'filtros-busqueda',
        titulo: '¿Cómo uso los filtros de búsqueda del panel?',
        keywords: [
          'filtro', 'buscar', 'busqueda', 'filtrar', 'mes',
          'nombre', 'paginacion', 'paginar',
        ],
        contenido: {
          resumen:
            'Los tabs de Comprobantes y Pagos manuales tienen buscador y filtro por mes.',
          pasos: [
            'Escribe el nombre del apoderado o estudiante en el buscador para filtrar la lista en tiempo real.',
            'Usa el selector de mes para ver solo las cuotas de un mes específico (ej. "Marzo", "Abril").',
            'Para limpiar los filtros, borra el texto del buscador y selecciona "Todos" en el mes.',
            'La lista está paginada (50 filas por página). Usa los botones de paginación al pie de la tabla.',
          ],
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORÍA 4 — Problemas comunes
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'problemas-comunes',
    titulo: 'Problemas comunes',
    icono: 'AlertCircle',
    secciones: [
      {
        id: 'apoderado-olvido-clave',
        titulo: 'Un apoderado olvidó su contraseña, ¿qué hago?',
        keywords: [
          'contraseña', 'clave', 'password', 'olvido', 'recuperar',
          'acceso', 'no puede entrar', 'restablecer',
        ],
        contenido: {
          resumen: 'El portal tiene recuperación de contraseña automática por email.',
          pasos: [
            'Indica al apoderado que vaya a la página de inicio del portal.',
            'Debe hacer clic en "¿Olvidaste tu contraseña?" en el formulario de login.',
            'Ingresa el email registrado y recibirá un link para crear una nueva contraseña.',
            'El link vence después de una hora. Si no llega el email, pídele que revise la carpeta de spam.',
          ],
          alerta: {
            tipo: 'info',
            mensaje:
              'El email de recuperación lo envía Firebase (Google) desde una dirección automática. ' +
              'Puede ir a spam si es la primera vez que el apoderado lo recibe.',
          },
          verTambien: ['apoderado-no-recibe-emails'],
        },
      },
      {
        id: 'portal-no-carga',
        titulo: 'El apoderado dice que el portal no le carga',
        keywords: [
          'no carga', 'error', 'pantalla blanca', 'no funciona',
          'lento', 'cargando infinito', 'pantalla en blanco',
        ],
        contenido: {
          resumen:
            'La mayoría de los problemas de carga se resuelven con pasos simples.',
          pasos: [
            'Pide al apoderado que refresque la página con Ctrl+F5 (o Cmd+Shift+R en Mac). Esto limpia el caché.',
            'Si el problema sigue, que abra el portal en modo incógnito o en otro navegador.',
            'Recomienda usar Chrome, Firefox o Edge actualizados. Evitar Internet Explorer.',
            'En celular: limpiar caché del navegador o abrir en modo incógnito.',
            'Si el problema apareció después de una actualización del portal, el Ctrl+F5 suele resolverlo.',
          ],
          alerta: {
            tipo: 'info',
            mensaje:
              'El portal es una Progressive Web App (PWA) con Service Worker. ' +
              'A veces el caché anterior puede causar errores después de actualizaciones. ' +
              'Un Ctrl+F5 forzado siempre limpia esto.',
          },
        },
      },
      {
        id: 'pago-khipu-no-actualizo',
        titulo: 'Un pago con Khipu no actualizó la cuota',
        keywords: [
          'khipu', 'no actualizo', 'pago khipu', 'transferencia khipu',
          'cuota sigue pendiente', 'khipu no confirmo',
        ],
        contenido: {
          resumen:
            'Khipu notifica al portal cuando el banco confirma el pago. Esto puede tardar entre 1 y 15 minutos.',
          pasos: [
            'Pide al apoderado que espere hasta 15 minutos y luego refresque el portal.',
            'Si después de 15 minutos sigue sin actualizarse, pide el comprobante de Khipu (llega por email al apoderado).',
            'Con el comprobante en mano, confirma el pago manualmente desde "Pagos manuales" usando método "Khipu (diferido)".',
            'Registra el número de operación de Khipu como número de comprobante.',
          ],
          alerta: {
            tipo: 'warning',
            mensaje:
              'En ambiente de desarrollo (localhost), Khipu no puede enviar notificaciones al portal porque la URL no es pública. ' +
              'Esto es normal en desarrollo y no afecta el ambiente de producción.',
          },
          verTambien: ['confirmar-pago-manual'],
        },
      },
      {
        id: 'pago-webpay-no-actualizo',
        titulo: 'Un pago con Webpay no actualizó la cuota',
        keywords: [
          'webpay', 'transbank', 'no actualizo', 'pago webpay',
          'tarjeta debito', 'tarjeta credito', 'redcompra',
        ],
        contenido: {
          resumen:
            'Webpay Plus confirma los pagos al instante. Si la cuota no se actualizó, ' +
            'puede haber ocurrido un error durante el proceso de pago.',
          pasos: [
            'Pide al apoderado que revise si tiene el voucher de Transbank (aparece en pantalla al finalizar y llega por email).',
            'Si el voucher dice "AUTORIZADO": el pago sí ocurrió. Confirma manualmente con método "Webpay (diferido)".',
            'Si el voucher dice "RECHAZADO" o "ANULADO": el pago no se completó. La cuota sigue pendiente correctamente.',
            'Si el apoderado no está seguro, pídele que revise su estado de cuenta antes de confirmar manualmente.',
          ],
          alerta: {
            tipo: 'danger',
            mensaje:
              'No confirmes un pago manualmente sin tener evidencia del voucher autorizado. ' +
              'Hacerlo sin verificar puede registrar un pago que no ocurrió.',
          },
          verTambien: ['confirmar-pago-manual'],
        },
      },
      {
        id: 'apoderado-no-ve-cuotas',
        titulo: 'El apoderado no puede ver las cuotas de su hijo',
        keywords: [
          'no ve cuotas', 'cuotas vacias', 'sin cuotas', 'portal vacio',
          'no aparecen cuotas', 'no carga cuotas',
        ],
        contenido: {
          resumen:
            'Si el apoderado entra al portal y no ve ninguna cuota, revisa estas causas posibles.',
          pasos: [
            'Verifica en el tab "Estudiantes" que el estudiante esté registrado correctamente.',
            'Confirma que el email del apoderado en el sistema coincide exactamente con el que usa para iniciar sesión.',
            'Revisa en "Todas las cuotas" (Admin) que existan cuotas generadas para ese apoderado en el año actual.',
            'Si el apoderado tiene más de un hijo, verifica que ambos estén vinculados a su RUT.',
            'Pide al apoderado que cierre sesión y vuelva a entrar.',
          ],
          verTambien: ['vincular-hermanos', 'cambiar-datos-apoderado'],
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORÍA 5 — Notificaciones y emails
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'notificaciones-emails',
    titulo: 'Notificaciones y emails',
    icono: 'Mail',
    secciones: [
      {
        id: 'emails-automaticos',
        titulo: '¿El portal envía emails automáticos?',
        keywords: [
          'email', 'correo', 'automatico', 'notificacion', 'aviso',
          'que emails envia', 'notificaciones automaticas',
        ],
        contenido: {
          resumen:
            'El portal envía algunos mensajes automáticos, pero no todos son emails:',
          tabla: [
            {
              label: 'Bienvenida',
              descripcion:
                'Al registrar un apoderado nuevo, recibe sus credenciales de acceso por email.',
            },
            {
              label: 'Recuperación de contraseña',
              descripcion:
                'Firebase envía automáticamente el link cuando el apoderado lo solicita desde el login.',
            },
            {
              label: 'Recibo de pago',
              descripcion:
                'Al confirmar un pago manual, el sistema genera un PDF de recibo. ' +
                'Se descarga localmente; no se envía por email automáticamente.',
            },
            {
              label: 'Recordatorios de cuotas',
              descripcion:
                'El Admin puede enviar recordatorios masivos por WhatsApp desde el botón ' +
                '"Enviar recordatorio" en la parte superior del panel.',
            },
          ],
          alerta: {
            tipo: 'info',
            mensaje:
              'Los recordatorios masivos son por WhatsApp, no por email. ' +
              'El botón solo está disponible para el rol Admin.',
          },
        },
      },
      {
        id: 'apoderado-no-recibe-emails',
        titulo: 'El apoderado no recibe emails del portal, ¿qué hago?',
        keywords: [
          'no recibe email', 'correo no llega', 'spam', 'bandeja entrada',
          'gmail', 'hotmail', 'outlook', 'email no llega',
        ],
        contenido: {
          resumen:
            'Si el apoderado no recibe emails del portal, sigue estos pasos.',
          pasos: [
            'Pídele que revise su carpeta de spam o correo no deseado.',
            'Confirma que el email en el sistema esté correcto (tab "Estudiantes" → editar apoderado).',
            'Los emails automáticos vienen desde una dirección de Firebase/Google — puede ser filtrado como spam la primera vez.',
            'Si usa Outlook, Hotmail o Yahoo, es más probable que vaya a spam. Pídele que agregue el remitente como contacto seguro.',
            'Si el problema persiste con varios apoderados, contacta al desarrollador para revisar la configuración del dominio de email.',
          ],
          verTambien: ['apoderado-olvido-clave', 'cambiar-datos-apoderado'],
        },
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CATEGORÍA 6 — Auditoría y seguridad
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'auditoria-seguridad',
    titulo: 'Auditoría y seguridad',
    icono: 'ShieldCheck',
    secciones: [
      {
        id: 'registro-auditoria',
        titulo: '¿Dónde se registra lo que hago en el panel?',
        keywords: [
          'auditoria', 'log', 'registro', 'quien confirmo', 'historial',
          'trazabilidad', 'actividad', 'que queda registrado',
        ],
        contenido: {
          resumen:
            'El portal registra automáticamente las acciones importantes en la colección ' +
            '"AuditoriaPagos" de Firestore.',
          tabla: [
            {
              label: 'Qué se registra',
              descripcion:
                'Confirmaciones manuales de pago, aprobaciones y rechazos de comprobantes.',
            },
            {
              label: 'Datos guardados',
              descripcion:
                'UID del admin, nombre completo, rol, método de pago, fecha y hora exacta, IP y tipo de navegador.',
            },
            {
              label: 'Dónde verlo',
              descripcion:
                'Directamente en Firebase Console → Firestore → colección AuditoriaPagos.',
            },
            {
              label: 'Quién puede verlo',
              descripcion:
                'Solo el desarrollador con acceso a Firebase Console.',
            },
          ],
          alerta: {
            tipo: 'info',
            mensaje:
              'Si necesitas saber quién confirmó un pago específico, contacta al desarrollador ' +
              'indicando el nombre del apoderado y el mes de la cuota.',
          },
        },
      },
      {
        id: 'proteccion-datos',
        titulo: '¿Cómo protege el portal los datos personales?',
        keywords: [
          'seguridad', 'datos personales', 'privacidad', 'proteccion',
          'firestore', 'reglas', 'quien puede ver datos',
        ],
        contenido: {
          resumen:
            'El portal implementa varias capas de seguridad para proteger los datos de estudiantes y apoderados.',
          tabla: [
            {
              label: 'Autenticación',
              descripcion:
                'Firebase Auth con email y contraseña. Los apoderados solo pueden ver sus propias cuotas.',
            },
            {
              label: 'Reglas Firestore',
              descripcion:
                'Un apoderado no puede leer ni modificar datos de otros apoderados ni estudiantes.',
            },
            {
              label: 'Panel admin',
              descripcion:
                'Acceso restringido a usuarios con rol admin o secretaria verificado en el token de Firebase.',
            },
            {
              label: 'Auditoría',
              descripcion:
                'Todas las acciones del panel quedan registradas con usuario, rol, fecha y hora.',
            },
            {
              label: 'Política de privacidad',
              descripcion:
                'Los apoderados deben aceptar la política de privacidad al registrarse por primera vez.',
            },
          ],
          alerta: {
            tipo: 'info',
            mensaje:
              'Para solicitar cambios en las reglas de seguridad de Firestore o en la política de privacidad, ' +
              'contacta al desarrollador.',
          },
        },
      },
    ],
  },
]
