const photoEl = document.getElementById('photo');
  const idleEl = document.getElementById('idle');
  const captionEl = document.getElementById('caption');
  const statusEl = document.getElementById('status');

  let durationMs = 10000;
  const queue = [];        // FIFO of slides: { id, url, caption }
  let playing = false;
  let current = null;
  let timer = null;

  fetch('/api/config').then(r => r.json())
    .then(c => { durationMs = c.slideDurationSeconds * 1000; })
    .catch(() => {});

  function enqueue(data) {
    data.newPhotos.forEach(p =>
      queue.push({ id: p.id, url: p.url, caption: data.name }));
    data.previousPhotos.forEach(p =>
      queue.push({ id: p.id, url: p.url, caption: data.name + ' (earlier visit)' }));
    if (!playing) next();
  }

  function preload(url) { const i = new Image(); i.src = url; }

  function next() {
    clearTimeout(timer);
    current = queue.shift() || null;
    if (!current) {
      playing = false;
      photoEl.style.display = 'none';
      captionEl.style.display = 'none';
      idleEl.style.display = 'block';
      return;
    }
    const slide = current;
    playing = true;
    if (queue[0]) preload(queue[0].url);

    photoEl.onload = () => {
      if (current !== slide) return;           // removed or replaced while loading
      idleEl.style.display = 'none';
      photoEl.style.display = 'block';
      captionEl.textContent = slide.caption;   // textContent => no XSS
      captionEl.style.display = 'block';
      timer = setTimeout(next, durationMs);
    };
    photoEl.onerror = () => { if (current === slide) next(); };
    photoEl.src = slide.url;
  }

  // A photo was deleted: drop it from the queue, and skip it if it is on screen now
  function removeSlides(ids) {
    const gone = new Set(ids);
    for (let i = queue.length - 1; i >= 0; i--) {
      if (gone.has(queue[i].id)) queue.splice(i, 1);
    }
    if (current && gone.has(current.id)) next();
  }

  const es = new EventSource('/api/events');
  es.onopen = () => { statusEl.textContent = 'live'; };
  es.onerror = () => { statusEl.textContent = 'reconnecting…'; };
  es.addEventListener('slideshow', (e) => enqueue(JSON.parse(e.data)));
  es.addEventListener('remove', (e) => removeSlides(JSON.parse(e.data).ids));