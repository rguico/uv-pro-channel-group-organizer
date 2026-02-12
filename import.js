const GROUPS_KEY = 'channel_groups';
const ACTIVE_KEY = 'active_group';

let toastTimer = null;
function showToast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 5000);
}

// Shared in-memory data model — holds the current parsed state
let channelData = { headers: [], channels: [] };
let activeGroupName = '';

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

function getGroups() {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveToLocalStorage() {
  const name = activeGroupName;
  if (!name) return;
  try {
    const groups = getGroups();
    groups[name] = serializeCSV(channelData);
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    localStorage.setItem(ACTIVE_KEY, name);
    updateGroupSelect();
  } catch (err) {
    // Silently fail — localStorage may be full
  }
}

function updateGroupSelect() {
  const select = document.getElementById('group-select');
  const area = document.querySelector('.group-select-area');
  if (!select || !area) return;
  const groups = getGroups();
  const names = Object.keys(groups);
  if (names.length < 2) {
    area.style.display = 'none';
    return;
  }
  area.style.display = '';
  select.innerHTML = '';
  for (const name of names) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === activeGroupName) opt.selected = true;
    select.appendChild(opt);
  }
}

function loadGroup(name) {
  const groups = getGroups();
  const csv = groups[name];
  if (!csv) return;
  activeGroupName = name;
  localStorage.setItem(ACTIVE_KEY, name);
  document.getElementById('group-name').value = name;
  importCSVToGrid(csv);
  updateGroupSelect();
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
  const filename = activeGroupName
    ? activeGroupName + '.csv'
    : 'channels.csv';
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function initImport() {
  const fileInput = document.getElementById('file-input');
  const clearBtn = document.getElementById('clear-btn');
  const exportBtn = document.getElementById('export-btn');
  const groupNameInput = document.getElementById('group-name');
  const groupSelect = document.getElementById('group-select');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Derive group name from filename (strip .csv extension)
    const name = file.name.replace(/\.csv$/i, '');
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      activeGroupName = name;
      groupNameInput.value = name;
      importCSVToGrid(text);
      saveToLocalStorage();
    };
    reader.readAsText(file);
  });

  // Rename group when the input changes
  groupNameInput.addEventListener('change', () => {
    const newName = groupNameInput.value.trim();
    if (!newName || newName === activeGroupName) return;
    const groups = getGroups();
    if (activeGroupName && groups[activeGroupName]) {
      groups[newName] = groups[activeGroupName];
      delete groups[activeGroupName];
      localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    }
    activeGroupName = newName;
    localStorage.setItem(ACTIVE_KEY, newName);
    updateGroupSelect();
  });

  // Switch groups via the dropdown
  groupSelect.addEventListener('change', () => {
    const name = groupSelect.value;
    if (name && name !== activeGroupName) {
      loadGroup(name);
    }
  });

  clearBtn.addEventListener('click', () => {
    const label = activeGroupName || 'this group';
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    // Remove the active group from storage
    const groups = getGroups();
    if (activeGroupName) delete groups[activeGroupName];
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    activeGroupName = '';
    groupNameInput.value = '';
    channelData = { headers: [], channels: [] };
    buildEmptyGrid();
    clearBtn.style.display = 'none';
    exportBtn.style.display = 'none';
    fileInput.value = '';
    showToast('Stored data cleared.');
    // If other groups remain, load the first one
    const remaining = Object.keys(groups);
    if (remaining.length > 0) {
      loadGroup(remaining[0]);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
      updateGroupSelect();
    }
  });

  exportBtn.addEventListener('click', () => {
    if (channelData.headers.length === 0) return;
    exportCSV();
  });

  // Migrate old single-key format to new group-keyed format
  const oldData = localStorage.getItem('csv_data');
  if (oldData) {
    const groups = getGroups();
    const migrationName = 'Imported';
    groups[migrationName] = oldData;
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    localStorage.setItem(ACTIVE_KEY, migrationName);
    localStorage.removeItem('csv_data');
  }

  // Load active group from localStorage on startup
  const savedName = localStorage.getItem(ACTIVE_KEY);
  if (savedName) {
    loadGroup(savedName);
    showToast('Loaded from localStorage.');
  }
}
