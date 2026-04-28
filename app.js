// englishvoca — shared client logic.
// Pages register themselves via <body data-page="index|study|test">.
// Day selection is shared across pages via localStorage.

const STORAGE_KEY = 'englishvoca.selection';
const DEFAULT_SECTION = 'vocabulary';
const SECTION_DAY_COUNT = { vocabulary: 30 };

// ---------- Selection state ----------
function getSelection(section = DEFAULT_SECTION) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const days = all[section];
    return Array.isArray(days) && days.length ? days.slice().sort((a, b) => a - b) : [1];
  } catch {
    return [1];
  }
}
function saveSelection(section, days) {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  all[section] = days.slice().sort((a, b) => a - b);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
function toggleDay(section, day) {
  const cur = getSelection(section);
  const idx = cur.indexOf(day);
  if (idx >= 0) cur.splice(idx, 1);
  else cur.push(day);
  if (cur.length === 0) cur.push(day); // never end up empty
  saveSelection(section, cur);
  return cur;
}

// ---------- Data loading ----------
async function loadDay(section, day) {
  const padded = String(day).padStart(2, '0');
  const candidates = [
    `data/${section}/day-${padded}.json`,
    `data/example/day-${padded}.json`,
  ];
  for (const path of candidates) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch { /* try next */ }
  }
  return null;
}

async function loadSelectedDays(section) {
  const days = getSelection(section);
  const results = await Promise.all(days.map(d => loadDay(section, d)));
  const successful = results.filter(Boolean);
  const words = successful.flatMap(d => (d.words || []).map(w => ({ ...w, _day: d.day })));
  return { days, available: successful.map(d => d.day), words };
}

// ---------- TTS ----------
let cachedVoice = null;
function pickVoice() {
  if (cachedVoice) return cachedVoice;
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  const matchers = [
    v => v.lang === 'en-US' && /Samantha|Allison|Ava|Nicky|Karen/i.test(v.name),
    v => v.lang === 'en-US' && /Google US/i.test(v.name),
    v => v.lang === 'en-US',
    v => v.lang.startsWith('en'),
  ];
  for (const m of matchers) {
    const v = voices.find(m);
    if (v) { cachedVoice = v; return v; }
  }
  return null;
}
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => { cachedVoice = null; pickVoice(); };
}

function speakOnce(text, { rate = 0.85 } = {}) {
  if (typeof speechSynthesis === 'undefined' || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  const v = pickVoice();
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

// Continuous-loop TTS: speak → 1s gap → speak → ...
const loop = { active: false, timer: null, text: '' };
function startLoop(text, { gapMs = 1000, rate = 0.85 } = {}) {
  stopLoop();
  loop.active = true;
  loop.text = text;
  const tick = () => {
    if (!loop.active || loop.text !== text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    const v = pickVoice();
    if (v) u.voice = v;
    u.onend = () => {
      if (loop.active && loop.text === text) {
        loop.timer = setTimeout(tick, gapMs);
      }
    };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };
  tick();
}
function stopLoop() {
  loop.active = false;
  loop.text = '';
  if (loop.timer) clearTimeout(loop.timer);
  loop.timer = null;
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopLoop();
});

// ---------- Editions chip strip ----------
function buildEditions(section) {
  const list = document.querySelector('.editions__list');
  if (!list) return;
  const total = SECTION_DAY_COUNT[section] || 30;
  const selected = new Set(getSelection(section));
  const chips = [];
  for (let d = 1; d <= total; d++) {
    const cls = ['edition'];
    if (selected.has(d)) cls.push('is-active');
    chips.push(`<button class="${cls.join(' ')}" type="button" data-day="${d}">${String(d).padStart(2, '0')}</button>`);
  }
  chips.push(`<button class="edition edition--custom" type="button" data-day="custom" aria-label="Custom words">+</button>`);
  list.innerHTML = chips.join('');
}

function syncEditionsActive(section) {
  const selected = new Set(getSelection(section));
  document.querySelectorAll('.edition[data-day]').forEach(btn => {
    const day = parseInt(btn.dataset.day, 10);
    if (Number.isNaN(day)) return;
    btn.classList.toggle('is-active', selected.has(day));
  });
}

function wireEditions(section, onChange) {
  const list = document.querySelector('.editions__list');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.edition[data-day]');
    if (!btn) return;
    const day = parseInt(btn.dataset.day, 10);
    if (Number.isNaN(day)) return;
    toggleDay(section, day);
    syncEditionsActive(section);
    onChange?.();
  });
}

