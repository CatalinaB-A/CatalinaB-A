/* Editor local por bloques + aplicación de las ediciones publicadas */
(() => {
  const tr = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);

  const readObject = key => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || 'null');
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  };

  window.createContentEditor = ({ editable, storageKey, downloadName, scope = 'site', onEditingChange }) => {
    const isLocal = Boolean(window.isLocalSite);
    const nodes = () => Array.from(document.querySelectorAll(editable));

    /* clave estable por bloque: contenedor + etiqueta + posición */
    const keyFor = node => {
      const holder = node.closest('section, footer, ol, [id]') || document.body;
      const scopeName = holder === document.body
        ? 'body'
        : (holder.id || holder.className || holder.tagName.toLowerCase());
      const peers = Array.from(holder.querySelectorAll(editable));
      return `${scopeName}|${node.tagName.toLowerCase()}|${peers.indexOf(node)}`;
    };

    const keyCache = new WeakMap();
    const keyOf = node => {
      if (!keyCache.has(node)) keyCache.set(node, keyFor(node));
      return keyCache.get(node);
    };

    const ensureKeys = () => nodes().forEach(keyOf);

    const markKeys = () => nodes().forEach(node => {
      node.dataset.editKey = keyOf(node);
    });

    const readContent = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (Array.isArray(saved)) {
          ensureKeys();
          const map = {};
          nodes().forEach((node, index) => {
            if (typeof saved[index] === 'string') map[keyOf(node)] = saved[index];
          });
          return map;
        }
        return saved && typeof saved === 'object' ? saved : {};
      } catch {
        return {};
      }
    };

    ensureKeys();
    let contentMap = readContent();

    const published = () => {
      const map = window.EDICIONES?.content?.[scope];
      return map && typeof map === 'object' ? map : {};
    };

    const applyContent = () => {
      if (window.i18n && window.i18n.lang !== 'es') return;
      const base = published();
      nodes().forEach(node => {
        const key = keyOf(node);
        const value = contentMap[key] ?? base[key];
        if (typeof value === 'string') node.innerHTML = value;
      });
    };

    applyContent();
    document.addEventListener('DOMContentLoaded', applyContent);
    document.addEventListener('langchange', applyContent);

    /* En el sitio publicado solo se aplican las ediciones, no se edita */
    if (!isLocal) {
      return { setEditing: () => {}, close: () => {}, isEditing: () => false, toggle: () => {} };
    }

    const persist = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(contentMap));
      } catch {
        /* almacenamiento bloqueado */
      }
    };

    const bar = document.createElement('div');
    bar.className = 'edit-bar';
    bar.hidden = true;
    bar.innerHTML = '<span class="edit-hint" data-i18n="editor.hint">Haz clic en un bloque para editarlo</span>'
      + '<button type="button" data-edit-action="save" data-i18n="editor.save">Guardar</button>'
      + '<button type="button" data-edit-action="export" data-i18n="editor.export">Exportar cambios</button>'
      + '<button type="button" data-edit-action="download" data-i18n="editor.download">Descargar HTML</button>'
      + '<button type="button" data-edit-action="close" data-i18n="editor.close">Cerrar</button>';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'edit-toggle';
    button.textContent = tr('editor.edit');
    button.setAttribute('aria-pressed', 'false');

    document.body.append(bar, button);

    let activeBlock = null;

    const stopBlock = () => {
      if (!activeBlock) return;
      const node = activeBlock;
      activeBlock = null;
      node.removeAttribute('contenteditable');
      contentMap[keyOf(node)] = node.innerHTML;
      persist();
    };

    const startBlock = node => {
      if (activeBlock === node) return;
      stopBlock();
      activeBlock = node;
      node.setAttribute('contenteditable', 'true');
      node.focus();
    };

    document.addEventListener('click', event => {
      if (!document.body.classList.contains('editing')) return;
      if (event.target.closest('.edit-bar, .style-panel, .edit-toggle')) return;
      const node = event.target.closest(editable);
      if (node) startBlock(node);
      else stopBlock();
    });

    document.addEventListener('focusout', event => {
      if (activeBlock && event.target === activeBlock) stopBlock();
    });

    document.addEventListener('keydown', event => {
      if (!activeBlock) return;
      if (event.key === 'Escape' || (event.key === 'Enter' && event.ctrlKey)) {
        event.preventDefault();
        stopBlock();
      }
    });

    const setEditing = on => {
      document.body.classList.toggle('editing', on);
      if (on) {
        ensureKeys();
        markKeys();
      } else {
        stopBlock();
        nodes().forEach(node => node.removeAttribute('contenteditable'));
      }
      bar.hidden = !on;
      button.textContent = on ? tr('editor.editing') : tr('editor.edit');
      button.setAttribute('aria-pressed', String(on));
      if (onEditingChange) onEditingChange(on);
    };

    const downloadText = (text, name) => {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const exportPublished = () => {
      stopBlock();
      persist();
      const payload = {
        content: {
          site: readObject('site-content'),
          library: readObject('biblioteca-content')
        },
        style: readObject('site-style')
      };
      downloadText(
        '/* Ediciones publicadas. Generado con «Exportar cambios» desde la edición local. */\n'
        + `window.EDICIONES = ${JSON.stringify(payload, null, 2)};\n`,
        'ediciones-publicadas.js'
      );
    };

    const downloadPage = () => {
      stopBlock();
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll('#eye canvas, #tunnel .light-tunnel-container').forEach(node => node.remove());
      clone.querySelectorAll('script[src="site-style.js"], script[src="./site-style.js"]').forEach(node => node.remove());
      const name = clone.querySelector('#name');
      if (name) name.textContent = name.querySelector('.sr-only')?.textContent || name.textContent;
      clone.querySelectorAll('[contenteditable]').forEach(node => node.removeAttribute('contenteditable'));
      clone.querySelectorAll('[data-edit-key]').forEach(node => node.removeAttribute('data-edit-key'));
      clone.querySelectorAll('.edit-bar, .edit-toggle, .style-panel').forEach(node => node.remove());
      clone.querySelector('body')?.classList.remove('editing');
      const url = URL.createObjectURL(new Blob(['<!DOCTYPE html>\n' + clone.outerHTML], { type: 'text/html' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    button.addEventListener('click', () => setEditing(bar.hidden));
    bar.addEventListener('click', event => {
      const action = event.target.dataset.editAction;
      if (action === 'save') {
        stopBlock();
        persist();
      }
      if (action === 'export') exportPublished();
      if (action === 'download') downloadPage();
      if (action === 'close') setEditing(false);
    });

    document.addEventListener('langchange', () => {
      button.textContent = document.body.classList.contains('editing') ? tr('editor.editing') : tr('editor.edit');
    });

    return {
      setEditing,
      close: () => setEditing(false),
      isEditing: () => !bar.hidden,
      toggle: () => setEditing(bar.hidden)
    };
  };
})();
