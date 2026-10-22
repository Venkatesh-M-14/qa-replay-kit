import { DEVICE_LABELS } from '../pages.js';
import { MIN_SESSIONS_FOR_CONCLUSIONS } from '../heatmap.js';
import { icon } from './icons.js';
import {
  backLink,
  card,
  emptyState,
  escapeHtml,
  filterBar,
  page,
  pageHead,
  replayLink,
  scriptJson,
  select,
} from './layout.js';

const pct = (share) =>
  share === null || share === undefined ? '—' : `${Math.round(share * 100)}%`;

function deviceSelect(filters) {
  return select(
    'device',
    'Screen size',
    [['', 'All sizes'], ...Object.entries(DEVICE_LABELS)],
    filters.device,
  );
}

export function renderHeatmapIndex(pages, filters) {
  const range = `${filters.fromText ? `&from=${filters.fromText}` : ''}${
    filters.toText ? `&to=${filters.toText}` : ''
  }`;
  const top = pages[0]?.clicks || 1;
  const rows = pages
    .map(
      (p) => `<tr>
  <td><a class="cell-title" href="/heatmaps?page=${encodeURIComponent(
    p.page,
  )}${range}">${escapeHtml(p.page)}</a>
    <div class="bar" style="max-width:320px"><span style="width:${Math.max(
      3,
      Math.round((p.clicks / top) * 100),
    )}%"></span></div></td>
  <td class="right num">${p.clicks}</td><td class="right num">${p.sessions}</td>
  <td class="right"><a class="row-link" href="/heatmaps?page=${encodeURIComponent(
    p.page,
  )}${range}">View ${icon('chevron', { size: 14 })}</a></td></tr>`,
    )
    .join('');
  return page({
    title: 'Heatmaps',
    active: '/heatmaps',
    filters,
    body: `${pageHead({
      title: 'Heatmaps',
      description:
        'Built from clicks and scrolling in saved sessions. They show where testers clicked, so read them as a test-coverage map rather than real-user analytics.',
    })}
${filterBar(filters)}
${card({
  title: 'Pages',
  iconName: 'heatmap',
  action: `<span class="count">${pages.length}</span>`,
  flush: true,
  body: rows
    ? `<div class="table-wrap"><table><thead><tr><th>Page</th><th class="right">Clicks</th><th class="right">Sessions</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : emptyState(
        'click',
        'No clicks recorded yet',
        'Record a session with the updated extension and save it to the log server.',
      ),
})}`,
  });
}

function scrollChart(scroll) {
  if (!scroll.views) return emptyState('scroll', 'No visits in this range');
  if (!scroll.measured)
    return emptyState(
      'scroll',
      'Scroll depth unknown',
      `These ${scroll.views} visit(s) were recorded before page metrics were added.`,
    );
  const rows = scroll.steps
    .map(
      (s) => `<li><span class="num muted" style="width:44px">${s.depth}%</span>
      <div class="bar" style="flex:1;margin:0;height:10px"><span style="width:${Math.round(
        (s.share ?? 0) * 100,
      )}%"></span></div>
      <span class="num" style="width:44px;text-align:right">${pct(
        s.share,
      )}</span></li>`,
    )
    .join('');
  return `<p class="muted" style="margin:12px 16px 4px">Share of ${
    scroll.measured
  } visit(s) that scrolled at least this far down.${
    scroll.container
      ? ' This page scrolls inside a panel; depth is measured on that panel.'
      : ''
  }</p><ul class="list">${rows}</ul>`;
}

function elementRows(elements) {
  return elements
    .slice(0, 30)
    .map(
      (e) => `<tr><td><span class="mono">${escapeHtml(e.element)}</span></td>
      <td class="right num">${e.clicks}</td><td class="right num">${pct(
        e.share,
      )}</td><td class="right num">${e.sessions}</td>
      <td class="right"><a class="btn btn-sm" href="${replayLink(
        e.example.session_id,
        e.example.offset_ms,
      )}" target="_blank">${icon('play', { size: 12 })}Example</a></td></tr>`,
    )
    .join('');
}

