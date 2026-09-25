function escapeCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",;\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows, columns) {
  const header = columns.map(escapeCsvField).join(';');
  const lines = rows.map((row) => columns.map((col) => escapeCsvField(row[col])).join(';'));
  return [header, ...lines].join('\n');
}

module.exports = { toCsv };
