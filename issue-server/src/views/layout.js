import { icon } from './icons.js';

export const escapeHtml = (text) =>
  String(text ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ]),
  );

// JSON that is safe to place inside a <script> tag
export const scriptJson = (value) =>
  JSON.stringify(value).replace(/</g, '\\u003c');

export const formatOffset = (ms) => {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
};

export const formatDate = (ts) =>
  ts
    ? new Date(ts).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/** Link to a replay at a moment; starts 2 seconds early to show the lead-up. */
export const replayLink = (sessionId, offsetMs) =>
  `/media/${encodeURIComponent(sessionId)}/replay.html${
    offsetMs ? `?t=${Math.max(0, Math.floor(offsetMs / 1000) - 2)}` : ''
  }`;

/*
 * Design system: data-dense dashboard. Slate neutrals, blue primary, amber for
 * warnings, red for errors; Fira Sans for text and Fira Code for numbers/code.
 */
export const STYLE = `
:root{
  --bg:#F8FAFC;--surface:#FFFFFF;--surface-2:#F1F5F9;--border:#E2E8F0;--border-strong:#CBD5E1;
  --text:#0F172A;--text-2:#334155;--muted:#64748B;
  --primary:#1E40AF;--primary-hover:#1E3A8A;--primary-soft:#DBEAFE;--on-primary:#FFFFFF;
  --danger:#DC2626;--danger-soft:#FEE2E2;--warning:#B45309;--warning-soft:#FEF3C7;
  --success:#15803D;--success-soft:#DCFCE7;--info:#1D4ED8;--info-soft:#DBEAFE;
  --ring:#3B82F6;--shadow:0 1px 2px rgba(15,23,42,.06),0 1px 3px rgba(15,23,42,.08);
  --radius:10px;--radius-sm:6px;
  --font:'Fira Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
  --mono:'Fira Code',ui-monospace,SFMono-Regular,Menlo,monospace;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#020617;--surface:#0F172A;--surface-2:#1E293B;--border:#1E293B;--border-strong:#334155;
  --text:#F1F5F9;--text-2:#CBD5E1;--muted:#94A3B8;
  --primary:#60A5FA;--primary-hover:#93C5FD;--primary-soft:#172554;--on-primary:#0F172A;
  --danger:#F87171;--danger-soft:#450A0A;--warning:#FBBF24;--warning-soft:#422006;
  --success:#4ADE80;--success-soft:#052E16;--info:#93C5FD;--info-soft:#172554;
  --ring:#60A5FA;--shadow:0 1px 2px rgba(0,0,0,.4);
  color-scheme:dark;
}}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--text);font:14px/1.5 var(--font);-webkit-font-smoothing:antialiased}
a{color:var(--primary);text-decoration:none}a:hover{text-decoration:underline}
:focus-visible{outline:2px solid var(--ring);outline-offset:2px;border-radius:4px}
.icon{flex:none;vertical-align:-3px}
code,.mono{font-family:var(--mono);font-size:12.5px}
.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.muted{color:var(--muted)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}

/* shell */
.shell{display:grid;grid-template-columns:232px minmax(0,1fr);min-height:100vh}
.sidebar{position:sticky;top:0;height:100vh;background:var(--surface);border-right:1px solid var(--border);padding:16px 12px;display:flex;flex-direction:column;gap:4px}
.brand{display:flex;align-items:center;gap:10px;padding:6px 10px 18px;font-weight:600;font-size:15px}
.brand-mark{width:28px;height:28px;border-radius:8px;background:var(--primary);color:var(--on-primary);display:grid;place-items:center}
.nav a{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-sm);color:var(--text-2);font-weight:500;transition:background .15s,color .15s}
.nav a:hover{background:var(--surface-2);text-decoration:none;color:var(--text)}
.nav a[aria-current="page"]{background:var(--primary-soft);color:var(--primary)}
.sidebar-foot{margin-top:auto;padding:10px;color:var(--muted);font-size:12px;line-height:1.4}
main{padding:28px 32px 56px;max-width:1320px;width:100%}
@media (max-width:860px){
  .shell{grid-template-columns:1fr}
  .sidebar{position:static;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center;padding:10px 12px;border-right:0;border-bottom:1px solid var(--border)}
  .brand{padding:4px 8px}.nav{display:flex;flex-wrap:wrap;gap:2px}.sidebar-foot{display:none}
  main{padding:20px 16px 40px}
}

/* page header */
.page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.page-head h1{margin:0;font-size:22px;font-weight:600;letter-spacing:-.01em}
.page-head p{margin:4px 0 0;color:var(--muted);max-width:70ch}
.back{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:13px;margin-bottom:10px}
.meta{display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--muted);font-size:13px;margin-top:6px}
.meta span{display:inline-flex;align-items:center;gap:6px}

/* buttons and inputs */
.btn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:var(--radius-sm);border:1px solid var(--border-strong);background:var(--surface);color:var(--text);font:500 13px var(--font);cursor:pointer;transition:background .15s,border-color .15s;white-space:nowrap}
.btn:hover{background:var(--surface-2);text-decoration:none}
.btn-primary{background:var(--primary);border-color:var(--primary);color:var(--on-primary)}
.btn-primary:hover{background:var(--primary-hover);border-color:var(--primary-hover)}
.btn-danger{color:var(--danger)}
.btn-sm{height:28px;padding:0 10px;font-size:12px}
input,select,textarea{font:14px var(--font);color:var(--text);background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:6px 10px;min-height:34px;transition:border-color .15s}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--ring);box-shadow:0 0 0 3px color-mix(in srgb,var(--ring) 25%,transparent)}
label.field{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:500;color:var(--muted)}
label.check{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--text-2);min-height:34px}

/* toolbar (filters) */
.toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:20px}
.toolbar .spacer{flex:1}

/* cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:20px;overflow:hidden}
.card-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border)}
.card-head h2{margin:0;font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
.card-body{padding:16px}
.grid-2{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:20px;align-items:start}
@media (max-width:1100px){.grid-2{grid-template-columns:1fr}}

/* KPI tiles */
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:12px;margin-bottom:20px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:6px}
.kpi-top{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.04em}
.kpi-icon{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--surface-2);color:var(--text-2)}
.kpi-icon.danger{background:var(--danger-soft);color:var(--danger)}.kpi-icon.info{background:var(--info-soft);color:var(--info)}
.kpi-icon.warning{background:var(--warning-soft);color:var(--warning)}.kpi-icon.success{background:var(--success-soft);color:var(--success)}
.kpi-value{font:600 26px/1.1 var(--mono);font-variant-numeric:tabular-nums}
.kpi-value.empty{color:var(--muted)}
.kpi-note{color:var(--muted);font-size:12px}

/* tables */
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:10px 16px;background:var(--surface-2);border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:11px 16px;border-bottom:1px solid var(--border);vertical-align:top;overflow-wrap:anywhere}
tr:last-child td{border-bottom:0}
tbody tr{transition:background .15s}tbody tr:hover{background:var(--surface-2)}
td.right,th.right{text-align:right}
td.nowrap{white-space:nowrap}
.cell-title{font-weight:500;color:var(--text)}
.cell-sub{color:var(--muted);font-size:12px;margin-top:2px;overflow-wrap:anywhere}
.row-link{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-weight:500}

/* badges */
.badge{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:999px;font-size:11.5px;font-weight:600;white-space:nowrap;background:var(--surface-2);color:var(--text-2)}
.badge::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.badge.plain::before{display:none}
.badge.danger{background:var(--danger-soft);color:var(--danger)}.badge.warning{background:var(--warning-soft);color:var(--warning)}
.badge.success{background:var(--success-soft);color:var(--success)}.badge.info{background:var(--info-soft);color:var(--info)}
.count{display:inline-block;min-width:22px;padding:0 7px;border-radius:999px;background:var(--surface-2);color:var(--text-2);font:600 12px/20px var(--mono);text-align:center}

/* lists inside cards */
.list{list-style:none;margin:0;padding:0}
.list li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border)}
.list li:last-child{border-bottom:0}
.bar{height:6px;border-radius:3px;background:var(--surface-2);overflow:hidden;margin-top:6px}
.bar > span{display:block;height:100%;background:var(--primary);border-radius:3px}

/* issue cards */
.issue{padding:14px 16px;border-bottom:1px solid var(--border)}
.issue:last-child{border-bottom:0}
.issue-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.issue-title{font-weight:500;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.issue-trigger{color:var(--muted);font-size:12.5px;margin-top:4px}
pre{margin:8px 0 0;white-space:pre-wrap;word-break:break-word;font:12px/1.55 var(--mono);background:var(--surface-2);border-radius:var(--radius-sm);padding:10px 12px;max-height:360px;overflow:auto;color:var(--text-2)}

/* states */
.empty{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:36px 16px;color:var(--muted)}
.empty .icon{color:var(--border-strong)}
.empty strong{color:var(--text-2);font-weight:600}
.notice{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:var(--radius-sm);background:var(--warning-soft);color:var(--warning);margin-bottom:12px;font-size:13px}
.notice span{color:var(--text-2)}
details.more{margin-top:12px}details.more summary{cursor:pointer;color:var(--muted);font-size:13px}
.stack{display:flex;flex-direction:column;gap:12px}
.inline{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
`;

