/* Biblioteca: estantería local (IndexedDB) y lector en página */
const $ = (sel, el = document) => el.querySelector(sel);
const el = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  node.append(...kids);
  return node;
};

/* --- tema y menú --- */
const root = document.documentElement;
const tr = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);
const themeBtn = $('.theme');
const syncTheme = () => {
  const dark = root.dataset.theme === 'dark';
  themeBtn.setAttribute('aria-pressed', String(dark));
  themeBtn.setAttribute('aria-label', tr(dark ? 'a11y.themeLight' : 'a11y.themeDark'));
};
themeBtn.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch { /* sesión */ }
  syncTheme();
});
syncTheme();

const menuToggle = document.querySelector('.toggle');
const menu = document.getElementById('menu');
menuToggle.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
});
menu.addEventListener('click', event => {
  if (event.target.matches('a')) {
    menu.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
});

document.getElementById('year').textContent = new Date().getFullYear();

/* --- edición de textos y ajustes de estilo --- */
const editor = window.createContentEditor
  ? window.createContentEditor({
      editable: 'main .library-head .eyebrow, main .library-head h1, main .library-head .lead, .steps strong, .steps div > span, #empty > p, #empty .hint, .foot p',
      storageKey: 'biblioteca-content',
      downloadName: 'biblioteca.html',
      scope: 'library',
      onEditingChange: open => window.stylePanel?.setOpen(open)
    })
  : null;

/* --- almacenamiento --- */
const DB_NAME = 'biblioteca-catalina';
const dbReady = new Promise((resolve, reject) => {
  let open;
  try {
    open = indexedDB.open(DB_NAME, 1);
  } catch (error) {
    reject(error);
    return;
  }
  open.onupgradeneeded = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains('libros')) db.createObjectStore('libros', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('progreso')) db.createObjectStore('progreso', { keyPath: 'id' });
  };
  open.onsuccess = () => resolve(open.result);
  open.onerror = () => reject(open.error);
});

const ask = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const store = (name, mode, action) => dbReady
  .then(db => ask(action(db.transaction(name, mode).objectStore(name))));

/* --- datos --- */
const kindLabel = kind => tr(`lib.kind.${kind}`);
const KINDS = {
  pdf: 'pdf', epub: 'epub', docx: 'docx',
  txt: 'text', text: 'text', md: 'text', markdown: 'text',
  html: 'html', htm: 'html', xhtml: 'html',
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image',
  avif: 'image', bmp: 'image', svg: 'image'
};
const kindOf = name => KINDS[(name.split('.').pop() || '').toLowerCase()] || 'other';

let books = [];
const readings = new Map();
const coverUrls = new Map();
const state = { query: '', category: '' };

