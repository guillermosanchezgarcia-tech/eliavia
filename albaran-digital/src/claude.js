const fs = require('node:fs');
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-4-6';

const EXTRACTION_TOOL = {
  name: 'registrar_albaran',
  description: 'Registra los datos estructurados extraidos de un albaran de proveedor.',
  input_schema: {
    type: 'object',
    properties: {
      proveedor: { type: 'string', description: 'Nombre del proveedor o cooperativa emisora del albaran.' },
      numero_albaran: { type: 'string', description: 'Numero o codigo identificativo del albaran.' },
      fecha: { type: 'string', description: 'Fecha del albaran en formato YYYY-MM-DD si es posible.' },
      lineas: {
        type: 'array',
        description: 'Lineas de producto del albaran.',
        items: {
          type: 'object',
          properties: {
            producto: { type: 'string' },
            cantidad: { type: 'number' },
            unidad: { type: 'string', description: 'Ej: kg, cajas, unidades.' },
            precio_unitario: { type: 'number' },
            importe: { type: 'number' }
          },
          required: ['producto']
        }
      },
      total: { type: 'number', description: 'Importe total del albaran.' }
    },
    required: ['proveedor', 'lineas']
  }
};

function mimeToDocType(mime) {
  if (mime === 'application/pdf') return 'document';
  if (mime.startsWith('image/')) return 'image';
  return null;
}

async function extraerAlbaran(filePath, mimeType) {
  const docType = mimeToDocType(mimeType);
  if (!docType) {
    throw new Error(`Tipo de archivo no soportado: ${mimeType}`);
  }

  const client = new Anthropic();
  const base64 = fs.readFileSync(filePath).toString('base64');

  const contentBlock =
    docType === 'document'
      ? { type: 'document', source: { type: 'base64', media_type: mimeType, data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      'Eres un asistente que extrae datos estructurados de albaranes de mercancia hortofruticola. ' +
      'Lee el documento con cuidado y usa la herramienta registrar_albaran para devolver los datos. ' +
      'Si un campo no aparece en el documento, omitelo en vez de inventar un valor. ' +
      'Los numeros deben usar punto decimal, sin simbolos de moneda ni separadores de miles.',
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: 'tool', name: 'registrar_albaran' },
    messages: [
      {
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: 'Extrae los datos de este albaran.' }
        ]
      }
    ]
  });

  const toolUse = message.content.find((block) => block.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Claude no devolvio una extraccion estructurada.');
  }

  return toolUse.input;
}

module.exports = { extraerAlbaran };
