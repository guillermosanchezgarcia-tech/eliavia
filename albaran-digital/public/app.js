const tenantInput = document.getElementById('tenantId');
tenantInput.value = localStorage.getItem('tenant_id') || '';
tenantInput.addEventListener('change', () => {
  localStorage.setItem('tenant_id', tenantInput.value.trim());
});

function getTenant() {
  return tenantInput.value.trim();
}

function requireTenantOrAlert() {
  const t = getTenant();
  if (!t) {
    alert('Indica primero el nombre de la empresa.');
    return null;
  }
  return t;
}

// --- Tabs ---
const tabUpload = document.getElementById('tabUpload');
const tabHistorico = document.getElementById('tabHistorico');
const viewUpload = document.getElementById('viewUpload');
const viewHistorico = document.getElementById('viewHistorico');

function showView(view) {
  [viewUpload, viewHistorico].forEach((v) => v.classList.remove('active'));
  [tabUpload, tabHistorico].forEach((t) => t.classList.remove('active'));
  if (view === 'upload') {
    viewUpload.classList.add('active');
    tabUpload.classList.add('active');
  } else {
    viewHistorico.classList.add('active');
    tabHistorico.classList.add('active');
    cargarHistorico();
  }
}

tabUpload.addEventListener('click', () => showView('upload'));
tabHistorico.addEventListener('click', () => showView('historico'));

// --- Upload & extraccion ---
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const uploadMsg = document.getElementById('uploadMsg');
const btnExtraer = document.getElementById('btnExtraer');
const validationBlock = document.getElementById('validationBlock');
const lineasBody = document.getElementById('lineasBody');

let selectedFile = null;

dropZone.addEventListener('dragover', (e) => e.preventDefault());
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files.length) {
    selectedFile = e.dataTransfer.files[0];
    fileInput.files = e.dataTransfer.files;
  }
});
fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files[0] || null;
});

function mostrarMensaje(el, texto, tipo) {
  el.innerHTML = `<div class="msg ${tipo}">${texto}</div>`;
}