const normalize = text => String(text || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const tone = text => {
  let hash = 0;
  for (const char of String(text)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 6;
};

const formatSize = bytes => bytes >= 1048576
  ? `${(bytes / 1048576).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const titleFromName = name => name
  .replace(/\.[^.]+$/, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || 'Sin título';

const newId = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

const coverUrl = book => {
  if (!coverUrls.has(book.id)) coverUrls.set(book.id, URL.createObjectURL(book.blob));
  return coverUrls.get(book.id);
};

const notify = message => {
  const notice = $('#notice');
  notice.textContent = message;
  notice.hidden = !message;
};

/* --- render --- */
const shelf = $('#shelf');
const chips = $('#chips');
const empty = $('#empty');
const noResults = $('#no-results');
const count = $('#count');

const percentOf = book => Math.min(100, Math.round(readings.get(book.id)?.percent || 0));

const renderChips = categories => {
  chips.replaceChildren();
  const allLabel = tr('lib.all');
  const options = [allLabel, ...categories];
  for (const [index, option] of options.entries()) {
    const isAll = index === 0;
    const active = isAll ? !state.category : option === state.category;
    chips.append(el('button', {
      class: 'chip',
      type: 'button',
      'aria-pressed': String(active),
      text: option,
      onclick: () => {
        state.category = isAll ? '' : option;
        render();
      }
    }));
  }
};

const card = book => {
  const percent = percentOf(book);
  const cover = el('span', { class: `cover cover-${tone(book.id)}` });
  if (book.kind === 'image') {
    cover.classList.add('is-image');
    cover.append(el('img', { src: coverUrl(book), alt: '', loading: 'lazy' }));
  } else {
    cover.append(
      el('span', { class: 'c-kicker', text: kindLabel(book.kind) }),
      el('span', { class: 'c-title', text: book.title }),
      el('span', { class: 'c-author', text: book.author || '\u00a0' })
    );
  }

  const openButton = el('button', {
    class: 'cover-btn',
    type: 'button',
    'aria-label': tr('lib.card.aria', { title: book.title }),
    'data-book': book.id,
    onclick: () => openBook(book)
  }, cover);

  const meta = [book.author, kindLabel(book.kind), formatSize(book.size)].filter(Boolean).join(' · ');
  const actions = el('div', { class: 'book-actions' },
    el('button', {
      class: 'mini', type: 'button',
      text: percent ? tr('lib.continue', { percent }) : tr('lib.read'),
      onclick: () => openBook(book)
    }),
    el('button', {
      class: 'mini', type: 'button', text: tr('lib.download'),
      onclick: () => downloadBook(book)
    }),
    el('button', {
      class: 'mini', type: 'button', text: tr('lib.remove'),
      onclick: () => removeBook(book)
    })
  );

  const item = el('li', { class: 'book' },
    openButton,
    el('h3', {}, el('button', {
      type: 'button', text: book.title, onclick: () => openBook(book)
    })),
    el('p', { class: 'meta', text: meta })
  );

  if (percent) {
    item.append(el('div', { class: 'progress', role: 'presentation' },
      el('span', { style: `width:${percent}%` })));
  }
  item.append(actions);
  return item;
};

const render = () => {
  const query = normalize(state.query.trim());
  const categories = [...new Set(books.map(book => book.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

  if (state.category && !categories.includes(state.category)) state.category = '';

  const list = books.filter(book => {
    if (state.category && book.category !== state.category) return false;
    if (!query) return true;
    return normalize([book.title, book.author, book.category, book.description].join(' ')).includes(query);
  });

  shelf.replaceChildren(...list.map(card));
  renderChips(categories);

  const total = books.length;
  count.textContent = total
    ? tr(total === 1 ? 'lib.count.one' : 'lib.count.other', { n: total })
    : tr('lib.count.none');

  empty.hidden = total > 0;
  noResults.hidden = total === 0 || list.length > 0;

  const options = $('#cats');
  options.replaceChildren(...categories.map(name => el('option', { value: name })));
};

/* --- alta --- */
const dialog = $('#add');
const fileInput = $('#file');
const form = $('#add-form');
const formError = $('#form-error');
const drop = $('#drop');
const fileNameEl = $('#file-name');
const fileMetaEl = $('#file-meta');
let pendingFile = null;

const showError = message => {
  formError.textContent = message;
  formError.hidden = !message;
};

const resetDrop = () => {
  fileNameEl.dataset.i18n = 'lib.drop';
  fileMetaEl.dataset.i18n = 'lib.formats';
  fileNameEl.textContent = tr('lib.drop');
  fileMetaEl.textContent = tr('lib.formats');
};

const setFile = file => {
  showError('');
  if (!file) return;
  if (kindOf(file.name) === 'other') {
    pendingFile = null;
    showError(tr('lib.form.unsupported', { name: file.name }));
    return;
  }
  pendingFile = file;
  delete fileNameEl.dataset.i18n;
  delete fileMetaEl.dataset.i18n;
  fileNameEl.textContent = file.name;
  fileMetaEl.textContent = tr('lib.fileMeta', {
    size: formatSize(file.size),
    kind: kindLabel(kindOf(file.name))
  });
  const title = $('#t');
  if (!title.value.trim()) title.value = titleFromName(file.name);
};

const openAdd = file => {
  pendingFile = null;
  form.reset();
  showError('');
  resetDrop();
  if (file) setFile(file);
  dialog.showModal();
  (file ? $('#a') : $('#t')).focus();
};

const addBook = async file => {
  const title = $('#t').value.trim() || titleFromName(file.name);
  const book = {
    id: newId(),
    title,
    author: $('#a').value.trim(),
    category: $('#c').value.trim() || 'General',
    description: $('#d').value.trim(),
    name: file.name,
    kind: kindOf(file.name),
    type: file.type || '',
    size: file.size,
    added: Date.now(),
    blob: file
  };
  await store('libros', 'readwrite', s => s.put(book));
  books.unshift(book);
  dialog.close();
  render();
  $('#status').textContent = tr('lib.status.added', { title });
};

document.addEventListener('click', event => {
  if (event.target.closest('[data-add]')) openAdd();
});

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => dialog.close());
});

dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});

fileInput.addEventListener('change', () => setFile(fileInput.files[0]));

for (const target of [drop, dialog]) {
  target.addEventListener('dragover', event => {
    event.preventDefault();
    drop.classList.add('hot');
  });
  target.addEventListener('dragleave', () => drop.classList.remove('hot'));
  target.addEventListener('drop', event => {
    event.preventDefault();
    drop.classList.remove('hot');
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      if (!dialog.open) openAdd(file);
      else setFile(file);
    }
  });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!pendingFile) {
    showError(tr('lib.form.noFile'));
    return;
  }
  try {
    await addBook(pendingFile);
  } catch (error) {
    showError(tr('lib.form.saveError'));
  }
});

/* también se puede soltar sobre la estantería */
document.addEventListener('dragover', event => {
  if (dialog.open) return;
  event.preventDefault();
});
document.addEventListener('drop', event => {
  if (dialog.open) return;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    event.preventDefault();
    openAdd(file);
  }
});

const downloadBook = book => {
  const url = URL.createObjectURL(book.blob);
  const link = el('a', { href: url, download: book.name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

const removeBook = async book => {
  if (!confirm(tr('lib.confirm.remove', { title: book.title }))) return;
  await store('libros', 'readwrite', s => s.delete(book.id));
  await store('progreso', 'readwrite', s => s.delete(book.id));
  books = books.filter(item => item.id !== book.id);
  readings.delete(book.id);
  const url = coverUrls.get(book.id);
  if (url) URL.revokeObjectURL(url);
  coverUrls.delete(book.id);
  render();
  $('#status').textContent = tr('lib.status.removed', { title: book.title });
};

/* --- utilidades del lector --- */
const CDN = {
  jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  epub: 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js',
  mammoth: 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',
  pdf: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
};

const loadScript = src => new Promise((resolve, reject) => {
  const found = document.querySelector(`script[data-src="${src}"]`);
  if (found) {
    if (found.dataset.ready === '1') resolve();
    else found.addEventListener('load', resolve, { once: true });
    return;
  }
  const script = el('script', { src, 'data-src': src, async: '' });
  script.addEventListener('load', () => {
    script.dataset.ready = '1';
    resolve();
  }, { once: true });
  script.addEventListener('error', () => reject(new Error(`No se pudo cargar ${src}`)), { once: true });
  document.head.append(script);
});

const escapeHtml = text => text.replace(/[&<>"']/g,
  char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const inline = text => escapeHtml(text)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

const proseToHtml = (source, markdown) => {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let paragraph = [];
  let list = '';
  let quoted = false;
  let code = false;
  let block = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = '';
    }
  };
  const closeQuote = () => {
    if (quoted) {
      out.push('</blockquote>');
      quoted = false;
    }
  };
  const closeBlocks = () => {
    flushParagraph();
    closeList();
    closeQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (markdown && trimmed.startsWith('```')) {
      if (code) {
        out.push(`<pre><code>${escapeHtml(block.join('\n'))}</code></pre>`);
        code = false;
      } else {
        closeBlocks();
        block = [];
        code = true;
      }
      continue;
    }
    if (code) {
      block.push(raw);
      continue;
    }
    if (!trimmed) {
      closeBlocks();
      continue;
    }
    if (!markdown) {
      paragraph.push(trimmed);
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeBlocks();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeBlocks();
      out.push('<hr>');
      continue;
    }
    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      closeQuote();
      const tag = bullet ? 'ul' : 'ol';
      if (list !== tag) {
        closeList();
        out.push(`<${tag}>`);
        list = tag;
      }
      out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
      continue;
    }
    if (trimmed.startsWith('>')) {
      flushParagraph();
      closeList();
      if (!quoted) {
        out.push('<blockquote>');
        quoted = true;
      }
      out.push(`<p>${inline(trimmed.replace(/^>\s?/, ''))}</p>`);
      continue;
    }
    closeList();
    closeQuote();
    paragraph.push(trimmed);
  }

  if (code) out.push(`<pre><code>${escapeHtml(block.join('\n'))}</code></pre>`);
  closeBlocks();
  return out.join('\n');
};

