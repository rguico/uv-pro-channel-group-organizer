const TOTAL_CHANNELS = 32;
const channelGrid = document.getElementById('channel-grid');

function buildCellHTML(channelNum) {
  const isVFO1 = channelNum === 31;
  const isVFO2 = channelNum === 32;

  if (isVFO1 || isVFO2) {
    const vfoLabel = isVFO1 ? 'VFO1' : 'VFO2';
    return `<div class="cell-header">` +
      `<span class="cell-number" id="ch-${channelNum}-number">${channelNum}</span>` +
      `<span class="cell-flags">` +
      `<span id="ch-${channelNum}-bandwidth"></span>` +
      `<span class="cell-scan" id="ch-${channelNum}-scan"></span>` +
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
    `<span class="cell-scan" id="ch-${channelNum}-scan"></span>` +
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
    if (i === 31 || i === 32) {
      cell.classList.add('vfo-cell');
    } else {
      cell.draggable = true;
      cell.dataset.channel = i;
    }
    cell.innerHTML = buildCellHTML(i);
    channelGrid.appendChild(cell);
  }
}

function renderGrid(parsed) {
  buildEmptyGrid();
  const { headers, channels } = parsed;
  const clearBtn = document.getElementById('clear-btn');
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

    const cellEl = document.getElementById(`ch-${channelNum}`);
    if (cellEl) cellEl.classList.add('populated');

    populated++;
  }

  clearBtn.style.display = 'inline-block';
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) exportBtn.style.display = 'inline-block';
  showToast(`Loaded ${populated} channel(s).`);
}

// Edit form state
let selectedChannel = null; // 0-based index

// Frequency conversion helpers
function hzToMhz(hz) {
  const val = parseInt(hz, 10) || 0;
  if (val === 0) return '0.000';
  return (val / 1000000).toFixed(3);
}

function mhzToHz(mhz) {
  const val = parseFloat(mhz) || 0;
  return String(Math.round(val * 1000000));
}

// Compute modulation from frequency
function computeModulation(freqHz) {
  const mhz = parseInt(freqHz, 10) / 1000000;
  return (mhz >= 118 && mhz <= 137) ? '1' : '0';
}

// Update modulation indicators based on current freq inputs
function updateModulationIndicators() {
  const txHz = mhzToHz(document.getElementById('edit-tx-freq').value);
  const rxHz = mhzToHz(document.getElementById('edit-rx-freq').value);

  const rxMod = computeModulation(rxHz);
  const txMod = computeModulation(txHz);

  const rxEl = document.getElementById('edit-rx-mod-indicator');
  const txEl = document.getElementById('edit-tx-mod-indicator');

  rxEl.textContent = rxMod === '1' ? 'AM' : 'FM';
  rxEl.className = 'mod-indicator' + (rxMod === '1' ? ' am' : '');
  txEl.textContent = txMod === '1' ? 'AM' : 'FM';
  txEl.className = 'mod-indicator' + (txMod === '1' ? ' am' : '');
}

// Subtone helpers
function populateSubtoneDropdown(selectEl, type) {
  selectEl.innerHTML = '';
  if (type === 'ctcss') {
    for (const freq of CTCSS_VALUES) {
      const opt = document.createElement('option');
      opt.value = String(Math.round(freq * 100));
      opt.textContent = freq.toFixed(1) + ' Hz';
      selectEl.appendChild(opt);
    }
    selectEl.style.display = '';
  } else if (type === 'dcs') {
    for (const code of DCS_CODES) {
      const opt = document.createElement('option');
      opt.value = String(code);
      opt.textContent = 'DCS-' + String(code).padStart(3, '0') + 'N';
      selectEl.appendChild(opt);
    }
    selectEl.style.display = '';
  } else {
    selectEl.style.display = 'none';
  }
}

function classifySubtone(storedValue) {
  const v = parseInt(storedValue, 10) || 0;
  if (v === 0) return { type: 'off', value: '0' };
  if (CTCSS_STORED.indexOf(v) >= 0) return { type: 'ctcss', value: String(v) };
  if (DCS_CODES.indexOf(v) >= 0) return { type: 'dcs', value: String(v) };
  return { type: 'off', value: '0' };
}

