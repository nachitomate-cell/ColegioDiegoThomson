// ─────────────────────────────────────────────────────────────────────────────
// app/privacidad/page.jsx
// Página pública de Política de Privacidad — no requiere autenticación.
// Cumplimiento: Ley 19.628 y Ley 21.719 (Chile)
// ─────────────────────────────────────────────────────────────────────────────
import Link from 'next/link'
import { COLEGIO_INFO, ENCARGADO_INFO, POLITICA_PRIVACIDAD_VERSION } from '../../lib/constants'

export const metadata = {
  title: 'Política de Privacidad — Portal Colegio Diego Thomson',
  description: 'Política de privacidad y tratamiento de datos personales del Portal de Pagos del Colegio Diego Thomson.',
}

const SECCIONES = [
  { id: 'responsable',   titulo: 'A. Responsable del tratamiento' },
  { id: 'encargado',     titulo: 'B. Encargado del tratamiento' },
  { id: 'finalidades',   titulo: 'C. Finalidades del tratamiento' },
  { id: 'datos',         titulo: 'D. Datos recolectados' },
  { id: 'base-legal',    titulo: 'E. Base legal' },
  { id: 'menores',       titulo: 'F. Menores de edad' },
  { id: 'terceros',      titulo: 'G. Transferencia a terceros' },
  { id: 'conservacion',  titulo: 'H. Plazo de conservación' },
  { id: 'derechos',      titulo: 'I. Derechos ARCO+P' },
  { id: 'seguridad',     titulo: 'J. Medidas de seguridad' },
  { id: 'incidentes',    titulo: 'K. Notificación de incidentes' },
  { id: 'cambios',       titulo: 'L. Cambios a esta política' },
  { id: 'contacto',      titulo: 'M. Contacto' },
]

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-white text-gray-800">

      {/* ── Encabezado ──────────────────────────────────────────────────────── */}
      <header style={{ background: '#0D2C54' }} className="py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-white/60 text-xs tracking-widest uppercase mb-1">Colegio Diego Thomson</p>
          <h1 className="text-white text-2xl sm:text-3xl font-bold leading-tight">
            Política de Privacidad
          </h1>
          <p className="text-white/70 text-sm mt-2">
            Portal de Pagos · versión{' '}
            <span className="font-mono text-white/90">{POLITICA_PRIVACIDAD_VERSION}</span>
          </p>
          <p className="text-white/50 text-xs mt-4">
            Elaborada conforme a la <strong className="text-white/70">Ley 19.628</strong> sobre protección
            de la vida privada y la <strong className="text-white/70">Ley 21.719</strong> de datos personales (Chile).
          </p>
        </div>
      </header>

      {/* ── Cuerpo principal ─────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 py-10 lg:flex lg:gap-10">

        {/* ── Sidebar TOC (desktop) ─────────────────────────────────────────── */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Contenido</p>
            <nav className="space-y-1">
              {SECCIONES.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-xs text-gray-500 hover:text-[#0D2C54] hover:font-medium transition-colors py-0.5"
                >
                  {s.titulo}
                </a>
              ))}
            </nav>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <Link
                href="/login"
                className="text-xs text-[#C9A227] hover:underline font-medium"
              >
                ← Volver al portal
              </Link>
            </div>
          </div>
        </aside>

        {/* ── TOC móvil (collapsible) ───────────────────────────────────────── */}
        <div className="lg:hidden mb-8">
          <details className="border border-gray-200 rounded-xl overflow-hidden">
            <summary className="px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-700 cursor-pointer select-none">
              Índice de contenido ▾
            </summary>
            <nav className="px-4 py-3 space-y-1">
              {SECCIONES.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-sm text-gray-600 hover:text-[#0D2C54] py-0.5"
                >
                  {s.titulo}
                </a>
              ))}
            </nav>
          </details>
          <div className="mt-4">
            <Link href="/login" className="text-sm text-[#C9A227] hover:underline font-medium">
              ← Volver al portal
            </Link>
          </div>
        </div>

        {/* ── Contenido legal ───────────────────────────────────────────────── */}
        <article className="flex-1 space-y-10 text-sm leading-relaxed text-gray-700">

          {/* A. Responsable */}
          <section id="responsable">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              A. Responsable del tratamiento
            </h2>
            <p className="mb-3">
              El responsable del tratamiento de sus datos personales es:
            </p>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-1.5 text-sm">
              <div className="flex gap-2"><span className="text-gray-400 w-28 flex-shrink-0">Razón social</span><span className="font-medium">{COLEGIO_INFO.razonSocial}</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-28 flex-shrink-0">RUT</span><span className="font-medium">{COLEGIO_INFO.rut}</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-28 flex-shrink-0">Dirección</span><span className="font-medium">{COLEGIO_INFO.direccion}, {COLEGIO_INFO.comuna}, {COLEGIO_INFO.region}</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-28 flex-shrink-0">Correo</span><span className="font-medium">{COLEGIO_INFO.email}</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-28 flex-shrink-0">Teléfono</span><span className="font-medium">{COLEGIO_INFO.telefono}</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-28 flex-shrink-0">DPO / Contacto</span><span className="font-medium">{COLEGIO_INFO.emailDPO}</span></div>
            </div>
          </section>

          {/* B. Encargado */}
          <section id="encargado">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              B. Encargado del tratamiento
            </h2>
            <p className="mb-3">
              El encargado del tratamiento (desarrollador y operador técnico del portal) es:
            </p>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-1.5 text-sm">
              <div className="flex gap-2"><span className="text-gray-400 w-28 flex-shrink-0">Nombre</span><span className="font-medium">{ENCARGADO_INFO.nombre}</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-28 flex-shrink-0">RUT</span><span className="font-medium">{ENCARGADO_INFO.rut}</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-28 flex-shrink-0">Correo</span><span className="font-medium">{ENCARGADO_INFO.email}</span></div>
            </div>
            <p className="mt-3 text-gray-500">
              El encargado actúa por cuenta y bajo las instrucciones del responsable, y está sujeto a
              un acuerdo de confidencialidad respecto de los datos que trata.
            </p>
          </section>

          {/* C. Finalidades */}
          <section id="finalidades">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              C. Finalidades del tratamiento
            </h2>
            <p className="mb-3">Sus datos personales se tratarán exclusivamente para las siguientes finalidades:</p>
            <ol className="list-decimal list-inside space-y-2.5 pl-2">
              <li>
                <strong>Gestión de pagos escolares:</strong> procesar cuotas de escolaridad, CGPA y otros
                conceptos, generar comprobantes y mantener el registro contable exigido por la normativa
                tributaria chilena.
              </li>
              <li>
                <strong>Comunicaciones relacionadas con el servicio:</strong> enviar comprobantes de pago,
                notificaciones de vencimiento y enlaces de restablecimiento de contraseña al correo
                registrado por el apoderado.
              </li>
              <li>
                <strong>Seguridad y auditoría interna:</strong> registrar accesos, operaciones de pago e
                incidentes técnicos para detectar fraudes y cumplir obligaciones de trazabilidad.
              </li>
              <li>
                <strong>Cumplimiento de obligaciones legales:</strong> atender requerimientos de organismos
                reguladores (SII, Superintendencia de Educación, tribunales), conservar documentación
                contable y tributaria durante los plazos legales.
              </li>
              <li>
                <strong>Mejora del portal:</strong> analizar patrones de uso anónimos y agregados para
                mejorar la experiencia, sin identificar individualmente a los usuarios.
              </li>
            </ol>
            <p className="mt-3 text-gray-500">
              No se realizará ningún tratamiento incompatible con estas finalidades sin recabar
              un nuevo consentimiento expreso.
            </p>
          </section>

          {/* D. Datos */}
          <section id="datos">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              D. Datos personales recolectados
            </h2>
            <p className="mb-4">El portal recopila únicamente los datos estrictamente necesarios:</p>

            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-800 mb-1.5">Del apoderado</p>
                <ul className="list-disc list-inside pl-2 space-y-1 text-gray-600">
                  <li>RUT (identificación y autenticación)</li>
                  <li>Correo electrónico (comprobantes y notificaciones)</li>
                  <li>Contraseña (almacenada como hash bcrypt; jamás en texto plano)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1.5">Del estudiante</p>
                <ul className="list-disc list-inside pl-2 space-y-1 text-gray-600">
                  <li>Nombre completo y RUT</li>
                  <li>Curso y año escolar</li>
                  <li>Estado de cuotas (pendiente, pagado, atrasado)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1.5">Datos financieros</p>
                <ul className="list-disc list-inside pl-2 space-y-1 text-gray-600">
                  <li>Monto y fecha de cada transacción</li>
                  <li>Número de orden de compra y token de transacción (Transbank / Khipu)</li>
                  <li>Comprobante de pago adjunto (imagen o PDF), cuando aplica</li>
                </ul>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 text-xs">
                <strong>Importante:</strong> el portal <strong>nunca almacena</strong> números de tarjeta de
                crédito/débito, CVV ni datos bancarios. El procesamiento de pagos lo realizan exclusivamente
                Transbank y Khipu, entidades reguladas y certificadas PCI-DSS.
              </div>
            </div>
          </section>

          {/* E. Base legal */}
          <section id="base-legal">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              E. Base legal del tratamiento
            </h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#0D2C54]/10 flex items-center justify-center flex-shrink-0 text-[#0D2C54] font-bold text-xs">1</span>
                <div>
                  <p className="font-semibold">Consentimiento expreso (Art. 4, Ley 19.628)</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    El apoderado acepta expresamente esta política en el primer acceso al portal
                    y ante cada versión material que requiera reconsentimiento.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#0D2C54]/10 flex items-center justify-center flex-shrink-0 text-[#0D2C54] font-bold text-xs">2</span>
                <div>
                  <p className="font-semibold">Ejecución de un contrato (relación contractual de matrícula)</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    El tratamiento es necesario para gestionar los pagos derivados del contrato
                    de matrícula entre la familia y el colegio.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#0D2C54]/10 flex items-center justify-center flex-shrink-0 text-[#0D2C54] font-bold text-xs">3</span>
                <div>
                  <p className="font-semibold">Cumplimiento de obligación legal</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    El colegio está obligado por el SII y la normativa tributaria a conservar
                    registros contables, lo que requiere el tratamiento de ciertos datos financieros.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* F. Menores */}
          <section id="menores">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              F. Tratamiento de datos de menores de edad
            </h2>
            <p className="mb-3">
              Los estudiantes son, en su mayoría, menores de edad. El tratamiento de sus datos
              está sujeto a un estándar reforzado:
            </p>
            <ul className="list-disc list-inside pl-2 space-y-2 text-gray-600">
              <li>
                El consentimiento es otorgado por el <strong>apoderado o tutor legal</strong>, quien
                actúa en representación del estudiante.
              </li>
              <li>
                Los datos del estudiante se limitan a los <strong>estrictamente necesarios</strong> para
                gestionar las cuotas escolares (nombre, RUT, curso, estado de pago).
              </li>
              <li>
                <strong>No se realiza perfilamiento, publicidad segmentada ni análisis de
                comportamiento</strong> sobre los datos de menores.
              </li>
              <li>
                Los datos no se transfieren a terceros con fines comerciales o publicitarios.
              </li>
            </ul>
          </section>

          {/* G. Terceros */}
          <section id="terceros">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              G. Transferencia a terceros (subencargados)
            </h2>
            <p className="mb-4">
              Para operar el portal, el encargado contrata los siguientes subencargados, cada uno
              con sus propias políticas de seguridad y privacidad:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-left">
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Proveedor</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Servicio</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold">País</th>
                    <th className="border border-gray-200 px-3 py-2 font-semibold">Datos compartidos</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-medium">Google / Firebase</td>
                    <td className="border border-gray-200 px-3 py-2">Autenticación, base de datos, almacenamiento</td>
                    <td className="border border-gray-200 px-3 py-2">EE.UU.</td>
                    <td className="border border-gray-200 px-3 py-2">RUT, correo, datos de cuotas, comprobantes</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-medium">Vercel</td>
                    <td className="border border-gray-200 px-3 py-2">Infraestructura de la aplicación web (hosting)</td>
                    <td className="border border-gray-200 px-3 py-2">EE.UU.</td>
                    <td className="border border-gray-200 px-3 py-2">Logs de acceso (IP, user-agent)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-medium">Resend</td>
                    <td className="border border-gray-200 px-3 py-2">Envío de correos transaccionales</td>
                    <td className="border border-gray-200 px-3 py-2">EE.UU.</td>
                    <td className="border border-gray-200 px-3 py-2">Correo del apoderado, nombre del estudiante</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-medium">Transbank</td>
                    <td className="border border-gray-200 px-3 py-2">Procesamiento de pagos con tarjeta (WebPay Plus)</td>
                    <td className="border border-gray-200 px-3 py-2">Chile</td>
                    <td className="border border-gray-200 px-3 py-2">Monto, orden de compra (no datos de tarjeta)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-medium">Khipu</td>
                    <td className="border border-gray-200 px-3 py-2">Procesamiento de pagos bancarios en línea</td>
                    <td className="border border-gray-200 px-3 py-2">Chile</td>
                    <td className="border border-gray-200 px-3 py-2">Monto, descripción, correo de notificación</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-gray-500 text-xs">
              Los proveedores ubicados en EE.UU. operan bajo marcos de adecuación o cláusulas
              contractuales tipo que garantizan un nivel de protección equivalente al exigido
              por la legislación chilena.
            </p>
          </section>

          {/* H. Conservación */}
          <section id="conservacion">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              H. Plazo de conservación
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex gap-2">
                <span className="text-[#C9A227] font-bold mt-0.5">·</span>
                <span>
                  <strong>Registros contables y comprobantes de pago:</strong> 6 años desde la
                  fecha del pago, conforme al Código Tributario (Art. 200).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C9A227] font-bold mt-0.5">·</span>
                <span>
                  <strong>Datos del estudiante y apoderado:</strong> mientras exista matrícula
                  activa y por un máximo de 2 años adicionales tras el egreso o retiro, salvo
                  obligación legal que exija conservarlos más tiempo.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C9A227] font-bold mt-0.5">·</span>
                <span>
                  <strong>Logs de auditoría:</strong> 1 año, o el tiempo que exija la normativa
                  vigente en materia de ciberseguridad.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#C9A227] font-bold mt-0.5">·</span>
                <span>
                  <strong>Registros de consentimiento:</strong> durante toda la relación y por
                  5 años adicionales como prueba del cumplimiento normativo.
                </span>
              </li>
            </ul>
            <p className="mt-3 text-gray-500">
              Transcurridos los plazos, los datos serán eliminados de forma segura o anonimizados
              irreversiblemente.
            </p>
          </section>

          {/* I. Derechos */}
          <section id="derechos">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              I. Sus derechos (ARCO+P)
            </h2>
            <p className="mb-4">
              De conformidad con la Ley 19.628 y la Ley 21.719, el apoderado tiene los
              siguientes derechos respecto de sus datos personales y los de su pupilo:
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { letra: 'A', nombre: 'Acceso', desc: 'Solicitar una copia de todos los datos personales que el colegio conserva sobre usted y su hijo/a.' },
                { letra: 'R', nombre: 'Rectificación', desc: 'Pedir la corrección de datos inexactos o desactualizados (p. ej., correo electrónico erróneo).' },
                { letra: 'C', nombre: 'Cancelación', desc: 'Solicitar la eliminación de datos que ya no sean necesarios para las finalidades declaradas.' },
                { letra: 'O', nombre: 'Oposición', desc: 'Oponerse al tratamiento de sus datos en cualquier momento, especialmente cuando se base en consentimiento.' },
                { letra: 'P', nombre: 'Portabilidad', desc: 'Recibir sus datos en formato estructurado y de uso común (CSV/JSON) para transferirlos a otro responsable.' },
              ].map(({ letra, nombre, desc }) => (
                <div key={letra} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex gap-3">
                  <span
                    className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm text-white"
                    style={{ background: '#0D2C54' }}
                  >
                    {letra}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-800 text-xs">{nombre}</p>
                    <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-gray-500">
              Para ejercer cualquiera de estos derechos, envíe un correo a{' '}
              <a href={`mailto:${COLEGIO_INFO.emailDPO}`} className="text-[#0D2C54] underline font-medium">
                {COLEGIO_INFO.emailDPO}
              </a>{' '}
              identificándose con su nombre completo y RUT. Responderemos dentro de los plazos
              legales establecidos por la Ley 21.719.
            </p>
          </section>

          {/* J. Seguridad */}
          <section id="seguridad">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              J. Medidas de seguridad
            </h2>
            <p className="mb-3">
              El portal implementa medidas técnicas y organizativas para proteger sus datos:
            </p>
            <ul className="list-disc list-inside pl-2 space-y-2 text-gray-600">
              <li>Comunicaciones cifradas con <strong>HTTPS / TLS 1.3</strong> en todo momento.</li>
              <li>
                Autenticación mediante <strong>JSON Web Tokens (JWT)</strong> de corta duración
                emitidos por Firebase Authentication.
              </li>
              <li>
                Contraseñas almacenadas como <strong>hash bcrypt</strong> gestionado por Firebase;
                jamás en texto plano ni en logs.
              </li>
              <li>
                Acceso a la base de datos controlado por <strong>Firestore Security Rules</strong>:
                cada usuario puede leer únicamente sus propios datos.
              </li>
              <li>
                Datos de tarjeta procesados exclusivamente por Transbank y Khipu, ambos
                certificados <strong>PCI-DSS</strong>. El portal jamás recibe ni almacena datos
                de tarjeta.
              </li>
              <li>
                Acceso al panel de administración restringido a personal autorizado mediante
                roles personalizados (<em>Custom Claims</em>).
              </li>
            </ul>
          </section>

          {/* K. Incidentes */}
          <section id="incidentes">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              K. Notificación de incidentes de seguridad
            </h2>
            <p className="mb-3">
              En caso de producirse una brecha de seguridad que afecte datos personales, el
              responsable se compromete a:
            </p>
            <ol className="list-decimal list-inside pl-2 space-y-2 text-gray-600">
              <li>
                Notificar a las autoridades competentes dentro de los plazos establecidos por
                la Ley 21.719 y la normativa de ciberseguridad vigente.
              </li>
              <li>
                Comunicar a los titulares afectados, cuando el incidente pueda suponer un riesgo
                elevado para sus derechos, en el menor tiempo posible.
              </li>
              <li>
                Documentar el incidente, las medidas adoptadas y las acciones de mejora emprendidas.
              </li>
            </ol>
            <p className="mt-3 text-gray-500">
              Si detecta un uso no autorizado de sus credenciales, comuníquese inmediatamente a{' '}
              <a href={`mailto:${COLEGIO_INFO.emailDPO}`} className="text-[#0D2C54] underline">
                {COLEGIO_INFO.emailDPO}
              </a>.
            </p>
          </section>

          {/* L. Cambios */}
          <section id="cambios">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              L. Cambios a esta política
            </h2>
            <p className="mb-3">
              Esta política puede ser actualizada para reflejar cambios legales, tecnológicos u
              operativos. La versión actual es{' '}
              <strong className="font-mono">{POLITICA_PRIVACIDAD_VERSION}</strong>.
            </p>
            <p className="mb-3">
              Cuando los cambios sean <strong>materiales</strong> (nuevas finalidades, nuevos
              subencargados, cambios en los derechos ejercibles), se solicitará al apoderado
              otorgar un nuevo consentimiento explícito al ingresar al portal. Los cambios menores
              (correcciones de redacción, actualización de datos de contacto) se publicarán sin
              requerir nuevo consentimiento.
            </p>
            <p className="text-gray-500">
              El historial de versiones está disponible solicitándolo a{' '}
              <a href={`mailto:${COLEGIO_INFO.emailDPO}`} className="text-[#0D2C54] underline">
                {COLEGIO_INFO.emailDPO}
              </a>.
            </p>
          </section>

          {/* M. Contacto */}
          <section id="contacto">
            <h2 className="text-base font-bold text-[#0D2C54] mb-3 pb-2 border-b border-gray-100">
              M. Contacto
            </h2>
            <p className="mb-4">
              Para consultas, solicitudes ARCO+P o reclamos sobre el tratamiento de sus datos:
            </p>
            <div className="bg-[#0D2C54]/5 border border-[#0D2C54]/10 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex gap-2"><span className="text-gray-400 w-32 flex-shrink-0">Correo DPO</span><a href={`mailto:${COLEGIO_INFO.emailDPO}`} className="font-medium text-[#0D2C54] hover:underline">{COLEGIO_INFO.emailDPO}</a></div>
              <div className="flex gap-2"><span className="text-gray-400 w-32 flex-shrink-0">Correo general</span><a href={`mailto:${COLEGIO_INFO.email}`} className="font-medium text-[#0D2C54] hover:underline">{COLEGIO_INFO.email}</a></div>
              <div className="flex gap-2"><span className="text-gray-400 w-32 flex-shrink-0">Teléfono</span><span className="font-medium">{COLEGIO_INFO.telefono}</span></div>
              <div className="flex gap-2"><span className="text-gray-400 w-32 flex-shrink-0">Dirección</span><span className="font-medium">{COLEGIO_INFO.direccion}, {COLEGIO_INFO.comuna}</span></div>
            </div>
            <p className="mt-4 text-gray-500 text-xs">
              Si no está satisfecho/a con nuestra respuesta, tiene derecho a recurrir ante la
              autoridad de control competente según lo dispuesto en la Ley 21.719.
            </p>
          </section>

          {/* Cierre */}
          <div className="border-t border-gray-100 pt-6 text-xs text-gray-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>Versión: <span className="font-mono">{POLITICA_PRIVACIDAD_VERSION}</span></span>
            <Link href="/login" className="text-[#C9A227] hover:underline font-medium">
              Volver al portal →
            </Link>
          </div>

        </article>
      </div>
    </div>
  )
}
