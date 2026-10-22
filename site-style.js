/* Estilo personalizado: guarda overrides y los aplica como variables CSS */
(() => {
  const KEY = 'site-style';
  const COLORS = ['bg', 'surface', 'fg', 'muted', 'border', 'accent', 'name', 'gold'];

  /* Edición local: desactivada en el sitio publicado */
  const host = location.hostname;
  window.isLocalSite = location.protocol === 'file:'
    || ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'].includes(host)
    || host.endsWith('.local')
    || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);

  let data = {};
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') data = saved;
  } catch { /* sin estilos guardados */ }

  const styleEl = document.createElement('style');
  styleEl.id = 'site-style';
  document.head.append(styleEl);

  const css = () => {
    const blocks = [];

    for (const theme of ['light', 'dark']) {
      const colors = data.colors?.[theme] || {};
      const lines = COLORS.filter(name => colors[name]).map(name => `--${name}:${colors[name]};`).join('');
      if (lines) blocks.push(`:root[data-theme="${theme}"]{${lines}}`);
    }

    const root = [];
    if (data.font_body) root.push(`--font-body:${data.font_body};`);
    if (data.font_heading) root.push(`--font-heading:${data.font_heading};`);
    if (data.size) root.push(`--base-size:${(data.size / 16 * 100).toFixed(2)}%;`);
    if (data.width) root.push(`--max:${data.width}px;`);
    if (data.radius !== undefined) root.push(`--radius:${data.radius}px;`);
    if (root.length) blocks.push(`:root{${root.join('')}}`);

    return blocks.join('\n');
  };

  const apply = () => { styleEl.textContent = css(); };

  const persist = () => {
    try {
      if (Object.keys(data).length) localStorage.setItem(KEY, JSON.stringify(data));
      else localStorage.removeItem(KEY);
    } catch { /* almacenamiento bloqueado: dura la sesión */ }
  };

  const set = (key, value) => {
    if (value === '' || value === null || value === undefined) delete data[key];
    else data[key] = value;
    apply();
    persist();
  };

  window.siteStyle = {
    colors: COLORS,
    get: () => data,
    setColor: (theme, name, value) => {
      data.colors = data.colors || {};
      data.colors[theme] = data.colors[theme] || {};
      data.colors[theme][name] = value;
      apply();
      persist();
    },
    set,
    reset: () => {
      data = {};
      apply();
      persist();
    }
  };

  apply();
})();