function getSubtoneStoredValue(typeSelect, valueSelect) {
  const type = typeSelect.value;
  if (type === 'off') return '0';
  return valueSelect.value || '0';
}

function setupSubtoneListeners(typeId, valueId) {
  const typeSelect = document.getElementById(typeId);
  const valueSelect = document.getElementById(valueId);
  typeSelect.addEventListener('change', () => {
    populateSubtoneDropdown(valueSelect, typeSelect.value);
  });
}

// Populate the edit form from a channel index
function populateEditForm(idx) {
  const formEmpty = document.getElementById('edit-form-empty');
  const form = document.getElementById('edit-form');
  const heading = document.getElementById('edit-form-title');

  if (idx === null || channelData.headers.length === 0) {
    formEmpty.style.display = '';
    form.style.display = 'none';
    return;
  }

  formEmpty.style.display = 'none';
  form.style.display = '';
  heading.textContent = 'Edit Channel ' + (idx + 1);

  const row = channelData.channels[idx];
  const h = channelData.headers;

  // Field values (defaults for empty/null row)
  const title = row ? getField(h, row, COL.TITLE) : '';
  const txFreq = row ? getField(h, row, COL.TX_FREQ) : '0';
  const rxFreq = row ? getField(h, row, COL.RX_FREQ) : '0';
  const txSub = row ? getField(h, row, COL.TX_SUB) : '0';
  const rxSub = row ? getField(h, row, COL.RX_SUB) : '0';
  const txPower = row ? getField(h, row, COL.TX_POWER) : 'M';
  const bandwidth = row ? getField(h, row, COL.BANDWIDTH) : '25000';
  const scan = row ? getField(h, row, COL.SCAN) : '0';
  const talkAround = row ? getField(h, row, COL.TALK_AROUND) : '0';
  const preDeEmph = row ? getField(h, row, COL.PRE_DE_EMPH) : '0';
  const sign = row ? getField(h, row, COL.SIGN) : '0';
  const txDis = row ? getField(h, row, COL.TX_DIS) : '0';
  const bclo = row ? getField(h, row, COL.BCLO) : '0';
  const mute = row ? getField(h, row, COL.MUTE) : '0';

  // Populate text fields
  document.getElementById('edit-title').value = title;
  document.getElementById('edit-tx-freq').value = hzToMhz(txFreq);
  document.getElementById('edit-rx-freq').value = hzToMhz(rxFreq);

  // Subtones
  const txSubClass = classifySubtone(txSub);
  const txSubType = document.getElementById('edit-tx-sub-type');
  const txSubValue = document.getElementById('edit-tx-sub-value');
  txSubType.value = txSubClass.type;
  populateSubtoneDropdown(txSubValue, txSubClass.type);
  if (txSubClass.type !== 'off') txSubValue.value = txSubClass.value;

  const rxSubClass = classifySubtone(rxSub);
  const rxSubType = document.getElementById('edit-rx-sub-type');
  const rxSubValue = document.getElementById('edit-rx-sub-value');
  rxSubType.value = rxSubClass.type;
  populateSubtoneDropdown(rxSubValue, rxSubClass.type);
  if (rxSubClass.type !== 'off') rxSubValue.value = rxSubClass.value;

  // Selects
  document.getElementById('edit-tx-power').value = txPower || 'M';
  document.getElementById('edit-bandwidth').value = bandwidth || '25000';

  // Checkboxes
  document.getElementById('edit-scan').checked = scan === '1';
  document.getElementById('edit-talk-around').checked = talkAround === '1';
  document.getElementById('edit-pre-de-emph').checked = preDeEmph === '1';
  document.getElementById('edit-sign').checked = sign === '1';
  document.getElementById('edit-tx-dis').checked = txDis === '1';
  document.getElementById('edit-bclo').checked = bclo === '1';
  document.getElementById('edit-mute').checked = mute === '1';

  // Modulation indicators
  updateModulationIndicators();

  // Comment
  document.getElementById('edit-comment').value = channelComments[String(idx)] || '';
}

