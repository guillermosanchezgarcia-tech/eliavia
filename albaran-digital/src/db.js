const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'albaranes.sqlite');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS albaranes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    proveedor TEXT NOT NULL,
    numero_albaran TEXT,
    fecha TEXT,
    total REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lineas_albaran (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    albaran_id INTEGER NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
    producto TEXT NOT NULL,
    cantidad REAL,
    unidad TEXT,
    precio_unitario REAL,
    importe REAL
  );

  CREATE INDEX IF NOT EXISTS idx_albaranes_tenant ON albaranes(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_lineas_albaran ON lineas_albaran(albaran_id);
`);

module.exports = db;
