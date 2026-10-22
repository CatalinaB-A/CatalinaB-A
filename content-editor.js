/* Edición local por bloques de texto, compartida por el portafolio y la biblioteca */
(() => {
  const tr = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);

  window.createContentEditor = ({ editable, storageKey, downloadName, onEditingChange }) => {
    const nodes = () => Array.from(document.querySelectorAll(editable));

    /* clave estable por bloque: contenedor + etiqueta + posición */
    const keyFor = node => {
      const scope = node.closest('section, footer, ol, [id]');
      const holder = scope || document.body;
      const scopeName = scope ? (scope.id || scope.className || scope.tagName.toLowerCase()) : 'body';
      const peers = Array.from(holder.querySelectorAll(editable));
      return `${scopeName}|${node.tagName.toLowerCase()}|${peers.indexOf(node)}`;
    };

    const ensureKeys = () => {
      nodes().forEach(node => {
        if (!node.dataset.editKey) node.dataset.editKey = keyFor(node);
      });
    };

    const readContent = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (Array.isArray(saved)) {
          ensureKeys();
          const map = {};
          nodes().forEach((node, index) => {
            if (typeof saved[index] === 'string') map[node.dataset.editKey] = saved[index];
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

    const persist = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(contentMap));
      } catch {
        /* almacenamiento bloqueado */
      }
    };

    const restore = () => {
      if (window.i18n && window.i18n.lang !== 'es') return;
      ensureKeys();
      nodes().forEach(node => {
        const saved = contentMap[node.dataset.editKey];
        if (typeof saved === 'string') node.innerHTML = saved;
      });
    };
    restore();
    document.addEventListener('DOMContentLoaded', restore);

    const bar = document.createElement('div');
    bar.className = 'edit-bar';
    bar.hidden = true;
    bar.innerHTML = '<span class="edit-hint" data-i18n="editor.hint">Haz clic en un bloque para editarlo</span>'
      + '<button type="button" data-edit-action="save" data-i18n="editor.save">Guardar</button>'
      + '<button type="button" data-edit-action="download" data-i18n="editor.download">Descargar HTML</button>'
      + '<button type="button" data-edit-action="close" data-i18n="editor.close">Cerrar</button>';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'edit-toggle';
    button.textContent = tr('editor.edit');
    button.setAttribute('aria-pressed', 'false');

    document.body.append(bar, button);

    /* un solo bloque editable a la vez */
    let activeBlock = null;

    const stopBlock = () => {
      if (!activeBlock) return;
      const node = activeBlock;
      activeBlock = null;
      node.removeAttribute('contenteditable');
      contentMap[node.dataset.editKey] = node.innerHTML;
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
      } else {
        stopBlock();
        nodes().forEach(node => node.removeAttribute('contenteditable'));
      }
      bar.hidden = !on;
      button.textContent = on ? tr('editor.editing') : tr('editor.edit');
      button.setAttribute('aria-pressed', String(on));
      if (onEditingChange) onEditingChange(on);
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
      if (action === 'download') downloadPage();
      if (action === 'close') setEditing(false);
    });

    document.addEventListener('langchange', () => {
      button.textContent = document.body.classList.contains('editing') ? tr('editor.editing') : tr('editor.edit');
      restore();
    });

    return {
      setEditing,
      close: () => setEditing(false),
      isEditing: () => !bar.hidden,
      toggle: () => setEditing(bar.hidden)
    };
  };
})();
