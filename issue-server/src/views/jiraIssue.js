import { renderWiki } from '../wiki.js';
import { escapeHtml, scriptJson } from './layout.js';
import { icon } from './icons.js';

/*
 * A preview of the draft laid out like a Jira issue: title, key details
 * (description, environment, attachments) on the left and a details panel on
 * the right. It is a preview only; every value can be copied into Jira.
 */

// simple issue-type and priority glyphs (not Jira's own artwork)
const TYPE_ICONS = {
  Bug: '<svg viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" rx="3" fill="#E5493A"/><circle cx="8" cy="8" r="3.2" fill="#fff"/></svg>',
  Story:
    '<svg viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" rx="3" fill="#63BA3C"/><path d="M5 4h6v8l-3-2-3 2z" fill="#fff"/></svg>',
  Task: '<svg viewBox="0 0 16 16" width="16" height="16"><rect width="16" height="16" rx="3" fill="#4BADE8"/><path d="M4.5 8.2l2.3 2.3 4.7-5" stroke="#fff" stroke-width="2" fill="none"/></svg>',
};
const PRIORITY_ICONS = {
  High: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 10l5-5 5 5" stroke="#E5493A" stroke-width="2" fill="none"/></svg>',
  Medium:
    '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 6h10M3 10h10" stroke="#E2A93B" stroke-width="2"/></svg>',
  Low: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 6l5 5 5-5" stroke="#2684FF" stroke-width="2" fill="none"/></svg>',
};

const STYLE = `
.jira{--j-text:#172B4D;--j-subtle:#626F86;--j-border:#DCDFE4;--j-bg:#fff;--j-sunken:#F7F8F9;--j-blue:#0C66E4;--j-hover:#F1F2F4;
  color:var(--j-text);background:var(--j-bg);border-radius:8px;box-shadow:0 8px 24px rgba(9,30,66,.25),0 0 1px rgba(9,30,66,.31);
  font:14px/1.43 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;margin:16px 0 28px;overflow:hidden}
.jira *{box-sizing:border-box}
.jira a{color:var(--j-blue)}
.jira .j-top{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:16px 24px 0;flex-wrap:wrap}
.jira .j-crumb{display:flex;align-items:center;gap:6px;color:var(--j-subtle);font-size:14px}
.jira .j-crumb b{color:var(--j-text);font-weight:500}
.jira .j-draft{font-size:11px;font-weight:700;text-transform:uppercase;background:#FFF7D6;color:#7F5F01;border-radius:3px;padding:0 4px}
.jira .j-actions{display:flex;gap:6px;flex-wrap:wrap}
.jira button,.jira .j-btn{font:inherit;font-size:14px;color:var(--j-text);background:var(--j-bg);border:1px solid var(--j-border);border-radius:3px;
  padding:4px 10px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;line-height:20px}
.jira button:hover,.jira .j-btn:hover{background:var(--j-hover)}
.jira button.j-primary{background:var(--j-blue);color:#fff;border-color:var(--j-blue)}
.jira .j-body{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:32px;padding:16px 24px 24px}
@media (max-width:900px){.jira .j-body{grid-template-columns:1fr}}
.jira h1.j-title{font-size:24px;line-height:28px;font-weight:500;margin:4px 0 20px;overflow-wrap:anywhere}
.jira .j-section{font-size:16px;font-weight:600;margin:0 0 12px;display:flex;align-items:center;gap:6px}
.jira .j-label{font-size:14px;font-weight:600;margin:16px 0 6px}
.jira .j-field{border-radius:3px;padding:4px 0;overflow-wrap:anywhere}
.jira .j-field p{margin:0 0 8px}
.jira .wiki-h{font-size:16px;font-weight:600;margin:16px 0 6px}
.jira h3.wiki-h:first-child{margin-top:0}
.jira .wiki-list{margin:4px 0 10px;padding-left:24px}.jira .wiki-list li{margin:2px 0}
.jira .wiki-pre{background:var(--j-sunken);border:0;border-radius:3px;padding:8px 12px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
  white-space:pre-wrap;word-break:break-word;margin:6px 0;max-height:none;color:var(--j-text)}
.jira .wiki-quote{border-left:2px solid var(--j-border);margin:6px 0 10px;padding:2px 12px;color:var(--j-text)}
.jira .wiki-table{border-collapse:collapse;margin:6px 0 12px;width:auto}
.jira .wiki-table th,.jira .wiki-table td{border:1px solid var(--j-border);padding:4px 10px;text-align:left;font-size:13px}
.jira .wiki-table th{background:var(--j-sunken)}
.jira .wiki-img{display:block;border:1px solid var(--j-border);border-radius:3px;margin:8px 0;max-width:100%}
.jira .wiki-attachment{font-weight:500}
.jira .j-empty{color:var(--j-subtle)}
.jira .j-attachments{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.jira .j-att{border:1px solid var(--j-border);border-radius:3px;overflow:hidden;text-decoration:none;color:var(--j-text);display:block}
.jira .j-att:hover{box-shadow:0 1px 3px rgba(9,30,66,.25)}
.jira .j-thumb{height:96px;background:var(--j-sunken);display:flex;align-items:center;justify-content:center;font-size:30px;overflow:hidden}
.jira .j-thumb img{width:100%;height:100%;object-fit:cover;object-position:top}
.jira .j-att span{display:block;padding:6px 8px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.jira .j-status{display:inline-flex;align-items:center;gap:6px;background:#E9F2FF;color:#0055CC;border-radius:3px;padding:4px 10px;font-weight:500;margin-bottom:16px}
.jira .j-panel{border:1px solid var(--j-border);border-radius:3px}
.jira .j-panel h4{margin:0;padding:12px 16px;font-size:16px;font-weight:600;border-bottom:1px solid var(--j-border)}
.jira .j-row{display:grid;grid-template-columns:120px 1fr;gap:8px;padding:8px 16px;align-items:center}
.jira .j-row > div:first-child{color:var(--j-subtle);font-weight:600;font-size:13px}
.jira .j-avatar{display:inline-flex;width:24px;height:24px;border-radius:50%;background:#C1C7D0;color:#fff;font-size:11px;font-weight:700;align-items:center;justify-content:center;margin-right:8px;vertical-align:middle}
.jira .j-avatar.set{background:#DE350B}
.jira .j-chip{display:inline-block;border:1px solid var(--j-border);border-radius:3px;padding:0 6px;margin:2px 4px 2px 0;font-size:12px;background:var(--j-sunken)}
.jira .j-markup{margin-top:12px}.jira .j-markup summary{color:var(--j-subtle);cursor:pointer;font-size:13px}
.jira .j-note{color:var(--j-subtle);font-size:12px;padding:8px 16px 12px}
`;