const NAV = [
  ['/', 'Overview', 'overview'],
  ['/sessions', 'Sessions', 'sessions'],
  ['/heatmaps', 'Heatmaps', 'heatmap'],
  ['/feedback', 'Feedback', 'feedback'],
  ['/settings', 'Settings', 'settings'],
];

/** Keeps the shared date range when moving between pages. */
export function sharedQuery(filters) {
  const params = new URLSearchParams();
  if (filters?.fromText) params.set('from', filters.fromText);
  if (filters?.toText) params.set('to', filters.toText);
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function page({ title, active, filters, body }) {
  const query = sharedQuery(filters);
  const nav = NAV.map(
    ([href, label, name]) =>
      `<a href="${href}${query}"${
        href === active ? ' aria-current="page"' : ''
      }>${icon(name, { size: 18 })}${label}</a>`,
  ).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · rrweb QA</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Fira+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${STYLE}</style></head>
<body><div class="shell">
<nav class="sidebar" aria-label="Main">
  <div class="brand"><span class="brand-mark">${icon('layers', {
    size: 16,
  })}</span>rrweb QA</div>
  <div class="nav">${nav}</div>
  <div class="sidebar-foot">Local data only.<br>Nothing leaves this machine.</div>
</nav>
<main>${body}</main>
</div></body></html>`;
}

/** Page title, description and optional actions. */
export const pageHead = ({
  title,
  description = '',
  actions = '',
  back = '',
}) =>
  `${back}<div class="page-head"><div><h1>${title}</h1>${
    description ? `<p>${description}</p>` : ''
  }</div>${actions ? `<div class="inline">${actions}</div>` : ''}</div>`;

export const backLink = (href, label) =>
  `<a class="back" href="${href}">${icon('arrowLeft', {
    size: 14,
  })}${label}</a>`;

export const card = ({ title, iconName, action = '', body, flush = false }) =>
  `<section class="card"><div class="card-head"><h2>${
    iconName ? icon(iconName) : ''
  }${title}</h2>${action}</div>${
    flush ? body : `<div class="card-body">${body}</div>`
  }</section>`;

export const emptyState = (iconName, title, hint = '') =>
  `<div class="empty">${icon(iconName, { size: 32 })}<strong>${title}</strong>${
    hint ? `<span>${hint}</span>` : ''
  }</div>`;

export const badge = (text, tone = '') =>
  `<span class="badge ${tone}">${escapeHtml(text)}</span>`;

/** Date range (and optional extra fields) submitted as GET to the current page. */
export function filterBar(filters, extra = '') {
  return `<form class="toolbar" method="get" role="search">
  <label class="field">From<input type="date" name="from" value="${escapeHtml(
    filters.fromText || '',
  )}"></label>
  <label class="field">To<input type="date" name="to" value="${escapeHtml(
    filters.toText || '',
  )}"></label>
  ${extra}
  <span class="spacer"></span>
  <a class="btn" href="?">Reset</a>
  <button class="btn btn-primary" type="submit">Apply filters</button>
</form>`;
}

export const select = (name, label, options, value) =>
  `<label class="field">${label}<select name="${name}">${options
    .map(
      ([v, text]) =>
        `<option value="${escapeHtml(v)}"${
          v === (value || '') ? ' selected' : ''
        }>${escapeHtml(text)}</option>`,
    )
    .join('')}</select></label>`;
