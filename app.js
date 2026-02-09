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
  const status = document.getElementById('status');
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
  status.textContent = `Loaded ${populated} channel(s).`;
}

// Select a cell on click (only one at a time, not VFO cells)
channelGrid.addEventListener('click', (e) => {
  const cell = e.target.closest('.channel-cell');
  if (!cell || !cell.dataset.channel) return;
  const prev = channelGrid.querySelector('.channel-cell.selected');
  if (prev) prev.classList.remove('selected');
  cell.classList.add('selected');
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

// On page load, build grid and initialize import
buildEmptyGrid();
initImport();
