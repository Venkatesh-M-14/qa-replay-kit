import { CATEGORIES, STATUSES } from '../feedback.js';
import { icon } from './icons.js';
import { renderJiraIssue } from './jiraIssue.js';
import {
  backLink,
  badge,
  card,
  emptyState,
  escapeHtml,
  filterBar,
  formatDate,
  formatOffset,
  page,
  pageHead,
  replayLink,
  select,
} from './layout.js';

const STATUS_TONE = {
  new: 'danger',
  reviewed: 'info',
  in_progress: 'warning',
  resolved: 'success',
};
const statusBadge = (status) =>
  badge(STATUSES[status] || status, STATUS_TONE[status]);

function stars(rating) {
  if (!rating) return '<span class="muted">—</span>';
  const filled = (on) =>
    `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style="color:${
      on ? 'var(--warning)' : 'var(--border-strong)'
    }"><polygon fill="currentColor" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  return `<span class="inline" style="gap:1px" role="img" aria-label="${rating} of 5 stars">${[
    1, 2, 3, 4, 5,
  ]
    .map((n) => filled(n <= rating))
    .join('')}</span>`;
}

export function renderFeedbackList(items, filters) {
  const rows = items
    .map(
      (f) => `<tr>
  <td>${statusBadge(f.status)}</td>
  <td><a class="cell-title" href="/feedback/${escapeHtml(f.id)}">${escapeHtml(
        f.comment ? f.comment.split('\n')[0].slice(0, 140) : 'Rating only',
      )}</a><div class="cell-sub">${escapeHtml(
        f.page || f.page_url || 'unknown page',
      )}</div></td>
  <td class="nowrap">${escapeHtml(CATEGORIES[f.category] || f.category)}</td>
  <td class="nowrap">${stars(f.rating)}</td>
  <td class="nowrap">${formatDate(f.created_at)}</td>
  <td class="right nowrap"><span class="inline" style="justify-content:flex-end">${
    f.screenshot
      ? `<span class="muted" title="Has a screenshot">${icon('image', {
          label: 'Has a screenshot',
        })}</span>`
      : ''
  }${
        f.session_id
          ? `<a class="btn btn-sm" href="${replayLink(
              f.session_id,
              f.offset_ms,
            )}" target="_blank">${icon('play', { size: 12 })}Replay</a>`
          : ''
      }</span></td></tr>`,
    )
    .join('');
  const extra = `
  <label class="field">Search<input name="q" placeholder="Comment, page or notes" value="${escapeHtml(
    filters.q || '',
  )}"></label>
  ${select(
    'status',
    'Status',
    [['', 'Any status'], ...Object.entries(STATUSES)],
    filters.status,
  )}
  ${select(
    'category',
    'Category',
    [['', 'Any category'], ...Object.entries(CATEGORIES)],
    filters.category,
  )}
  ${select(
    'rating',
    'Rating',
    [
      ['', 'Any rating'],
      ...[5, 4, 3, 2, 1].map((r) => [String(r), `${r} stars`]),
    ],
    filters.rating,
  )}`;
  const exportQuery = new URLSearchParams(
    Object.entries({
      from: filters.fromText,
      to: filters.toText,
      q: filters.q,
      status: filters.status,
      category: filters.category,
      rating: filters.rating,
    }).filter(([, v]) => v),
  ).toString();
  return page({
    title: 'Feedback',
    active: '/feedback',
    filters,
    body: `${pageHead({
      title: 'Feedback',
      description:
        'Submitted from the extension popup with “Give feedback”. Feedback given while recording links to the replay.',
      actions: `<a class="btn" href="/api/feedback.csv${
        exportQuery ? `?${exportQuery}` : ''
      }">${icon('download', { size: 14 })}Export CSV</a>`,
    })}
${filterBar(filters, extra)}
${card({
  title: 'Inbox',
  iconName: 'inbox',
  action: `<span class="count">${items.length}</span>`,
  flush: true,
  body: rows
    ? `<div class="table-wrap"><table><thead><tr><th>Status</th><th>Feedback</th><th>Category</th><th>Rating</th><th>Submitted</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : emptyState(
        'inbox',
        'No feedback matches',
        'Reset the filters, or give feedback from the extension popup.',
      ),
})}`,
  });
}

