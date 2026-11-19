const $ = (id) => document.getElementById(id);
  const TOKEN_KEY = 'visitorToken';
  const NAME_KEY = 'visitorName';
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

  let limits = { maxFileSizeMb: 5, maxFiles: 5 };

  // localStorage can throw (private mode), so wrap it
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
    del: (k) => { try { localStorage.removeItem(k); } catch {} },
  };

  function showMessage(text, ok) {
    const m = $('message');
    m.textContent = text;                 // textContent => no XSS
    m.className = ok ? 'ok' : 'err';
    m.style.display = 'block';
  }

  function renderIdentity() {
    const token = store.get(TOKEN_KEY);
    const name = store.get(NAME_KEY);
    const returning = Boolean(token && name);
    $('welcome').style.display = returning ? 'block' : 'none';
    $('nameRow').style.display = returning ? 'none' : 'block';
    if (returning) $('welcomeName').textContent = name;
  }

  $('notYou').addEventListener('click', () => {
    store.del(TOKEN_KEY);
    store.del(NAME_KEY);
    renderIdentity();
    $('name').focus();
  });

  fetch('/api/config').then((r) => r.json()).then((c) => {
    limits = c;
    $('limits').textContent =
      `Up to ${c.maxFiles} photos, ${c.maxFileSizeMb} MB each. JPEG, PNG or WebP.`;
  }).catch(() => {});

  // Previews + instant client-side checks (the server re-checks everything)
  $('photos').addEventListener('change', () => {
    const box = $('previews');
    box.replaceChildren();
    const files = [...$('photos').files];
    const problem = checkFiles(files);
    if (problem) { showMessage(problem, false); return; }
    $('message').style.display = 'none';
    files.forEach((f) => {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(f);
      img.onload = () => URL.revokeObjectURL(img.src);
      img.alt = 'Preview';
      box.appendChild(img);
    });
  });

  function checkFiles(files) {
    if (files.length === 0) return 'Please choose at least one photo.';
    if (files.length > limits.maxFiles) return `Please choose at most ${limits.maxFiles} photos.`;
    for (const f of files) {
      if (!ALLOWED.includes(f.type)) return `"${f.name}" is not a JPEG, PNG or WebP image.`;
      if (f.size > limits.maxFileSizeMb * 1024 * 1024)
        return `"${f.name}" is larger than ${limits.maxFileSizeMb} MB.`;
    }
    return null;
  }

  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const token = store.get(TOKEN_KEY);
    const name = ($('name').value || store.get(NAME_KEY) || '').trim();
    const files = [...$('photos').files];

    if (!name) return showMessage('Please enter your name.', false);
    const problem = checkFiles(files);
    if (problem) return showMessage(problem, false);
    if (!$('consent').checked)
      return showMessage('Please tick the consent box to continue.', false);

    const fd = new FormData();
    fd.append('name', name);
    fd.append('consent', 'true');
    files.forEach((f) => fd.append('photos', f));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    if (token) xhr.setRequestHeader('x-visitor-token', token);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) $('progress').value = (ev.loaded / ev.total) * 100;
    };
    xhr.onloadstart = () => {
      $('submit').disabled = true;          // prevent double submits
      $('progress').style.display = 'block';
      $('progress').value = 0;
      $('message').style.display = 'none';
    };
    xhr.onloadend = () => {
      $('submit').disabled = false;
      $('progress').style.display = 'none';
    };
    xhr.onerror = () => showMessage('Network problem. Please try again.', false);

    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status === 201) {
        if (body.token) {                    // issued only for a new visitor
          store.set(TOKEN_KEY, body.token);
          store.set(NAME_KEY, name);
        }
        showMessage('Uploaded! Look at the screen.', true);
        $('form').reset();
        $('previews').replaceChildren();
        renderIdentity();
      } else {
        showMessage(body.error || 'Upload failed. Please try again.', false);
      }
    };

    xhr.send(fd);
  });

  async function loadMine() {
    const token = store.get(TOKEN_KEY);
    $('mine').style.display = 'none';
    if (!token) return;
    try {
      const r = await fetch('/api/my-photos', { headers: { 'x-visitor-token': token } });
      if (r.status === 401) {              // stale token: forget it
        store.del(TOKEN_KEY); store.del(NAME_KEY); renderIdentity(); return;
      }
      const { photos } = await r.json();
      const grid = $('mine-grid');
      grid.replaceChildren();
      photos.forEach((p) => {
        const box = document.createElement('div');
        box.className = 'thumb';
        const img = document.createElement('img');
        img.src = p.url; img.alt = 'Your photo';
        const btn = document.createElement('button');
        btn.type = 'button'; btn.textContent = 'Delete';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          const d = await fetch(`/api/photos/${p.id}`, {
            method: 'DELETE', headers: { 'x-visitor-token': token },
          });
          if (d.ok) loadMine();
          else { btn.disabled = false; showMessage('Could not delete that photo.', false); }
        });
        box.append(img, btn);
        grid.appendChild(box);
      });
      $('mine').style.display = photos.length ? 'block' : 'none';
    } catch {}
  }

  $('eraseAll').addEventListener('click', async () => {
    if (!confirm('Delete all your photos and your visitor record? This cannot be undone.')) return;
    const token = store.get(TOKEN_KEY);
    const r = await fetch('/api/me', { method: 'DELETE', headers: { 'x-visitor-token': token } });
    if (r.ok) {
      store.del(TOKEN_KEY); store.del(NAME_KEY);
      renderIdentity(); loadMine();
      showMessage('All your data has been deleted.', true);
    } else {
      showMessage('Could not delete. Please try again.', false);
    }
  });

  loadMine();
  renderIdentity();