const GROUPS_KEY = 'channel_groups';
const ACTIVE_KEY = 'active_group';
const COMMENTS_KEY = 'channel_comments';

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
let channelComments = {};

// Column names from the CSV header (all 16 columns)
const COL = {
  TITLE: 'title',
  TX_FREQ: 'tx_freq',
  RX_FREQ: 'rx_freq',
  TX_SUB: 'tx_sub_audio(ctcss=freq/dcs=number)',
  RX_SUB: 'rx_sub_audio(ctcss=freq/dcs=number)',
  TX_POWER: 'tx_power(h/m/l)',
  BANDWIDTH: 'bandwidth(12500/25000)',
  SCAN: 'scan(0=off/1=on)',
  TALK_AROUND: 'talk around(0=off/1=on)',
  PRE_DE_EMPH: 'pre_de_emph_bypass(0=off/1=on)',
  SIGN: 'sign(0=off/1=on)',
  TX_DIS: 'tx_dis(0=off/1=on)',
  BCLO: 'bclo(0=off/1=on)',
  MUTE: 'mute(0=off/1=on)',
  RX_MOD: 'rx_modulation(0=fm/1=am)',
  TX_MOD: 'tx_modulation(0=fm/1=am)',
};

// Canonical ordered list of all 16 headers
const FULL_HEADERS = [
  COL.TITLE, COL.TX_FREQ, COL.RX_FREQ, COL.TX_SUB, COL.RX_SUB,
  COL.TX_POWER, COL.BANDWIDTH, COL.SCAN, COL.TALK_AROUND, COL.PRE_DE_EMPH,
  COL.SIGN, COL.TX_DIS, COL.BCLO, COL.MUTE, COL.RX_MOD, COL.TX_MOD
];

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

function setField(headers, row, colName, value) {
  const idx = headers.indexOf(colName);
  if (idx < 0) return;
  while (row.length <= idx) row.push('');
  row[idx] = value;
}

// Ensure headers include all 16 columns and rows are padded accordingly
function ensureFullHeaders() {
  for (const h of FULL_HEADERS) {
    if (channelData.headers.indexOf(h) < 0) {
      channelData.headers.push(h);
    }
  }
  const colCount = channelData.headers.length;
  for (let i = 0; i < channelData.channels.length; i++) {
    const row = channelData.channels[i];
    if (row) {
      while (row.length < colCount) row.push('0');
    }
  }
}

// Comment persistence helpers
function getComments() {
  try {
    return JSON.parse(localStorage.getItem(COMMENTS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveComments() {
  const name = activeGroupName;
  if (!name) return;
  try {
    const all = getComments();
    all[name] = channelComments;
    localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
  } catch (e) {
    // Silently fail
  }
}

function loadCommentsForGroup(name) {
  const all = getComments();
  channelComments = (all[name] || {});
}

function deleteCommentsForGroup(name) {
  const all = getComments();
  delete all[name];
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
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
    saveComments();
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
  loadCommentsForGroup(name);
  importCSVToGrid(csv);
  updateGroupSelect();
}

function importCSVToGrid(text) {
  const parsed = parseCSV(text);
  channelData = parsed;
  ensureFullHeaders();
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
    const allComments = getComments();
    if (activeGroupName && groups[activeGroupName]) {
      groups[newName] = groups[activeGroupName];
      delete groups[activeGroupName];
      localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
      if (allComments[activeGroupName]) {
        allComments[newName] = allComments[activeGroupName];
        delete allComments[activeGroupName];
        localStorage.setItem(COMMENTS_KEY, JSON.stringify(allComments));
      }
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
    if (activeGroupName) {
      delete groups[activeGroupName];
      deleteCommentsForGroup(activeGroupName);
    }
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