export function renderHeatmapPage(data, filters) {
  const extra = `<input type="hidden" name="page" value="${escapeHtml(
    data.page,
  )}">${deviceSelect(filters)}`;
  const notices = [];
  if (!data.enoughData)
    notices.push(
      `Based on ${data.sessions} session(s). With fewer than ${MIN_SESSIONS_FOR_CONCLUSIONS} sessions this shows individual test runs, not a pattern.`,
    );
  if (data.device === 'all' && data.viewportWidths.length > 1)
    notices.push(
      `Clicks come from ${data.viewportWidths.length} different window widths. Pick a screen size for a more accurate overlay.`,
    );
  if (data.background?.container)
    notices.push(
      'This page scrolls inside a panel. Clicks made after scrolling that panel may appear higher than where they happened.',
    );

  return page({
    title: `Heatmap ${data.page}`,
    active: '/heatmaps',
    filters,
    body: `${pageHead({
      back: backLink('/heatmaps', 'All pages'),
      title: `<span class="mono" style="font-size:20px">${escapeHtml(
        data.page,
      )}</span>`,
      description: `${data.clicks.length} click(s) from ${data.sessions} session(s)`,
    })}
${filterBar(filters, extra)}
${notices
  .map(
    (n) =>
      `<div class="notice">${icon('alert')}<span>${escapeHtml(n)}</span></div>`,
  )
  .join('')}
<div class="grid-2">
  ${card({
    title: 'Click heatmap',
    iconName: 'heatmap',
    action:
      '<span class="muted" style="font-size:12px">Click a hot spot for its sessions</span>',
    body: `<div id="heatmap-status" class="empty">Loading page snapshot…</div>
<div id="heatmap-outer" style="position:relative;overflow:hidden;display:none;border:1px solid var(--border);border-radius:var(--radius-sm);background:#fff">
  <div id="heatmap-stage" style="position:absolute;top:0;left:0;transform-origin:0 0">
    <div id="heatmap-replay"></div>
    <canvas id="heatmap-canvas" style="position:absolute;top:0;left:0;cursor:crosshair" aria-label="Click density over the page"></canvas>
  </div>
</div>
<div id="heatmap-detail" aria-live="polite"></div>`,
  })}
  <div>
    ${card({
      title: 'Scroll depth',
      iconName: 'scroll',
      flush: true,
      body: scrollChart(data.scroll),
    })}
  </div>
</div>
${card({
  title: 'Most clicked elements',
  iconName: 'click',
  action: `<span class="count">${data.elements.length}</span>`,
  flush: true,
  body: data.elements.length
    ? `<div class="table-wrap"><table><thead><tr><th>Element</th><th class="right">Clicks</th><th class="right">Share</th><th class="right">Sessions</th><th></th></tr></thead><tbody>${elementRows(
        data.elements,
      )}</tbody></table></div>`
    : emptyState('click', 'No clicks on this page in this range'),
})}

<link rel="stylesheet" href="/vendor/rrweb.css">
<style>.replayer-mouse,.replayer-mouse-tail{display:none!important}#heatmap-replay iframe{border:0;pointer-events:none;background:#fff}</style>
<script src="/vendor/rrweb.js"></script>
<script>
const data = ${scriptJson(data)};
const MAX_HEIGHT = 6000;
const RADIUS = 26;
const status = document.getElementById('heatmap-status');

function palette() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0.15, 'blue'); g.addColorStop(0.4, 'cyan');
  g.addColorStop(0.6, 'lime'); g.addColorStop(0.8, 'yellow'); g.addColorStop(1, 'red');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

function drawHeat(canvas, points) {
  const ctx = canvas.getContext('2d');
  // density: each click adds a soft dot of opacity; overlaps get darker
  for (const p of points) {
    const g = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, RADIUS);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.px - RADIUS, p.py - RADIUS, RADIUS * 2, RADIUS * 2);
  }
  // colour by density: blue (few) to red (many)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const colors = palette();
  for (let i = 3; i < image.data.length; i += 4) {
    const a = image.data[i];
    if (!a) continue;
    image.data[i - 3] = colors[a * 4];
    image.data[i - 2] = colors[a * 4 + 1];
    image.data[i - 1] = colors[a * 4 + 2];
    image.data[i] = Math.min(220, 60 + a);
  }
  ctx.putImageData(image, 0, 0);
}

function showDetail(points, x, y) {
  const near = points.filter((p) => Math.hypot(p.px - x, p.py - y) <= RADIUS);
  const box = document.getElementById('heatmap-detail');
  if (!near.length) { box.innerHTML = ''; return; }
  const bySession = new Map();
  for (const p of near) if (!bySession.has(p.session)) bySession.set(p.session, p);
  const elements = [...new Set(near.map((p) => p.element))];
  box.innerHTML = '<div class="stack" style="margin-top:14px"><div><strong>' + near.length + ' click(s) here</strong> from ' + bySession.size +
    ' session(s)<div class="cell-sub mono">' + elements.map((e) => e.replace(/[&<>"]/g, '')).join(' · ') + '</div></div><div class="inline">' +
    [...bySession.values()].slice(0, 10).map((p) =>
      '<a class="btn btn-sm" target="_blank" href="/media/' + encodeURIComponent(p.session) + '/replay.html?t=' +
      Math.max(0, Math.floor(p.t / 1000) - 2) + '">Replay at ' + Math.floor(p.t / 1000) + 's</a>').join('') +
    '</div></div>';
}

async function render() {
  const bg = data.background;
  if (!bg) { status.textContent = 'No session with this page to draw the heatmap on.'; return; }
  const response = await fetch('/api/sessions/' + encodeURIComponent(bg.session_id) + '/events');
  if (!response.ok) { status.textContent = 'The recording used as background could not be loaded.'; return; }
  const events = await response.json();
  if (!events.some((e) => e.type === 2)) {
    status.textContent = 'This recording has no page snapshot, so the heatmap cannot be drawn faithfully.';
    return;
  }
  const outer = document.getElementById('heatmap-outer');
  const stage = document.getElementById('heatmap-stage');
  outer.style.display = 'block';
  const replayer = new rrweb.Replayer(events, {
    root: document.getElementById('heatmap-replay'),
    mouseTail: false, showWarning: false, triggerFocus: false, skipInactive: false,
  });
  replayer.pause(bg.offset_ms);
  await new Promise((r) => setTimeout(r, 300));

  const width = bg.viewport_w;
  const fullPage = !bg.container && bg.page_height > (bg.viewport_h || 0);
  const height = Math.min(MAX_HEIGHT, fullPage ? bg.page_height : bg.viewport_h || 800);
  const iframe = replayer.iframe;
  iframe.setAttribute('width', width);
  iframe.setAttribute('height', height);
  try {
    iframe.contentWindow.scrollTo(0, 0);
    // the snapshot is a fixed moment; closing the document ends the browser's loading state
    iframe.contentDocument.close();
  } catch (e) { /* sandboxed */ }

  const canvas = document.getElementById('heatmap-canvas');
  canvas.width = width; canvas.height = height;
  const points = data.clicks
    .map((c) => ({ ...c, px: c.x * width, py: c.y }))
    .filter((p) => p.py >= 0 && p.py <= height);
  drawHeat(canvas, points);
  if (bg.viewport_h && fullPage) {
    const ctx = canvas.getContext('2d');
    ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, bg.viewport_h); ctx.lineTo(width, bg.viewport_h); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = '14px system-ui';
    ctx.fillText('end of first screen', 8, bg.viewport_h - 6);
  }
  canvas.addEventListener('click', (e) => showDetail(points, e.offsetX, e.offsetY));

  const fit = () => {
    const scale = Math.min(1, outer.clientWidth / width);
    stage.style.transform = 'scale(' + scale + ')';
    outer.style.height = height * scale + 'px';
  };
  fit();
  window.addEventListener('resize', fit);
  status.style.display = 'none';
  const hidden = data.clicks.length - points.length;
  if (hidden > 0) {
    status.style.display = '';
    status.textContent = hidden + ' click(s) fall outside this page snapshot (the page layout differed) and are not drawn.';
  }
}
render().catch((err) => { status.textContent = 'Heatmap could not be drawn: ' + err.message; });
</script>`,
  });
}
