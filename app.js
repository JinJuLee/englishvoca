// englishvoca — shared client logic
// Loads a Day file from data/{section}/day-NN.json and renders the active page.

const DEFAULT_SECTION = 'vocabulary';
const DEFAULT_DAY = 1;

async function loadDay(section, day) {
  const padded = String(day).padStart(2, '0');
  const tryPaths = [
    `data/${section}/day-${padded}.json`,
    `data/example/day-${padded}.json`,
  ];
  for (const path of tryPaths) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        data._source = path;
        return data;
      }
    } catch (_) { /* try next */ }
  }
  return null;
}

// ---------- TTS ----------
let cachedVoice = null;
function pickVoice() {
  if (cachedVoice) return cachedVoice;
  const voices = speechSynthesis.getVoices();
  const prefs = [
    v => v.lang === 'en-US' && /Samantha|Allison|Ava|Nicky|Karen|Google US/i.test(v.name),
    v => v.lang === 'en-US' && v.name.toLowerCase().includes('google'),
    v => v.lang === 'en-US',
    v => v.lang.startsWith('en'),
  ];
  for (const fn of prefs) {
    const v = voices.find(fn);
    if (v) { cachedVoice = v; return v; }
  }
  return null;
}
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => { cachedVoice = null; pickVoice(); };
}

function speak(text, { rate = 0.85, repeat = 1, gapMs = 350 } = {}) {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const voice = pickVoice();
  for (let i = 0; i < repeat; i++) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    if (voice) u.voice = voice;
    if (i > 0 && gapMs > 0) {
      // chrome implements small gap between queued utterances; keep simple
    }
    speechSynthesis.speak(u);
  }
}

// ---------- Index page ----------
function renderIndex(data) {
  const tbody = document.querySelector('.index-table tbody');
  if (!tbody || !data) return;
  tbody.innerHTML = '';
  data.words.forEach((w, i) => {
    const tr = document.createElement('tr');
    tr.className = 'row';
    tr.innerHTML = `
      <td class="col-num">${String(i + 1).padStart(2, '0')}</td>
      <td class="col-word"><a href="study.html#${encodeURIComponent(w.id)}">${w.word}</a></td>
      <td class="col-meaning">${w.korean}</td>
      <td class="col-listen"><button class="row-speak" type="button" data-word="${w.word}" aria-label="Listen to ${w.word}">▶</button></td>
      <td class="col-status"></td>
    `;
    tbody.appendChild(tr);
  });

  const topic = document.querySelector('.dateline__topic');
  if (topic) topic.textContent = `Today's Index — ${data.words.length} Words${data.topic ? ' · ' + data.topic : ''}`;
  const progress = document.querySelector('.dateline__progress');
  if (progress) progress.textContent = `0 / ${data.words.length} memorized`;
  const day = document.querySelector('.dateline__day');
  if (day) day.textContent = `Day ${data.day}`;
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.row-speak');
  if (btn) {
    e.preventDefault();
    speak(btn.dataset.word, { repeat: 1 });
  }
});

// ---------- Boot ----------
async function boot() {
  const page = document.body.dataset.page;
  if (page === 'index') {
    const data = await loadDay(DEFAULT_SECTION, DEFAULT_DAY);
    if (data) {
      renderIndex(data);
    } else {
      const tbody = document.querySelector('.index-table tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:32px;text-align:center;font-style:italic;color:var(--ink-soft)">
          No data file found. Run via a local server (see README) or add <code>data/${DEFAULT_SECTION}/day-01.json</code>.
        </td></tr>`;
      }
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
