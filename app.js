const STORAGE_KEY = 'csv_data';
const fileInput = document.getElementById('file-input');
const status = document.getElementById('status');
const clearBtn = document.getElementById('clear-btn');
const channelGrid = document.getElementById('channel-grid');

const TOTAL_CHANNELS = 32;

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
  const txSub = parseInt(getField(headers, row, COL.TX_SUB), 10) || 0;
  const rxSub = parseInt(getField(headers, row, COL.RX_SUB), 10) || 0;
  const val = txSub || rxSub;
  if (val === 0) return '';
  return val < 6700 ? 'DTS' : 'CTC';
}

function buildCellHTML(channelNum) {
  const isVFO1 = channelNum === 31;
  const isVFO2 = channelNum === 32;

  if (isVFO1 || isVFO2) {
    const vfoLabel = isVFO1 ? 'VFO1' : 'VFO2';
    return `<div class="cell-header">` +
      `<span class="cell-number" id="ch-${channelNum}-number">${channelNum}</span>` +
      `<span class="cell-flags">` +
      `<span id="ch-${channelNum}-bandwidth"></span>` +
      `<span id="ch-${channelNum}-scan"></span>` +
      `</span>` +
      `</div>` +
      `<div class="cell-name" id="ch-${channelNum}-title">${vfoLabel}</div>` +
      `<div class="cell-detail">` +
      `<span id="ch-${channelNum}-offset"></span>` +
      `<span id="ch-${channelNum}-subaudio"></span>` +
      `</div>`;
  }

  return `<div class="cell-header">` +
    `<span class="cell-number" id="ch-${channelNum}-number">${channelNum}</span>` +
    `<span class="cell-flags">` +
    `<span id="ch-${channelNum}-bandwidth"></span>` +
    `<span id="ch-${channelNum}-scan"></span>` +
    `</span>` +
    `</div>` +
    `<div class="cell-name" id="ch-${channelNum}-title"></div>` +
    `<div class="cell-detail">` +
    `<span id="ch-${channelNum}-offset"></span>` +
    `<span id="ch-${channelNum}-subaudio"></span>` +
    `</div>`;
}

function buildEmptyGrid() {
  channelGrid.innerHTML = '';
  for (let i = 1; i <= TOTAL_CHANNELS; i++) {
    const cell = document.createElement('div');
    cell.className = 'channel-cell';
    cell.id = `ch-${i}`;
    if (i === 31 || i === 32) cell.classList.add('vfo-cell');
    cell.innerHTML = buildCellHTML(i);
    channelGrid.appendChild(cell);
  }
}

function renderGrid(parsed) {
  buildEmptyGrid();
  const { headers, channels } = parsed;
  if (headers.length === 0) return;

  let populated = 0;

  for (let i = 0; i < channels.length && i < 30; i++) {
    const channelNum = i + 1;
    const row = channels[i];
    if (!row) continue;

    const title = getField(headers, row, COL.TITLE);
    const bandwidth = deriveBandwidth(headers, row);
    const scan = deriveScan(headers, row);
    const offset = deriveOffset(headers, row);
    const subAudio = deriveSubAudio(headers, row);

    const titleEl = document.getElementById(`ch-${channelNum}-title`);
    const bwEl = document.getElementById(`ch-${channelNum}-bandwidth`);
    const scanEl = document.getElementById(`ch-${channelNum}-scan`);
    const offsetEl = document.getElementById(`ch-${channelNum}-offset`);
    const subEl = document.getElementById(`ch-${channelNum}-subaudio`);

    if (titleEl) titleEl.textContent = title;
    if (bwEl) bwEl.textContent = bandwidth;
    if (scanEl) scanEl.textContent = scan;
    if (offsetEl) offsetEl.textContent = offset;
    if (subEl) subEl.textContent = subAudio;

    populated++;
  }

  clearBtn.style.display = 'inline-block';
  status.textContent = `Loaded ${populated} channel(s).`;
}

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
    const parsed = parseCSV(text);
    renderGrid(parsed);
  };
  reader.readAsText(file);
});

clearBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  buildEmptyGrid();
  clearBtn.style.display = 'none';
  fileInput.value = '';
  status.textContent = 'Stored data cleared.';
});

// On page load, build grid and populate from localStorage if available
buildEmptyGrid();
const stored = localStorage.getItem(STORAGE_KEY);
if (stored) {
  const parsed = parseCSV(stored);
  renderGrid(parsed);
  status.textContent += ' (Loaded from localStorage)';
}