// Collect form field values into an object suitable for validation and saving
function collectFormFields() {
  const txFreqHz = mhzToHz(document.getElementById('edit-tx-freq').value);
  const rxFreqHz = mhzToHz(document.getElementById('edit-rx-freq').value);

  return {
    title: document.getElementById('edit-title').value,
    tx_freq: txFreqHz,
    rx_freq: rxFreqHz,
    tx_sub_audio: getSubtoneStoredValue(
      document.getElementById('edit-tx-sub-type'),
      document.getElementById('edit-tx-sub-value')
    ),
    rx_sub_audio: getSubtoneStoredValue(
      document.getElementById('edit-rx-sub-type'),
      document.getElementById('edit-rx-sub-value')
    ),
    tx_power: document.getElementById('edit-tx-power').value,
    bandwidth: document.getElementById('edit-bandwidth').value,
    scan: document.getElementById('edit-scan').checked ? '1' : '0',
    talk_around: document.getElementById('edit-talk-around').checked ? '1' : '0',
    pre_de_emph_bypass: document.getElementById('edit-pre-de-emph').checked ? '1' : '0',
    sign: document.getElementById('edit-sign').checked ? '1' : '0',
    tx_dis: document.getElementById('edit-tx-dis').checked ? '1' : '0',
    bclo: document.getElementById('edit-bclo').checked ? '1' : '0',
    mute: document.getElementById('edit-mute').checked ? '1' : '0',
    rx_modulation: computeModulation(rxFreqHz),
    tx_modulation: computeModulation(txFreqHz),
    comment: document.getElementById('edit-comment').value
  };
}

// Apply collected fields to a channel row
function applyFieldsToRow(idx, fields) {
  const h = channelData.headers;
  // Ensure we have at least enough channels in the array
  while (channelData.channels.length <= idx) channelData.channels.push(null);

  let row = channelData.channels[idx];
  if (!row) {
    row = new Array(h.length).fill('0');
    channelData.channels[idx] = row;
  }
  while (row.length < h.length) row.push('0');

  setField(h, row, COL.TITLE, fields.title);
  setField(h, row, COL.TX_FREQ, fields.tx_freq);
  setField(h, row, COL.RX_FREQ, fields.rx_freq);
  setField(h, row, COL.TX_SUB, fields.tx_sub_audio);
  setField(h, row, COL.RX_SUB, fields.rx_sub_audio);
  setField(h, row, COL.TX_POWER, fields.tx_power);
  setField(h, row, COL.BANDWIDTH, fields.bandwidth);
  setField(h, row, COL.SCAN, fields.scan);
  setField(h, row, COL.TALK_AROUND, fields.talk_around);
  setField(h, row, COL.PRE_DE_EMPH, fields.pre_de_emph_bypass);
  setField(h, row, COL.SIGN, fields.sign);
  setField(h, row, COL.TX_DIS, fields.tx_dis);
  setField(h, row, COL.BCLO, fields.bclo);
  setField(h, row, COL.MUTE, fields.mute);
  setField(h, row, COL.RX_MOD, fields.rx_modulation);
  setField(h, row, COL.TX_MOD, fields.tx_modulation);

  // Comment (not in CSV)
  if (fields.comment) {
    channelComments[String(idx)] = fields.comment;
  } else {
    delete channelComments[String(idx)];
  }
}

// Select a cell on click (only one at a time, not VFO cells)
channelGrid.addEventListener('click', (e) => {
  const cell = e.target.closest('.channel-cell');
  if (!cell || !cell.dataset.channel) return;
  const prev = channelGrid.querySelector('.channel-cell.selected');
  if (prev) prev.classList.remove('selected');
  cell.classList.add('selected');
  selectedChannel = parseInt(cell.dataset.channel, 10) - 1;
  populateEditForm(selectedChannel);
});

// Drag-and-drop reordering for channels 1–30
let dragSourceChannel = null;

channelGrid.addEventListener('dragstart', (e) => {
  const cell = e.target.closest('.channel-cell');
  if (!cell || !cell.dataset.channel || !cell.classList.contains('populated')) {
    e.preventDefault();
    return;
  }
  dragSourceChannel = parseInt(cell.dataset.channel, 10);
  e.dataTransfer.effectAllowed = 'move';
  cell.classList.add('dragging');
});