/* --- progreso --- */
let saveTimer = 0;
const saveProgress = (book, percent, page) => {
  const entry = { id: book.id, percent, page, at: Date.now() };
  readings.set(book.id, entry);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store('progreso', 'readwrite', s => s.put(entry)).catch(() => { /* sin espacio */ });
  }, 350);
};

/* --- lector --- */
const reader = $('#reader');
const readerBody = $('#reader-body');
const readerTitle = $('#reader-title');
const readerSub = $('#reader-sub');
const readerFill = $('#reader-fill');
const readerProgress = $('#reader-progress');
const readerDownload = $('#reader-download');
const turnPrev = $('#turn-prev');
const turnNext = $('#turn-next');

const prefs = { size: 18, look: 'papel' };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem('lector') || '{}'));
} catch { /* preferencias por defecto */ }

let cleanup = null;
let activeRendition = null;
let pager = null;
let refreshReaderMeta = null;
let lastBookId = '';
let downloadUrl = '';

const applyPrefs = () => {
  reader.style.setProperty('--reader-size', `${prefs.size}px`);
  reader.dataset.look = prefs.look;
  if (!activeRendition) return;
  const style = getComputedStyle(reader);
  activeRendition.themes.fontSize(`${Math.round(prefs.size / 18 * 100)}%`);
  activeRendition.themes.override('background', style.backgroundColor);
  activeRendition.themes.override('color', style.color);
};

