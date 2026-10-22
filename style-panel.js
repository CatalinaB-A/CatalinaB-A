/* Panel de ajustes de estilo, compartido por el portafolio y la biblioteca */
(() => {
  const api = window.siteStyle;
  if (!api) return;

  const tr = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);
  const root = document.documentElement;
  const isDark = () => root.dataset.theme === 'dark';

  const FONTS = [
    ['system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', 'style.font.system'],
    ['Georgia, "Iowan Old Style", "Times New Roman", serif', 'style.font.classic'],
    ['"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif', 'style.font.editorial'],
    ['"Trebuchet MS", "Segoe UI", Verdana, sans-serif', 'style.font.humanist'],
    ['Verdana, Geneva, "Segoe UI", sans-serif', 'style.font.rounded'],
    ['ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace', 'style.font.mono']
  ];
  const COLOR_LABELS = [
    ['bg', 'style.color.bg'], ['surface', 'style.color.surface'], ['fg', 'style.color.fg'],
    ['muted', 'style.color.muted'], ['border', 'style.color.border'], ['accent', 'style.color.accent'],
    ['name', 'style.color.name'], ['gold', 'style.color.gold']
  ];

  const panel = document.createElement('aside');
  panel.className = 'style-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('data-i18n-aria', 'style.title');
  panel.innerHTML = `
    <h2 data-i18n="style.title">Estilo</h2>
    <p class="style-note" data-i18n="style.note">Se aplica y guarda al instante en este navegador.</p>
    <div class="style-group">
      <p class="style-legend" data-colors-legend></p>
      ${COLOR_LABELS.map(([key, label]) => `<label><span data-i18n="${label}"></span><input type="color" data-color="${key}"></label>`).join('')}
    </div>
    <div class="style-group">
      <p class="style-legend" data-i18n="style.type">Tipografía</p>
      <label><span data-i18n="style.text">Texto</span><select data-font="fontBody"></select></label>
      <label><span data-i18n="style.headings">Títulos</span><select data-font="fontHeading"></select></label>
      <label class="range-row"><span><span data-i18n="style.size">Tamaño</span> <output data-out="size"></output></span><input type="range" data-range="size" min="14" max="22" step="1"></label>
      <label class="range-row"><span><span data-i18n="style.width">Ancho</span> <output data-out="width"></output></span><input type="range" data-range="width" min="720" max="1200" step="20"></label>
      <label class="range-row"><span><span data-i18n="style.radius">Esquinas</span> <output data-out="radius"></output></span><input type="range" data-range="radius" min="0" max="28" step="2"></label>
    </div>
    <button class="style-reset" type="button" data-style-action="reset" data-i18n="style.reset">Restablecer estilo</button>
  `;
  document.body.append(panel);

  const legend = panel.querySelector('[data-colors-legend]');
  const colorInputs = Array.from(panel.querySelectorAll('[data-color]'));
  const fontBodySelect = panel.querySelector('[data-font="fontBody"]');
  const fontHeadingSelect = panel.querySelector('[data-font="fontHeading"]');
  const rangeInputs = {
    size: panel.querySelector('[data-range="size"]'),
    width: panel.querySelector('[data-range="width"]'),
    radius: panel.querySelector('[data-range="radius"]')
  };
  const rangeOutputs = {
    size: panel.querySelector('[data-out="size"]'),
    width: panel.querySelector('[data-out="width"]'),
    radius: panel.querySelector('[data-out="radius"]')
  };

  const fillFonts = (select, firstKey) => {
    const first = new Option('', '');
    first.dataset.i18n = firstKey;
    select.append(first);
    for (const [value, key] of FONTS) {
      const option = new Option('', value);
      option.dataset.i18n = key;
      select.append(option);
    }
  };
  fillFonts(fontBodySelect, 'style.font.default');
  fillFonts(fontHeadingSelect, 'style.font.inherit');

  const cssVar = name => getComputedStyle(root).getPropertyValue(name).trim();

  const toHex = value => {
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    const parts = value.match(/\d+/g);
    if (!parts || parts.length < 3) return '#000000';
    return '#' + parts.slice(0, 3)
      .map(number => Math.min(255, Number(number)).toString(16).padStart(2, '0')).join('');
  };

  const updateLegend = () => {
    legend.textContent = tr('style.colors', {
      theme: tr(isDark() ? 'style.theme.dark' : 'style.theme.light')
    });
  };

  const refresh = () => {
    updateLegend();
    colorInputs.forEach(input => { input.value = toHex(cssVar(`--${input.dataset.color}`)); });

    const stored = api.get();
    fontBodySelect.value = stored.font_body || '';
    fontHeadingSelect.value = stored.font_heading || '';

    const size = Math.round(parseFloat(getComputedStyle(root).fontSize) || 16);
    rangeInputs.size.value = size;
    rangeOutputs.size.textContent = `${size} px`;

    const width = Math.round(parseFloat(cssVar('--max')) || 960);
    rangeInputs.width.value = width;
    rangeOutputs.width.textContent = `${width} px`;

    const radius = Math.round(parseFloat(cssVar('--radius')) || 0);
    rangeInputs.radius.value = radius;
    rangeOutputs.radius.textContent = `${radius} px`;
  };

  const setOpen = open => {
    panel.hidden = !open;
    if (open) refresh();
  };

  panel.addEventListener('input', event => {
    const input = event.target;
    if (input.dataset.color) {
      api.setColor(isDark() ? 'dark' : 'light', input.dataset.color, input.value);
    }
    const range = input.dataset.range;
    if (range) {
      rangeOutputs[range].textContent = `${input.value} px`;
      api.set(range, Number(input.value));
    }
  });

  fontBodySelect.addEventListener('change', () => api.set('font_body', fontBodySelect.value));
  fontHeadingSelect.addEventListener('change', () => api.set('font_heading', fontHeadingSelect.value));

  panel.addEventListener('click', event => {
    if (event.target.dataset.styleAction === 'reset') {
      api.reset();
      refresh();
    }
  });

  new MutationObserver(() => {
    if (!panel.hidden) refresh();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  document.addEventListener('langchange', () => {
    updateLegend();
    if (!panel.hidden) refresh();
  });

  window.i18n?.apply(panel);
  updateLegend();

  window.stylePanel = {
    refresh,
    setOpen,
    isOpen: () => !panel.hidden,
    toggle: () => setOpen(panel.hidden)
  };
})();