channelGrid.addEventListener('dragover', (e) => {
  const cell = e.target.closest('.channel-cell');
  if (!cell || !cell.dataset.channel) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // Remove previous drag-over indicators
  channelGrid.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  cell.classList.add('drag-over');
});

channelGrid.addEventListener('dragleave', (e) => {
  const cell = e.target.closest('.channel-cell');
  if (cell) cell.classList.remove('drag-over');
});

channelGrid.addEventListener('drop', (e) => {
  e.preventDefault();
  channelGrid.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  const cell = e.target.closest('.channel-cell');
  if (!cell || !cell.dataset.channel || dragSourceChannel === null) return;

  const targetChannel = parseInt(cell.dataset.channel, 10);
  if (targetChannel === dragSourceChannel) return;

  // Convert from 1-based channel numbers to 0-based array indices
  const sourceIdx = dragSourceChannel - 1;
  const targetIdx = targetChannel - 1;
  const targetRow = channelData.channels[targetIdx];

  if (!targetRow) {
    // Target is empty — swap (move source to target, clear source)
    channelData.channels[targetIdx] = channelData.channels[sourceIdx];
    channelData.channels[sourceIdx] = null;
  } else {
    // Target is populated — insert/shift
    const item = channelData.channels.splice(sourceIdx, 1)[0];
    channelData.channels.splice(targetIdx, 0, item);
  }

  saveToLocalStorage();
  renderGrid(channelData);
});

channelGrid.addEventListener('dragend', () => {
  dragSourceChannel = null;
  channelGrid.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  channelGrid.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
});

// Modal dialogs
document.getElementById('how-btn').addEventListener('click', () => {
  document.getElementById('how-dialog').showModal();
});
document.getElementById('about-btn').addEventListener('click', () => {
  document.getElementById('about-dialog').showModal();
});
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => btn.closest('dialog').close());
});

// Edit form button handlers
document.getElementById('edit-save-btn').addEventListener('click', () => {
  if (selectedChannel === null) return;
  // Ensure headers exist even if no CSV was imported yet
  if (channelData.headers.length === 0) {
    channelData.headers = FULL_HEADERS.slice();
  }
  ensureFullHeaders();

  const fields = collectFormFields();
  const result = validateChannel(fields);
  if (!result.valid) {
    showToast(result.errors.join(' | '));
    return;
  }
  applyFieldsToRow(selectedChannel, fields);
  saveToLocalStorage();
  renderGrid(channelData);
  // Re-select the cell visually
  const cellEl = document.getElementById(`ch-${selectedChannel + 1}`);
  if (cellEl) cellEl.classList.add('selected');
  populateEditForm(selectedChannel);
  showToast('Channel ' + (selectedChannel + 1) + ' saved.');
});

document.getElementById('edit-clear-btn').addEventListener('click', () => {
  if (selectedChannel === null) return;
  channelData.channels[selectedChannel] = null;
  delete channelComments[String(selectedChannel)];
  saveToLocalStorage();
  renderGrid(channelData);
  const cellEl = document.getElementById(`ch-${selectedChannel + 1}`);
  if (cellEl) cellEl.classList.add('selected');
  populateEditForm(selectedChannel);
  showToast('Channel ' + (selectedChannel + 1) + ' cleared.');
});

document.getElementById('edit-cancel-btn').addEventListener('click', () => {
  if (selectedChannel === null) return;
  populateEditForm(selectedChannel);
});

// Subtone dropdown listeners
setupSubtoneListeners('edit-tx-sub-type', 'edit-tx-sub-value');
setupSubtoneListeners('edit-rx-sub-type', 'edit-rx-sub-value');

// Realtime modulation updates on freq change
document.getElementById('edit-tx-freq').addEventListener('input', updateModulationIndicators);
document.getElementById('edit-rx-freq').addEventListener('input', updateModulationIndicators);

// On page load, build grid and initialize import
buildEmptyGrid();
initImport();