const setProgress = percent => {
  if (percent === null) {
    readerProgress.hidden = true;
    return;
  }
  readerProgress.hidden = false;
  readerFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
};

const clearReader = () => {
  if (cleanup) cleanup();
  cleanup = null;
  if (activeRendition) {
    try { activeRendition.destroy(); } catch { /* ya destruido */ }
    activeRendition = null;
  }
  turnPrev.onclick = null;
  turnNext.onclick = null;
  turnPrev.hidden = true;
  turnNext.hidden = true;
  pager = null;
  refreshReaderMeta = null;
  readerBody.replaceChildren();
  readerBody.scrollTop = 0;
  readerBody.classList.remove('is-centred');
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = '';
  readerDownload.removeAttribute('href');
};

const closeReader = () => {
  clearReader();
  reader.hidden = true;
  document.body.classList.remove('reading');
  document.querySelectorAll('.bar, main, .foot, .style-panel, .edit-toggle').forEach(node => { node.inert = false; });
  render();
  const card = [...shelf.querySelectorAll('[data-book]')].find(node => node.dataset.book === lastBookId);
  (card || $('.library-side .btn')).focus();
};

reader.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeReader();
  if (!pager) return;
  if (event.key === 'ArrowRight' || event.key === 'PageDown') pager.next();
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') pager.prev();
});

$('#reader-close').addEventListener('click', closeReader);

$('#size-down').addEventListener('click', () => {
  prefs.size = Math.max(14, prefs.size - 1);
  applyPrefs();
  try { localStorage.setItem('lector', JSON.stringify(prefs)); } catch { /* sesión */ }
});

$('#size-up').addEventListener('click', () => {
  prefs.size = Math.min(30, prefs.size + 1);
  applyPrefs();
  try { localStorage.setItem('lector', JSON.stringify(prefs)); } catch { /* sesión */ }
});

$('#look').addEventListener('click', () => {
  const looks = ['claro', 'papel', 'noche'];
  prefs.look = looks[(looks.indexOf(prefs.look) + 1) % looks.length];
  applyPrefs();
  try { localStorage.setItem('lector', JSON.stringify(prefs)); } catch { /* sesión */ }
});

