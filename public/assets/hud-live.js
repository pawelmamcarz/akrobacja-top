/**
 * Hero HUD - live METAR feed.
 * Fetches /api/metar (NOAA via EPRA, closest field to EPRP),
 * updates RWY / WIND / conditions. Falls back to static defaults on failure
 * and visually marks the dot as stale (amber, no blink).
 */
(function () {
  var strip = document.getElementById('hud-strip');
  if (!strip) return;
  var els = {
    status: document.getElementById('hud-status'),
    rwy: document.getElementById('hud-rwy'),
    wind: document.getElementById('hud-wind'),
    cond: document.getElementById('hud-cond'),
    dot: document.getElementById('hud-live-dot'),
  };
  if (!els.status || !els.rwy || !els.wind || !els.cond) return;

  function setStale(reason) {
    els.status.textContent = 'METAR';
    if (els.dot) {
      els.dot.style.background = '#FFB300';
      els.dot.style.boxShadow = '0 0 0 2px rgba(255,179,0,.25)';
      els.dot.style.animation = 'none';
    }
    strip.title = 'Statyczne dane - METAR niedostępny (' + (reason || 'fetch') + ')';
  }

  // Skip on slow connections
  if (navigator.connection && navigator.connection.saveData) return;

  fetch('/api/metar', { cache: 'default' })
    .then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    })
    .then(function (j) {
      if (!j || !j.ok) {
        setStale(j && j.error ? j.error : 'no data');
        return;
      }
      if (j.rwy) els.rwy.textContent = j.rwy;
      if (j.wind) els.wind.textContent = j.wind;
      if (j.conditions) els.cond.textContent = j.conditions;
      // Tooltip with raw METAR + observation time
      var parts = [];
      if (j.raw) parts.push(j.raw);
      if (j.observed) parts.push('obs: ' + j.observed);
      parts.push('źródło: NOAA · ' + (j.station || 'EPRA') + ' (najbliższe METAR do EPRP)');
      strip.title = parts.join('\n');
      // Mark observation freshness - older than 2h = stale
      if (j.observed) {
        var t = Date.parse(j.observed);
        if (!Number.isNaN(t) && Date.now() - t > 2 * 3600 * 1000) {
          setStale('obs >2h');
        }
      }
    })
    .catch(function (e) {
      setStale(e && e.message ? e.message : 'fetch error');
    });
})();
