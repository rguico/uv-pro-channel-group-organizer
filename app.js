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
    if (i === 31 || i === 32) cell.classList.add('vfo-cell');
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
  status.textContent = `Loaded ${populated} channel(s).`;
}

// Select a cell on click (only one at a time)
channelGrid.addEventListener('click', (e) => {
  const cell = e.target.closest('.channel-cell');
  if (!cell) return;
  const prev = channelGrid.querySelector('.channel-cell.selected');
  if (prev) prev.classList.remove('selected');
  cell.classList.add('selected');
});

// On page load, build grid and initialize import
buildEmptyGrid();
initImport();