export function renderFeedbackPage({ feedback: f, session, draft, jira }) {
  const statusOptions = Object.entries(STATUSES)
    .map(
      ([value, label]) =>
        `<option value="${value}"${
          value === f.status ? ' selected' : ''
        }>${label}</option>`,
    )
    .join('');
  let replay =
    '<span class="muted">No recording was running when this was submitted.</span>';
  if (session)
    replay = `<a class="btn btn-sm" href="${replayLink(
      session.id,
      f.offset_ms,
    )}" target="_blank">${icon('play', {
      size: 12,
    })}Watch at <span class="num">${formatOffset(f.offset_ms)}</span></a>
      <a href="/sessions/${escapeHtml(session.id)}">${escapeHtml(
      session.name,
    )}</a>`;
  else if (f.recording)
    replay =
      '<span class="muted">Recorded, but the session is not saved to the log server yet. Save it from the extension to link the replay.</span>';

  const attachments = [
    ...(f.screenshot
      ? [
          {
            name: f.screenshot,
            kind: 'image',
            url: `/media/feedback/${f.screenshot}`,
            downloadUrl: `/media/feedback/${f.screenshot}?download`,
          },
        ]
      : []),
    ...(session
      ? [
          {
            name: 'replay.html',
            kind: 'replay',
            url: replayLink(session.id, f.offset_ms),
            downloadUrl: `/media/${session.id}/replay.html?download`,
          },
        ]
      : []),
  ];

  return page({
    title: 'Feedback',
    active: '/feedback',
    body: `${pageHead({
      back: backLink('/feedback', 'Feedback'),
      title: escapeHtml(CATEGORIES[f.category] || f.category),
      description: `<span class="meta"><span>${icon('clock', {
        size: 14,
      })}${formatDate(f.created_at)}</span>
        <span>${icon('globe', { size: 14 })}${escapeHtml(
        f.page_url || 'unknown page',
      )}</span></span>`,
      actions: statusBadge(f.status),
    })}
<div class="grid-2">
  ${card({
    title: 'What the tester said',
    iconName: 'feedback',
    body: `<div class="stack">
      ${
        f.comment
          ? `<div style="white-space:pre-wrap;font-size:15px">${escapeHtml(
              f.comment,
            )}</div>`
          : '<div class="muted">No comment, rating only.</div>'
      }
      <div class="inline">${stars(f.rating)}${
      f.contact ? `<span class="muted">· ${escapeHtml(f.contact)}</span>` : ''
    }</div>
      <div class="inline">${replay}</div></div>`,
  })}
  ${card({
    title: 'Triage',
    iconName: 'check',
    body: `<form id="triage" class="stack">
      <label class="field">Status<select name="status">${statusOptions}</select></label>
      <label class="field">Internal notes<textarea name="notes" rows="4">${escapeHtml(
        f.notes,
      )}</textarea></label>
      <div class="inline"><button class="btn btn-primary" type="submit">Save</button><span id="saved" class="muted" role="status"></span></div>
    </form>`,
  })}
</div>

<h2 style="font-size:15px;margin:8px 0 0">Jira ticket draft</h2>
<p class="muted" style="margin:4px 0 0">Preview of the ticket as it will look in Jira. Copy each part into Jira's Create dialog and attach the files.</p>
${renderJiraIssue({
  id: 'jira-draft',
  projectKey: jira.projectKey,
  issueType: draft.issueType,
  summary: draft.summary,
  description: draft.description,
  environment: draft.environment,
  attachments,
  fields: {
    priority: draft.priority,
    labels: draft.labels,
    assignee: jira.assignee,
    reporter: jira.reporter || f.contact,
    sprint: jira.sprint,
  },
})}
<script>
document.getElementById('triage').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const res = await fetch('/api/feedback/${encodeURIComponent(f.id)}', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: form.get('status'), notes: form.get('notes') }),
  });
  document.getElementById('saved').textContent = res.ok ? 'Saved' : 'Not saved: ' + (await res.text());
  if (res.ok) setTimeout(() => location.reload(), 600);
});
</script>`,
  });
}