const showFallback = (book, message) => {
  readerBody.append(el('div', { class: 'reader-fallback' },
    el('p', { text: message }),
    el('button', { class: 'btn', type: 'button', text: tr('lib.reader.fallbackBtn'), onclick: () => downloadBook(book) })
  ));
  setProgress(null);
};

const textReader = async book => {
  const source = await book.blob.text();
  if (lastBookId !== book.id) return;
  const markdown = /\.(md|markdown)$/i.test(book.name);
  const article = el('article', { class: 'reader-text' });
  article.innerHTML = proseToHtml(source, markdown);
  readerBody.append(article);

  const saved = readings.get(book.id);
  if (saved?.page) requestAnimationFrame(() => { readerBody.scrollTop = saved.page; });

  const onScroll = () => {
    const max = readerBody.scrollHeight - readerBody.clientHeight;
    const percent = max > 0 ? Math.round(readerBody.scrollTop / max * 100) : 100;
    setProgress(percent);
    saveProgress(book, percent, readerBody.scrollTop);
  };
  readerBody.addEventListener('scroll', onScroll, { passive: true });
  cleanup = () => readerBody.removeEventListener('scroll', onScroll);
  setProgress(saved?.percent || 0);
};

const imageReader = book => {
  readerBody.classList.add('is-centred');
  readerBody.append(el('div', { class: 'reader-image-wrap' },
    el('img', { class: 'reader-image', src: downloadUrl, alt: book.title })
  ));
  setProgress(null);
};

const epubReader = async book => {
  await loadScript(CDN.jszip);
  await loadScript(CDN.epub);
  if (typeof window.ePub !== 'function') throw new Error('Lector EPUB no disponible');
  if (lastBookId !== book.id) return;

  const view = el('div', { class: 'reader-epub' });
  readerBody.append(view);

  const epub = window.ePub(await book.blob.arrayBuffer());
  await epub.ready;

  const rendition = epub.renderTo(view, {
    width: '100%',
    height: '100%',
    flow: 'paginated',
    spread: 'auto'
  });
  activeRendition = rendition;
  applyPrefs();

  const saved = readings.get(book.id);
  await rendition.display(saved?.page || undefined);

  rendition.on('relocated', location => {
    const total = rendition.book.spine.length || 1;
    const percent = Math.min(99, Math.round(((location.start?.index || 0) / total) * 100));
    setProgress(percent);
    saveProgress(book, percent, location.start?.cfi || null);
  });

  pager = { next: () => rendition.next(), prev: () => rendition.prev() };
  turnPrev.hidden = false;
  turnNext.hidden = false;
  turnPrev.onclick = pager.prev;
  turnNext.onclick = pager.next;

  rendition.on('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') pager.next();
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') pager.prev();
  });

  cleanup = () => {
    try { rendition.destroy(); } catch { /* ya destruido */ }
    try { epub.destroy(); } catch { /* ya destruido */ }
    activeRendition = null;
  };
};

const docxReader = async book => {
  await loadScript(CDN.mammoth);
  if (!window.mammoth) throw new Error('Conversor Word no disponible');
  const result = await window.mammoth.convertToHtml({ arrayBuffer: await book.blob.arrayBuffer() });
  if (lastBookId !== book.id) return;
  const article = el('article', { class: 'reader-text' });
  article.innerHTML = result.value;
  readerBody.append(article);

  const saved = readings.get(book.id);
  if (saved?.page) requestAnimationFrame(() => { readerBody.scrollTop = saved.page; });

  const onScroll = () => {
    const max = readerBody.scrollHeight - readerBody.clientHeight;
    const percent = max > 0 ? Math.round(readerBody.scrollTop / max * 100) : 100;
    setProgress(percent);
    saveProgress(book, percent, readerBody.scrollTop);
  };
  readerBody.addEventListener('scroll', onScroll, { passive: true });
  cleanup = () => readerBody.removeEventListener('scroll', onScroll);
  setProgress(saved?.percent || 0);
};

