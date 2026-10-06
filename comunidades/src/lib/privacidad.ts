/** Texto base de la política de privacidad. Cada comunidad puede editarlo en Configuración. */
export function defaultPrivacyPolicy(community: { name: string; cif?: string | null; address?: string | null }): string {
  return `POLÍTICA DE PRIVACIDAD DEL PORTAL DE LA COMUNIDAD

1. Responsable del tratamiento
${community.name}${community.cif ? ` (CIF ${community.cif})` : ""}${community.address ? `, con domicilio en ${community.address}` : ""}. La comunidad de propietarios es la responsable del tratamiento. El administrador de fincas actúa como encargado del tratamiento por cuenta de la comunidad.

2. Finalidad
Gestionar la contabilidad de la comunidad y la relación con los propietarios: emisión y cobro de cuotas y derramas, convocatorias, actas, custodia de la documentación (arts. 19 y 20 de la Ley de Propiedad Horizontal) y atención de solicitudes.

3. Base jurídica
El cumplimiento de las obligaciones legales derivadas de la Ley 49/1960, de Propiedad Horizontal, y la relación que une al propietario con la comunidad.

4. Destinatarios
No se cederán datos a terceros salvo obligación legal (Agencia Tributaria, juzgados y tribunales) o cuando sea necesario para la gestión (entidades bancarias para la domiciliación de recibos). Ningún propietario puede ver los datos de pago de otros propietarios. La relación de deudores solo se incluye en la convocatoria de la junta, conforme al art. 16.2 LPH, y nunca se publica en el portal.

5. Conservación
Los datos se conservarán mientras dure la condición de propietario y, después, durante los plazos de prescripción de las obligaciones legales.

6. Derechos
Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad dirigiéndose al administrador de la comunidad. También puede reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).

Este texto es un modelo orientativo y debe revisarse por la comunidad o su administrador antes de su uso.`;
}
