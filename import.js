const STORAGE_KEY = 'csv_data';

// Shared in-memory data model — holds the current parsed state
let channelData = { headers: [], channels: [] };

// Column names from the CSV header
const COL = {
  TITLE: 'title',
  TX_FREQ: 'tx_freq',
  RX_FREQ: 'rx_freq',
  TX_SUB: 'tx_sub_audio(ctcss=freq/dcs=number)',
  RX_SUB: 'rx_sub_audio(ctcss=freq/dcs=number)',
  BANDWIDTH: 'bandwidth(12500/25000)',
  SCAN: 'scan(0=off/1=on)',
};

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length === 0) return { headers: [], channels: [] };

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const channels = [];

  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '') {
      channels.push(null);
    } else {
      channels.push(parseCSVLine(lines[i]));
    }
  }

  return { headers, channels };
}

function getField(headers, row, colName) {
  const idx = headers.indexOf(colName);
  if (idx < 0 || idx >= row.length) return '';
  return row[idx].trim();
}

function deriveBandwidth(headers, row) {
  const val = getField(headers, row, COL.BANDWIDTH);
  if (val === '12500') return 'N';
  if (val === '25000') return 'W';
  return '';
}

function deriveScan(headers, row) {
  return getField(headers, row, COL.SCAN) === '1' ? '\u2968' : '';
}

function deriveOffset(headers, row) {
  const tx = parseInt(getField(headers, row, COL.TX_FREQ), 10) || 0;
  const rx = parseInt(getField(headers, row, COL.RX_FREQ), 10) || 0;
  if (tx === 0 && rx === 0) return '';
  if (tx === 0) return '';
  return tx < rx ? '-' : '+';
}

function deriveSubAudio(headers, row) {
  const rxSub = parseInt(getField(headers, row, COL.RX_SUB), 10) || 0;
  if (rxSub === 0) return '';
  return rxSub < 6700 ? 'DTS' : 'CTC';
}

function serializeCSV(data) {
  const lines = [data.headers.join(',')];
  for (const row of data.channels) {
    if (!row) {
      lines.push('');
    } else {
      lines.push(row.map(field => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return '"' + field.replace(/"/g, '""') + '"';
        }
        return field;
      }).join(','));
    }
  }
  return lines.join('\n');
}

function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, serializeCSV(channelData));
  } catch (err) {
    // Silently fail — localStorage may be full
  }
}

function importCSVToGrid(text) {
  const parsed = parseCSV(text);
  channelData = parsed;
  renderGrid(parsed);
}

function exportCSV() {
  const csv = serializeCSV(channelData);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'channels.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function initImport() {
  const fileInput = document.getElementById('file-input');
  const status = document.getElementById('status');
  const clearBtn = document.getElementById('clear-btn');
  const exportBtn = document.getElementById('export-btn');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      try {
        localStorage.setItem(STORAGE_KEY, text);
      } catch (err) {
        status.textContent = 'File too large for localStorage.';
        return;
      }
      importCSVToGrid(text);
    };
    reader.readAsText(file);
  });

  clearBtn.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    buildEmptyGrid();
    clearBtn.style.display = 'none';
    exportBtn.style.display = 'none';
    fileInput.value = '';
    status.textContent = 'Stored data cleared.';
  });

  exportBtn.addEventListener('click', () => {
    if (channelData.headers.length === 0) return;
    exportCSV();
  });

  // Load from localStorage on startup
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    importCSVToGrid(stored);
    status.textContent += ' (Loaded from localStorage)';
  }
}
