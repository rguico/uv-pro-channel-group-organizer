const STORAGE_KEY = 'csv_data';
const fileInput = document.getElementById('file-input');
const status = document.getElementById('status');
const clearBtn = document.getElementById('clear-btn');
const csvTable = document.getElementById('csv-table');
const csvHead = document.getElementById('csv-head');
const csvBody = document.getElementById('csv-body');

function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  const chars = text.trim();

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (inQuotes) {
      if (ch === '"' && chars[i + 1] === '"') {
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
        rows[rows.length - 1].push(current);
        current = '';
      } else if (ch === '\n' || (ch === '\r' && chars[i + 1] === '\n')) {
        rows[rows.length - 1].push(current);
        current = '';
        rows.push([]);
        if (ch === '\r') i++;
      } else {
        if (rows.length === 0) rows.push([]);
        current += ch;
      }
    }
  }
  if (rows.length > 0) {
    rows[rows.length - 1].push(current);
  }
  return rows.filter(r => r.length > 0 && r.some(c => c.trim() !== ''));
}

function renderTable(rows) {
  if (rows.length === 0) return;
  csvHead.innerHTML = '';
  csvBody.innerHTML = '';

  const headerRow = document.createElement('tr');
  rows[0].forEach(cell => {
    const th = document.createElement('th');
    th.textContent = cell;
    headerRow.appendChild(th);
  });
  csvHead.appendChild(headerRow);

  for (let i = 1; i < rows.length; i++) {
    const tr = document.createElement('tr');
    rows[i].forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    csvBody.appendChild(tr);
  }

  csvTable.style.display = 'table';
  clearBtn.style.display = 'inline-block';
  status.textContent = `Showing ${rows.length - 1} row(s) with ${rows[0].length} column(s).`;
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
    const rows = parseCSV(text);
    renderTable(rows);
  };
  reader.readAsText(file);
});

clearBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  csvTable.style.display = 'none';
  clearBtn.style.display = 'none';
  fileInput.value = '';
  status.textContent = 'Stored data cleared.';
});

// On page load, check for stored CSV data
const stored = localStorage.getItem(STORAGE_KEY);
if (stored) {
  const rows = parseCSV(stored);
  renderTable(rows);
  status.textContent += ' (Loaded from localStorage)';
}
