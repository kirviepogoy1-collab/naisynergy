// Minimal CSV parser - no external dependency needed for this. Handles
// quoted fields (including embedded commas, quotes, and newlines), strips
// a leading BOM (Excel loves adding one), and tolerates both \n and \r\n
// line endings.
//
// Returns an array of plain objects keyed by the lower-cased, trimmed
// header row, e.g. [{ room_code: 'RM-101', asset_code: 'CHR-001', ... }, ...]
function parseCsv(text) {
    const clean = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        const next = clean[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') { field += '"'; i++; }
            else if (char === '"') { inQuotes = false; }
            else { field += char; }
            continue;
        }

        if (char === '"') inQuotes = true;
        else if (char === ',') { row.push(field); field = ''; }
        else if (char === '\r') { /* ignore, \n (if present) closes the row */ }
        else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else field += char;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

    while (rows.length && rows[rows.length - 1].every((c) => c.trim() === '')) rows.pop();
    if (rows.length === 0) return [];

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const records = [];
    for (let r = 1; r < rows.length; r++) {
        const cols = rows[r];
        if (cols.every((c) => c.trim() === '')) continue;
        const obj = {};
        header.forEach((h, idx) => { obj[h] = cols[idx] !== undefined ? cols[idx] : ''; });
        records.push(obj);
    }
    return records;
}

module.exports = { parseCsv };