// ---------- Index page ----------
async function renderIndex() {
  const tbody = document.querySelector('.index-table tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" style="padding:24px;text-align:center;font-style:italic;color:var(--ink-soft)">Loading…</td></tr>`;

  const { days, available, words } = await loadSelectedDays(DEFAULT_SECTION);

  if (!words.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding:32px;text-align:center;font-style:italic;color:var(--ink-soft)">
      No data for selected days (${days.join(', ')}). Run via local server or add files under <code>data/${DEFAULT_SECTION}/</code>.
    </td></tr>`;
  } else {
    tbody.innerHTML = words.map((w, i) => `
      <tr class="row" data-day="${w._day}">
        <td class="col-num">${String(i + 1).padStart(2, '0')}</td>
        <td class="col-word"><a href="study.html#${encodeURIComponent(w.id)}">${w.word}</a></td>
        <td class="col-meaning">${escapeHtml(w.korean)}</td>
        <td class="col-listen"><button class="row-speak" type="button" data-word="${escapeAttr(w.word)}" aria-label="Listen to ${escapeAttr(w.word)}">▶</button></td>
      </tr>
    `).join('');
  }

  const dayLabel = document.querySelector('.dateline__day');
  const topic = document.querySelector('.dateline__topic');
  const progress = document.querySelector('.dateline__progress');
  if (dayLabel) dayLabel.textContent = formatDayLabel(days);
  if (topic) topic.textContent = `Today's Index — ${words.length} word${words.length === 1 ? '' : 's'}`;
  if (progress) progress.textContent = available.length === days.length ? '' : `${available.length} / ${days.length} days loaded`;
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.row-speak');
  if (btn) {
    e.preventDefault();
    speakOnce(btn.dataset.word);
  }
});

// ---------- Study page ----------
const study = { words: [], idx: 0, paused: false };

function showStudyWord(word) {
  if (!word) return;
  const $ = sel => document.querySelector(sel);
  $('.entry__pos').textContent = word.pos || '';
  $('.entry__word').textContent = word.word;
  $('.ipa').textContent = word.ipa || '';
  $('.entry__american').textContent = word.americanUsage || '';
  $('.entry__toefl').textContent = word.toeflContext || '';
  const ex = word.examples && word.examples[0];
  $('.entry__quote').innerHTML = ex
    ? `“${highlightWord(ex.en, word.word)}”`
    : '';

  // Korean fades in 1 second after word change.
  const lede = $('.entry__lede');
  lede.style.transition = 'none';
  lede.style.opacity = '0';
  lede.textContent = word.korean || '';
  void lede.offsetHeight; // force reflow
  setTimeout(() => {
    lede.style.transition = 'opacity 0.6s ease';
    lede.style.opacity = '1';
  }, 1500);

  // start the TTS loop unless paused
  if (!study.paused) startLoop(word.word, { gapMs: 1000 });
}

function updateStudyChrome() {
  const total = study.words.length;
  const cur = total ? study.idx + 1 : 0;
  document.querySelector('.pager__count').textContent = total ? `${cur} / ${total}` : '— / —';
  const w = study.words[study.idx];
  const dayLabel = document.querySelector('.dateline__day');
  if (dayLabel) dayLabel.textContent = w ? `Day ${w._day}` : '';
  const progress = document.querySelector('.dateline__progress');
  if (progress) progress.textContent = total ? `${cur} of ${total}` : '';
}

function studyAdvance(delta) {
  if (!study.words.length) return;
  study.idx = (study.idx + delta + study.words.length) % study.words.length;
  updateStudyChrome();
  showStudyWord(study.words[study.idx]);
}

function studyTogglePause() {
  study.paused = !study.paused;
  const btn = document.querySelector('.pager__pause');
  if (study.paused) {
    stopLoop();
    if (btn) btn.innerHTML = '▶&nbsp;Resume';
  } else {
    if (btn) btn.innerHTML = '❚❚&nbsp;Pause';
    const w = study.words[study.idx];
    if (w) startLoop(w.word, { gapMs: 1000 });
  }
}

async function bootStudy() {
  const { words } = await loadSelectedDays(DEFAULT_SECTION);
  study.words = words;
  study.idx = 0;

  // honor #word-id in URL hash
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (hash) {
    const i = words.findIndex(w => w.id === hash);
    if (i >= 0) study.idx = i;
  }

  if (!words.length) {
    document.querySelector('.entry__word').textContent = 'No words loaded';
    document.querySelector('.entry__lede').textContent = '선택한 Day에 데이터가 없습니다.';
    return;
  }
  updateStudyChrome();
  showStudyWord(words[study.idx]);

  document.querySelector('.pager__prev').addEventListener('click', () => studyAdvance(-1));
  document.querySelector('.pager__next').addEventListener('click', () => studyAdvance(+1));
  document.querySelector('.pager__pause').addEventListener('click', studyTogglePause);
  document.querySelector('.entry__phonetic .speak').addEventListener('click', () => {
    const w = study.words[study.idx];
    if (w) speakOnce(w.word);
  });
}

// ---------- Test page ----------
const test = { pool: [], queue: [], idx: 0, score: 0, locked: false };

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildOptions(correct, pool, count = 8) {
  const others = pool.filter(w => w.id !== correct.id);
  const need = count - 1;
  const distractors = shuffle(others).slice(0, Math.min(need, others.length)).map(w => w.korean);
  return shuffle([correct.korean, ...distractors]);
}

function renderTestQuestion() {
  const w = test.queue[test.idx];
  if (!w) return renderTestComplete();
  const $ = s => document.querySelector(s);
  $('.quiz__counter').textContent = `Question ${test.idx + 1} of ${test.queue.length}`;
  $('.quiz__word').textContent = w.word;
  $('.quiz__phonetic .ipa').textContent = w.ipa || '';

  const options = buildOptions(w, test.pool);
  const ol = $('.quiz__options');
  ol.innerHTML = options.map(opt => `
    <li><button class="quiz__option" type="button" data-value="${escapeAttr(opt)}">${escapeHtml(opt)}</button></li>
  `).join('');

  $('.quiz__feedback').hidden = true;
  $('.quiz__next').hidden = true;
  test.locked = false;
  speakOnce(w.word);
}

function handleAnswer(selectedValue) {
  if (test.locked) return;
  test.locked = true;
  const w = test.queue[test.idx];
  const correct = w.korean;
  const isRight = selectedValue === correct;
  if (isRight) test.score++;

  document.querySelectorAll('.quiz__option').forEach(btn => {
    const v = btn.dataset.value;
    btn.disabled = true;
    if (v === correct) btn.classList.add('is-correct');
    if (v === selectedValue && v !== correct) btn.classList.add('is-wrong');
  });

  const fb = document.querySelector('.quiz__feedback');
  fb.innerHTML = isRight
    ? `<span class="fb-right">정답</span> · <em>${escapeHtml(correct)}</em>`
    : `<span class="fb-wrong">오답</span> · <em>${escapeHtml(correct)}</em>`;
  fb.hidden = false;

  document.querySelector('.quiz__score').textContent = `Score: ${test.score} / ${test.idx + 1}`;
  document.querySelector('.quiz__next').hidden = false;
}

function renderTestComplete() {
  const total = test.queue.length;
  const $ = s => document.querySelector(s);
  $('.quiz__counter').textContent = 'Test complete';
  $('.quiz__word').textContent = `${test.score} / ${total}`;
  $('.quiz__phonetic .ipa').textContent = total ? `${Math.round(100 * test.score / total)}%` : '';
  $('.quiz__options').innerHTML = `<li><button class="quiz__option" type="button" id="restart-test">Restart →</button></li>`;
  $('.quiz__feedback').hidden = true;
  $('.quiz__next').hidden = true;
  document.getElementById('restart-test').addEventListener('click', startTest);
}

async function startTest() {
  const { words } = await loadSelectedDays(DEFAULT_SECTION);
  test.pool = words;
  test.queue = shuffle(words);
  test.idx = 0;
  test.score = 0;
  document.querySelector('.quiz__score').textContent = 'Score: 0';
  if (!words.length) {
    document.querySelector('.quiz__counter').textContent = '—';
    document.querySelector('.quiz__word').textContent = 'No words to test';
    return;
  }
  renderTestQuestion();
}

async function bootTest() {
  document.addEventListener('click', (e) => {
    const opt = e.target.closest('.quiz__option');
    if (opt && opt.id !== 'restart-test') {
      handleAnswer(opt.dataset.value);
      return;
    }
    if (e.target.closest('.quiz__next')) {
      test.idx++;
      renderTestQuestion();
    }
    if (e.target.closest('.quiz__phonetic .speak')) {
      const w = test.queue[test.idx];
      if (w) speakOnce(w.word);
    }
  });
  await startTest();

  const dayLabel = document.querySelector('.dateline__day');
  if (dayLabel) dayLabel.textContent = formatDayLabel(getSelection(DEFAULT_SECTION));
  const topic = document.querySelector('.dateline__topic');
  if (topic) topic.textContent = `Quiz — ${test.queue.length} word${test.queue.length === 1 ? '' : 's'}`;
}

// ---------- Helpers ----------
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
function highlightWord(sentence, word) {
  const re = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\w*)\\b`, 'i');
  return escapeHtml(sentence).replace(re, '<em>$1</em>');
}
function formatDayLabel(days) {
  if (!days.length) return 'Day —';
  if (days.length === 1) return `Day ${days[0]}`;
  // contiguous range?
  const sorted = days.slice().sort((a, b) => a - b);
  let contiguous = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) { contiguous = false; break; }
  }
  if (contiguous) return `Days ${sorted[0]}–${sorted[sorted.length - 1]}`;
  return `Days ${sorted.join(', ')}`;
}

// ---------- Boot ----------
async function boot() {
  const page = document.body.dataset.page;
  buildEditions(DEFAULT_SECTION);

  if (page === 'index') {
    wireEditions(DEFAULT_SECTION, renderIndex);
    await renderIndex();
  } else if (page === 'study') {
    wireEditions(DEFAULT_SECTION, () => location.reload());
    await bootStudy();
  } else if (page === 'test') {
    wireEditions(DEFAULT_SECTION, () => startTest());
    await bootTest();
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