function addLineaRow(linea = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="l-producto" value="${linea.producto || ''}"></td>
    <td><input type="text" class="l-cantidad" value="${linea.cantidad ?? ''}"></td>
    <td><input type="text" class="l-unidad" value="${linea.unidad || ''}"></td>
    <td><input type="text" class="l-precio" value="${linea.precio_unitario ?? ''}"></td>
    <td><input type="text" class="l-importe" value="${linea.importe ?? ''}"></td>
    <td><button type="button" class="btnEliminarLinea">✕</button></td>
  `;
  tr.querySelector('.btnEliminarLinea').addEventListener('click', () => tr.remove());
  lineasBody.appendChild(tr);
}

document.getElementById('btnAddLinea').addEventListener('click', () => addLineaRow());

btnExtraer.addEventListener('click', async () => {
  const tenant = requireTenantOrAlert();
  if (!tenant) return;
  if (!selectedFile) {
    mostrarMensaje(uploadMsg, 'Selecciona primero un archivo.', 'error');
    return;
  }

  mostrarMensaje(uploadMsg, 'Extrayendo datos, espera un momento...', 'ok');

  const formData = new FormData();
  formData.append('archivo', selectedFile);
  formData.append('tenant_id', tenant);

  try {
    const resp = await fetch('/albaranes/extraer', { method: 'POST', body: formData });
    const data = await resp.json();
    if (!resp.ok) {
      mostrarMensaje(uploadMsg, `Error: ${data.error || 'no se pudo extraer'}`, 'error');
      return;
    }
    mostrarMensaje(uploadMsg, 'Extracción completada. Revisa los datos antes de confirmar.', 'ok');
    rellenarValidacion(data.extraido);
  } catch (err) {
    mostrarMensaje(uploadMsg, `Error de red: ${err.message}`, 'error');
  }
});

function rellenarValidacion(extraido) {
  document.getElementById('fProveedor').value = extraido.proveedor || '';
  document.getElementById('fNumero').value = extraido.numero_albaran || '';
  document.getElementById('fFecha').value = extraido.fecha || '';
  document.getElementById('fTotal').value = extraido.total ?? '';
  lineasBody.innerHTML = '';
  (extraido.lineas || []).forEach(addLineaRow);
  if (!extraido.lineas || extraido.lineas.length === 0) addLineaRow();
  validationBlock.style.display = 'block';
}

document.getElementById('btnCancelar').addEventListener('click', () => {
  validationBlock.style.display = 'none';
  lineasBody.innerHTML = '';
  selectedFile = null;
  fileInput.value = '';
  uploadMsg.innerHTML = '';
});

document.getElementById('btnConfirmar').addEventListener('click', async () => {
  const tenant = requireTenantOrAlert();
  if (!tenant) return;

  const lineas = Array.from(lineasBody.querySelectorAll('tr')).map((tr) => ({
    producto: tr.querySelector('.l-producto').value.trim(),
    cantidad: tr.querySelector('.l-cantidad').value.trim(),
    unidad: tr.querySelector('.l-unidad').value.trim(),
    precio_unitario: tr.querySelector('.l-precio').value.trim(),
    importe: tr.querySelector('.l-importe').value.trim()
  })).filter((l) => l.producto);

  const payload = {
    tenant_id: tenant,
    proveedor: document.getElementById('fProveedor').value.trim(),
    numero_albaran: document.getElementById('fNumero').value.trim(),
    fecha: document.getElementById('fFecha').value.trim(),
    total: document.getElementById('fTotal').value.trim(),
    lineas
  };

  if (!payload.proveedor || lineas.length === 0) {
    mostrarMensaje(uploadMsg, 'Proveedor y al menos una línea son obligatorios.', 'error');
    return;
  }

  try {
    const resp = await fetch('/albaranes/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok) {
      mostrarMensaje(uploadMsg, `Error: ${data.error || 'no se pudo guardar'}`, 'error');
      return;
    }
    mostrarMensaje(uploadMsg, `Albarán guardado (id ${data.id}).`, 'ok');
    validationBlock.style.display = 'none';
    lineasBody.innerHTML = '';
    selectedFile = null;
    fileInput.value = '';
  } catch (err) {
    mostrarMensaje(uploadMsg, `Error de red: ${err.message}`, 'error');
  }
});

// --- Historico ---
const historicoBody = document.getElementById('historicoBody');
const linkExport = document.getElementById('linkExport');

async function cargarHistorico() {
  const tenant = getTenant();
  if (!tenant) {
    historicoBody.innerHTML = '<tr><td colspan="6">Indica una empresa arriba para ver su histórico.</td></tr>';
    return;
  }
  linkExport.href = `/albaranes/export?tenant_id=${encodeURIComponent(tenant)}`;

  try {
    const resp = await fetch(`/albaranes?tenant_id=${encodeURIComponent(tenant)}`);
    const data = await resp.json();
    historicoBody.innerHTML = '';
    (data.albaranes || []).forEach((a) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${a.fecha || ''}</td>
        <td>${a.proveedor || ''}</td>
        <td>${a.numero_albaran || ''}</td>
        <td>${a.num_lineas}</td>
        <td>${a.total ?? ''}</td>
        <td>${a.created_at}</td>
      `;
      historicoBody.appendChild(tr);
    });
    if ((data.albaranes || []).length === 0) {
      historicoBody.innerHTML = '<tr><td colspan="6">Sin albaranes registrados todavía.</td></tr>';
    }
  } catch (err) {
    historicoBody.innerHTML = `<tr><td colspan="6">Error cargando histórico: ${err.message}</td></tr>`;
  }
}

document.getElementById('btnRefrescar').addEventListener('click', cargarHistorico);
