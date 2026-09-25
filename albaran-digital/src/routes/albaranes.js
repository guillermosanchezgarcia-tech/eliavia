const express = require('express');
const fs = require('node:fs');
const multer = require('multer');
const path = require('node:path');

const db = require('../db');
const { extraerAlbaran } = require('../claude');
const { toCsv } = require('../csv');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads'),
  limits: { fileSize: 15 * 1024 * 1024 }
});

function requireTenant(req, res, next) {
  const tenantId = req.body?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
  if (!tenantId) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Falta tenant_id (empresa).' });
  }
  req.tenantId = String(tenantId).trim();
  next();
}

// POST /albaranes/extraer  -> sube archivo, devuelve JSON extraido (sin persistir)
router.post('/extraer', upload.single('archivo'), requireTenant, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Falta el archivo (campo "archivo").' });
  }

  try {
    const extraido = await extraerAlbaran(req.file.path, req.file.mimetype);
    res.json({ tenant_id: req.tenantId, extraido });
  } catch (err) {
    console.error('Error extrayendo albaran:', err);
    res.status(502).json({ error: 'No se pudo extraer el albaran. Introduce los datos manualmente.', detalle: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// POST /albaranes/confirmar -> guarda el albaran ya validado por el usuario
router.post('/confirmar', express.json(), requireTenant, (req, res) => {
  const { proveedor, numero_albaran, fecha, total, lineas } = req.body || {};

  if (!proveedor || !Array.isArray(lineas) || lineas.length === 0) {
    return res.status(400).json({ error: 'Faltan proveedor y/o lineas de producto.' });
  }

  const insertAlbaran = db.prepare(
    `INSERT INTO albaranes (tenant_id, proveedor, numero_albaran, fecha, total)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertLinea = db.prepare(
    `INSERT INTO lineas_albaran (albaran_id, producto, cantidad, unidad, precio_unitario, importe)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const result = insertAlbaran.run(
    req.tenantId,
    String(proveedor),
    numero_albaran ? String(numero_albaran) : null,
    fecha ? String(fecha) : null,
    total !== undefined && total !== null && total !== '' ? Number(total) : null
  );

  const albaranId = result.lastInsertRowid;

  for (const linea of lineas) {
    if (!linea || !linea.producto) continue;
    insertLinea.run(
      albaranId,
      String(linea.producto),
      linea.cantidad !== undefined && linea.cantidad !== null && linea.cantidad !== '' ? Number(linea.cantidad) : null,
      linea.unidad ? String(linea.unidad) : null,
      linea.precio_unitario !== undefined && linea.precio_unitario !== null && linea.precio_unitario !== '' ? Number(linea.precio_unitario) : null,
      linea.importe !== undefined && linea.importe !== null && linea.importe !== '' ? Number(linea.importe) : null
    );
  }

  res.status(201).json({ id: Number(albaranId) });
});

// GET /albaranes -> listado historico del tenant
router.get('/', requireTenant, (req, res) => {
  const albaranes = db
    .prepare(
      `SELECT a.id, a.proveedor, a.numero_albaran, a.fecha, a.total, a.created_at,
              COUNT(l.id) AS num_lineas
       FROM albaranes a
       LEFT JOIN lineas_albaran l ON l.albaran_id = a.id
       WHERE a.tenant_id = ?
       GROUP BY a.id
       ORDER BY a.created_at DESC`
    )
    .all(req.tenantId);

  res.json({ albaranes });
});

// GET /albaranes/export -> CSV con columnas genericas para importar a un ERP
router.get('/export', requireTenant, (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.numero_albaran, a.fecha, a.proveedor, a.total AS total_albaran,
              l.producto, l.cantidad, l.unidad, l.precio_unitario, l.importe
       FROM albaranes a
       JOIN lineas_albaran l ON l.albaran_id = a.id
       WHERE a.tenant_id = ?
       ORDER BY a.created_at DESC, l.id ASC`
    )
    .all(req.tenantId);

  const columns = [
    'numero_albaran',
    'fecha',
    'proveedor',
    'producto',
    'cantidad',
    'unidad',
    'precio_unitario',
    'importe',
    'total_albaran'
  ];

  const csv = toCsv(rows, columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="albaranes_${req.tenantId}.csv"`);
  res.send('﻿' + csv);
});

module.exports = router;