const initials = (name) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

function person(name, fallback) {
  if (!name)
    return `<span class="j-avatar">?</span><span class="j-empty">${fallback}</span>`;
  return `<span class="j-avatar set">${escapeHtml(
    initials(name),
  )}</span>${escapeHtml(name)}`;
}

function attachmentCard(a) {
  const thumb =
    a.kind === 'image'
      ? `<img src="${a.url}" alt="">`
      : a.kind === 'replay'
      ? icon('play', { size: 28 })
      : icon('file', { size: 28 });
  return `<a class="j-att" href="${
    a.url
  }" target="_blank" title="Open ${escapeHtml(a.name)}">
    <div class="j-thumb">${thumb}</div><span>${escapeHtml(a.name)}</span></a>`;
}

/**
 * @param {object} issue
 * @param {string} issue.id unique element id prefix
 * @param {string} issue.projectKey
 * @param {string} issue.issueType Bug | Story | Task
 * @param {string} issue.summary
 * @param {string} issue.description Jira wiki markup
 * @param {string} issue.environment Jira wiki markup
 * @param {{name:string,url:string,downloadUrl:string,kind:string}[]} issue.attachments
 * @param {{priority:string,labels:string[],assignee:string,reporter:string,sprint:string}} issue.fields
 */
export function renderJiraIssue(issue) {
  const files = new Map(issue.attachments.map((a) => [a.name, a.url]));
  const options = { attachmentUrl: (name) => files.get(name) };
  const descriptionHtml = renderWiki(issue.description, options);
  const environmentHtml = renderWiki(issue.environment, options);
  const { fields } = issue;
  const id = issue.id;
  const typeIcon = TYPE_ICONS[issue.issueType] || TYPE_ICONS.Task;

  return `<style>${STYLE}</style>
<article class="jira" id="${id}">
  <div class="j-top">
    <div class="j-crumb">${typeIcon}<b>${escapeHtml(issue.projectKey)}-NEW</b>
      <span>· ${escapeHtml(
        issue.issueType,
      )}</span><span class="j-draft">Draft</span></div>
    <div class="j-actions">
      <button type="button" data-copy-text="${id}-summary">Copy summary</button>
      <button type="button" class="j-primary" data-copy-rich="${id}-description">Copy description</button>
      <button type="button" data-copy-rich="${id}-environment">Copy environment</button>
    </div>
  </div>
  <div class="j-body">
    <div>
      <h1 class="j-title" id="${id}-summary">${escapeHtml(issue.summary)}</h1>
      <div class="j-section">⌄ Key details</div>
      <div class="j-label">Description</div>
      <div class="j-field" id="${id}-description">${
    descriptionHtml || '<span class="j-empty">Add a description…</span>'
  }</div>
      <details class="j-markup"><summary>Jira wiki markup</summary>
        <pre class="wiki-pre" id="${id}-description-markup">${escapeHtml(
    issue.description,
  )}</pre></details>
      <div class="j-label">Environment</div>
      <div class="j-field" id="${id}-environment">${
    environmentHtml || '<span class="j-empty">Add text</span>'
  }</div>
      <pre hidden id="${id}-environment-markup">${escapeHtml(
    issue.environment,
  )}</pre>
      <div class="j-label">Attachments <span class="j-chip">${
        issue.attachments.length
      }</span></div>
      ${
        issue.attachments.length
          ? `<div class="j-attachments">${issue.attachments
              .map(attachmentCard)
              .join('')}</div>
             <div class="j-actions" style="margin-top:8px">${issue.attachments
               .map(
                 (a) =>
                   `<a class="j-btn" href="${a.downloadUrl}">${icon(
                     'download',
                     { size: 14 },
                   )} ${escapeHtml(a.name)}</a>`,
               )
               .join('')}</div>`
          : '<div class="j-empty">No attachments.</div>'
      }
    </div>
    <aside>
      <div class="j-status">To Do</div>
      <div class="j-panel">
        <h4>Details</h4>
        <div class="j-row"><div>Assignee</div><div>${person(
          fields.assignee,
          'Unassigned',
        )}</div></div>
        <div class="j-row"><div>Reporter</div><div>${person(
          fields.reporter,
          'You',
        )}</div></div>
        <div class="j-row"><div>Priority</div><div style="display:flex;align-items:center;gap:6px">${
          PRIORITY_ICONS[fields.priority] || ''
        }${escapeHtml(fields.priority)}</div></div>
        <div class="j-row"><div>Labels</div><div>${
          fields.labels
            .map((l) => `<span class="j-chip">${escapeHtml(l)}</span>`)
            .join('') || '<span class="j-empty">None</span>'
        }</div></div>
        <div class="j-row"><div>Sprint</div><div>${
          fields.sprint
            ? escapeHtml(fields.sprint)
            : '<span class="j-empty">None</span>'
        }</div></div>
        <div class="j-note">Project, assignee, reporter and sprint come from the dashboard
          <a href="/settings">Settings</a>. Nothing is sent to Jira.</div>
      </div>
    </aside>
  </div>
</article>
<script>
(() => {
  const root = document.getElementById(${scriptJson(id)});
  const flash = (button, text) => {
    const original = button.textContent;
    button.textContent = text;
    setTimeout(() => (button.textContent = original), 1500);
  };
  for (const button of root.querySelectorAll('[data-copy-text]'))
    button.addEventListener('click', async () => {
      await navigator.clipboard.writeText(document.getElementById(button.dataset.copyText).textContent);
      flash(button, 'Copied');
    });
  // copies formatted text, so headings, lists and code blocks paste into Jira's editor;
  // images are left out because Jira cannot load them from this machine; attach them instead
  for (const button of root.querySelectorAll('[data-copy-rich]'))
    button.addEventListener('click', async () => {
      const source = document.getElementById(button.dataset.copyRich).cloneNode(true);
      source.querySelectorAll('img').forEach((img) => img.remove());
      const markup = document.getElementById(button.dataset.copyRich + '-markup').textContent;
      try {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([source.innerHTML], { type: 'text/html' }),
          'text/plain': new Blob([markup], { type: 'text/plain' }),
        })]);
      } catch {
        await navigator.clipboard.writeText(markup);
      }
      flash(button, 'Copied');
    });
})();
</script>`;
}