const pdfReader = async book => {
  await loadScript(CDN.pdf);
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) throw new Error('Lector PDF no disponible');
  pdfjs.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await book.blob.arrayBuffer()) }).promise;
  if (lastBookId !== book.id) {
    doc.destroy();
    return;
  }
  const wrap = el('div', { class: 'reader-pdf' });
  readerBody.append(wrap);

  let pageNumber = Math.min(doc.numPages, Math.max(1, readings.get(book.id)?.page || 1));
  let token = 0;

  const showMeta = () => {
    readerSub.textContent = [
      tr('lib.reader.page', { n: pageNumber, total: doc.numPages }),
      book.author,
      kindLabel('pdf')
    ].filter(Boolean).join(' · ');
  };
  refreshReaderMeta = showMeta;

  const draw = async () => {
    const mine = ++token;
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const box = readerBody.getBoundingClientRect();
    const fit = Math.min(
      (box.width - 32) / base.width,
      (box.height - 32) / base.height
    );
    const scale = Math.max(.3, Math.min(fit, 2.5));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const viewport = page.getViewport({ scale: scale * dpr });
    const canvas = el('canvas', { class: 'pdf-page' });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.round(viewport.height / dpr)}px`;
    if (mine !== token) return;
    wrap.replaceChildren(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    if (mine !== token) return;

    const percent = Math.round((pageNumber - 1) / Math.max(1, doc.numPages - 1) * 100);
    setProgress(percent);
    saveProgress(book, percent, pageNumber);
    showMeta();
  };

  const go = delta => {
    const next = pageNumber + delta;
    if (next < 1 || next > doc.numPages) return;
    pageNumber = next;
    draw();
  };

  pager = { next: () => go(1), prev: () => go(-1) };
  turnPrev.hidden = false;
  turnNext.hidden = false;
  turnPrev.onclick = pager.prev;
  turnNext.onclick = pager.next;

  const onResize = () => draw();
  window.addEventListener('resize', onResize);

  showMeta();
  await draw();

  cleanup = () => {
    window.removeEventListener('resize', onResize);
    try { doc.destroy(); } catch { /* ya destruido */ }
  };
};

const openBook = async book => {
  clearReader();
  editor?.setEditing(false);
  lastBookId = book.id;
  reader.hidden = false;
  document.body.classList.add('reading');
  document.querySelectorAll('.bar, main, .foot, .style-panel, .edit-toggle').forEach(node => { node.inert = true; });
  readerTitle.textContent = book.title;
  refreshReaderMeta = () => {
    readerSub.textContent = [book.author, kindLabel(book.kind), book.category].filter(Boolean).join(' · ');
  };
  refreshReaderMeta();

  downloadUrl = URL.createObjectURL(book.blob);
  readerDownload.href = downloadUrl;
  readerDownload.download = book.name;

  applyPrefs();
  setProgress(readings.get(book.id)?.percent || 0);
  readerBody.focus({ preventScroll: true });

  try {
    if (book.kind === 'pdf') {
      await pdfReader(book);
    } else if (book.kind === 'html') {
      setProgress(null);
      readerBody.append(el('iframe', {
        class: 'reader-frame',
        src: downloadUrl,
        sandbox: 'allow-scripts allow-popups',
        title: `Lector HTML: ${book.title}`
      }));
    } else if (book.kind === 'epub') {
      await epubReader(book);
    } else if (book.kind === 'docx') {
      await docxReader(book);
    } else if (book.kind === 'image') {
      imageReader(book);
    } else if (book.kind === 'text') {
      await textReader(book);
    } else {
      showFallback(book, tr('lib.reader.fallback'));
    }
  } catch (error) {
    if (lastBookId !== book.id) return;
    clearReader();
    showFallback(book, tr('lib.reader.error'));
  }
};

/* --- arranque --- */
$('#q').addEventListener('input', event => {
  state.query = event.target.value;
  render();
});

document.addEventListener('langchange', () => {
  syncTheme();
  render();
  refreshReaderMeta?.();
});

dbReady
  .then(() => Promise.all([
    store('libros', 'readonly', s => s.getAll()),
    store('progreso', 'readonly', s => s.getAll())
  ]))
  .then(([all, progress]) => {
    books = all.sort((a, b) => b.added - a.added);
    progress.forEach(entry => readings.set(entry.id, entry));
    render();
  })
  .catch(() => {
    count.textContent = tr('lib.storageError');
    empty.hidden = false;
    notify(tr('lib.storageNotice'));
  });
