(() => {
  const $ = sel => document.querySelector(sel);
  const preview = $('#preview');
  const logEl = $('#log');
  const statusChip = $('#server-status');
  const publishBtn = $('#publish');
  const messageEl = $('#commit-message');
  const editBtn = $('#edit-toggle');
  const remoteWarning = $('#remote-warning');

  const isLocal = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  let serverReady = false;

  const write = text => { logEl.textContent = text; };

  const cleanLog = text => String(text || '')
    .split('\n')
    .filter(line => !/(NativeCommandError|CategoryInfo|FullyQualifiedErrorId|^\s*\+|En .*\.ps1:)/.test(line))
    .map(line => line.replace(/^git\.exe\s*:\s*/i, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const readJson = key => {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') || {};
    } catch {
      return {};
    }
  };

  const collect = () => ({
    content: {
      site: readJson('site-content'),
      library: readJson('biblioteca-content')
    },
    style: readJson('site-style')
  });

  const setChip = (text, state) => {
    statusChip.textContent = text;
    statusChip.dataset.state = state || '';
  };

  const request = async (path, options) => {
    const response = await fetch(path, options);
    let data = null;
    try { data = await response.json(); } catch { /* sin JSON */ }
    return { ok: response.ok, status: response.status, data };
  };

  const refreshStatus = async () => {
    try {
      const { ok, data } = await request('/api/status');
      if (!ok || !data) throw new Error('sin respuesta');
      write([
        `Rama: ${data.branch}`,
        `Remoto: ${data.remote}`,
        `Último commit: ${data.last}`,
        '',
        'Estado del repositorio:',
        data.status
      ].join('\n'));
    } catch (error) {
      write('No se pudo leer el estado del repositorio. ¿Está activo editor.cmd?');
    }
  };

  const checkServer = async () => {
    if (!isLocal) {
      remoteWarning.hidden = false;
      publishBtn.disabled = true;
      setChip('Solo local', 'error');
      return;
    }
    try {
      const { ok, data } = await request('/api/ping');
      if (!ok || !data?.ok) throw new Error('sin servidor');
      serverReady = true;
      setChip(`Local · ${data.branch}`, 'ok');
    } catch {
      serverReady = false;
      setChip('Servidor no disponible', 'error');
      publishBtn.disabled = true;
      write('No se detecta el servidor local. Ejecuta editor.cmd y vuelve a abrir esta página.');
    }
  };

  const updateEditLabel = () => {
    const editor = preview.contentWindow?.contentEditor;
    editBtn.textContent = editor?.isEditing() ? 'Desactivar edición' : 'Activar edición';
  };

  editBtn.addEventListener('click', () => {
    const editor = preview.contentWindow?.contentEditor;
    if (!editor) {
      write('La vista todavía no está lista. Recárgala e inténtalo de nuevo.');
      return;
    }
    editor.setEditing(!editor.isEditing());
    updateEditLabel();
    if (editor.isEditing()) preview.focus();
  });

  $('#reload').addEventListener('click', () => {
    preview.contentWindow?.location.reload();
    write('Vista recargada.');
  });

  $('#status').addEventListener('click', refreshStatus);

  $('#discard').addEventListener('click', () => {
    if (!confirm('¿Descartar los cambios locales? Se volverá a lo último publicado.')) return;
    ['site-content', 'biblioteca-content', 'site-style'].forEach(key => localStorage.removeItem(key));
    preview.contentWindow?.location.reload();
    write('Cambios locales descartados. La vista vuelve a lo publicado.');
  });

  $('#import').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const match = text.match(/window\.EDICIONES\s*=\s*([\s\S]*?);?\s*$/);
      const data = JSON.parse(match ? match[1] : text);
      const site = data.content?.site || {};
      const library = data.content?.library || {};
      localStorage.setItem('site-content', JSON.stringify({ ...library, ...site }));
      if (Object.keys(library).length) {
        localStorage.setItem('biblioteca-content', JSON.stringify(library));
      }
      localStorage.setItem('site-style', JSON.stringify(data.style || {}));
      preview.contentWindow?.location.reload();
      write(`Importado ${file.name}. Revisa la vista y publica cuando quieras.`);
    } catch (error) {
      write('No se pudo importar: el archivo no es un export válido.');
    } finally {
      event.target.value = '';
    }
  });

  publishBtn.addEventListener('click', async () => {
    const message = messageEl.value.replace(/\s+/g, ' ').trim();
    if (!message) {
      messageEl.focus();
      write('Escribe un mensaje de commit antes de publicar.');
      return;
    }
    if (!serverReady) {
      write('El servidor local no está disponible. Ejecuta editor.cmd.');
      return;
    }

    publishBtn.disabled = true;
    publishBtn.textContent = 'Publicando…';
    write('Guardando bloques y preparando el commit…');

    await new Promise(resolve => setTimeout(resolve, 250));

    try {
      const payload = { message, ...collect() };
      const { ok, data } = await request('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const output = cleanLog(data?.log) || 'Sin salida del servidor.';
      if (ok && data?.ok) {
        write(`${output}\n\n✓ Publicado. GitHub Pages tarda alrededor de un minuto en actualizarse.`);
        setChip('Local', 'ok');
      } else {
        write(`${output}\n\n✗ No se pudo publicar. Revisa el mensaje y el estado del repositorio.`);
      }
    } catch (error) {
      write('No se pudo contactar con el servidor local.');
    } finally {
      publishBtn.disabled = false;
      publishBtn.textContent = 'Publicar en GitHub';
    }
  });

  preview.addEventListener('load', () => {
    updateEditLabel();
  });

  checkServer();
  setTimeout(refreshStatus, 600);
})();
