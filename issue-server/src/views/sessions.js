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

export function renderSessionList(sessions, filters, pages) {
  const rows = sessions
    .map(
      (s) => `<tr>
  <td><a class="cell-title" href="/sessions/${escapeHtml(s.id)}">${escapeHtml(
        s.name,
      )}</a>
    <div class="cell-sub">${escapeHtml(s.url || '')}</div></td>
  <td class="nowrap">${formatDate(s.recorded_at)}</td>
  <td class="right num">${formatOffset(s.duration_ms)}</td>
  <td class="right num">${s.pages || '—'}</td>
  <td class="right">${
    s.issues_count
      ? badge(String(s.issues_count), 'danger')
      : '<span class="muted num">0</span>'
  }</td>
  <td class="right num">${
    s.feedback_count || '<span class="muted">—</span>'
  }</td>
  <td class="right"><a class="btn btn-sm" href="${replayLink(
    s.id,
  )}" target="_blank">${icon('play', { size: 12 })}Replay</a></td></tr>`,
    )
    .join('');
  const extra = `
  <label class="field">Search<input name="q" placeholder="Name or URL" value="${escapeHtml(
    filters.q || '',
  )}"></label>
  ${select(
    'page',
    'Visited page',
    [['', 'Any page'], ...pages.map((p) => [p.page, p.page])],
    filters.page,
  )}
  <label class="check"><input type="checkbox" name="errors" value="1"${
    filters.errors ? ' checked' : ''
  }> With errors only</label>`;
  return page({
    title: 'Sessions',
    active: '/sessions',
    filters,
    body: `${pageHead({
      title: 'Sessions',
      description:
        'Recordings saved from the rrweb extension. Open one for its Jira draft, issues and pages.',
    })}
${filterBar(filters, extra)}
${card({
  title: 'Recordings',
  iconName: 'sessions',
  action: `<span class="count">${sessions.length}</span>`,
  flush: true,
  body: rows
    ? `<div class="table-wrap"><table><thead><tr><th>Session</th><th>Recorded</th><th class="right">Length</th><th class="right">Pages</th><th class="right">Issues</th><th class="right">Feedback</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : emptyState(
        'sessions',
        'No sessions match',
        'Save one with “Save to log server” in the extension, or reset the filters.',
      ),
})}`,
  });
}

function issueItem(i) {
  const warning = i.severity === 'warning';
  const source = warning
    ? badge('Warning', 'warning')
    : badge(
        i.source === 'network' ? 'Network' : 'Console',
        i.source === 'network' ? 'info' : 'danger',
      );
  return `<div class="issue">
  <div class="issue-head">
    <div class="issue-title">${source}<span>${escapeHtml(i.title)}</span>${
    i.occurrences > 1 ? `<span class="count">×${i.occurrences}</span>` : ''
  }</div>
    <a class="btn btn-sm" href="${replayLink(
      i.session_id,
      i.offset_ms,
    )}" target="_blank" title="Watch the replay at this moment">${icon('play', {
    size: 12,
  })}<span class="num">${formatOffset(i.offset_ms)}</span></a>
  </div>
  <div class="issue-trigger">Likely trigger: ${
    i.trigger ? escapeHtml(i.trigger) : 'no user action in the previous 10s'
  }</div>
  ${i.detail ? `<pre>${escapeHtml(i.detail)}</pre>` : ''}
</div>`;
}

export function renderSessionPage({
  session,
  issues,
  draft,
  pages,
  feedback,
  jira,
}) {
  const media = (file) => `/media/${encodeURIComponent(session.id)}/${file}`;
  const errors = issues.filter((i) => i.severity !== 'warning');
  const warnings = issues.filter((i) => i.severity === 'warning');

  const pageItems = pages
    .map(
      (p) => `<li><div style="min-width:0"><div class="cell-title">${escapeHtml(
        p.page,
      )}</div>
      <div class="cell-sub num">${formatOffset(p.offset_ms)}</div></div>
      <div class="inline"><a class="row-link" href="${replayLink(
        session.id,
        p.offset_ms,
      )}" target="_blank">${icon('play', { size: 12 })}Replay</a>
      <a class="row-link" href="/heatmaps?page=${encodeURIComponent(
        p.page,
      )}">${icon('heatmap', { size: 14 })}Heatmap</a></div></li>`,
    )
    .join('');
  const feedbackItems = feedback
    .map(
      (f) =>
        `<li><div style="min-width:0"><a class="cell-title" href="/feedback/${escapeHtml(
          f.id,
        )}">${escapeHtml(
          f.comment
            ? f.comment.split('\n')[0].slice(0, 80)
            : `Rated ${f.rating}/5`,
        )}</a><div class="cell-sub num">${formatOffset(
          f.offset_ms,
        )}</div></div>${badge(f.category, 'plain')}</li>`,
    )
    .join('');

  return page({
    title: session.name,
    active: '/sessions',
    body: `${pageHead({
      back: backLink('/sessions', 'Sessions'),
      title: escapeHtml(session.name),
      description: `<span class="meta">
        <span>${icon('globe', { size: 14 })}${escapeHtml(
        session.url || 'unknown page',
      )}</span>
        <span>${icon('clock', { size: 14 })}${formatDate(
        session.recorded_at,
      )} · ${formatOffset(session.duration_ms)}</span>
        <span>${icon('alert', { size: 14 })}${errors.length} issue(s)${
        warnings.length ? ` · ${warnings.length} warning(s)` : ''
      }</span></span>`,
      actions: `<a class="btn btn-primary" href="${media(
        'replay.html',
      )}" target="_blank">${icon('play', { size: 14 })}Watch replay</a>
        <a class="btn" href="${media('report.html')}" target="_blank">${icon(
        'file',
        { size: 14 },
      )}Report</a>`,
    })}

<h2 style="font-size:15px;margin:8px 0 0">Jira ticket draft</h2>
<p class="muted" style="margin:4px 0 0">Preview of the ticket as it will look in Jira. Copy each part into Jira's Create dialog and attach the files.</p>
${renderJiraIssue({
  id: 'jira-draft',
  projectKey: jira.projectKey,
  issueType: draft.issueType,
  summary: draft.summary,
  description: draft.description,
  environment: draft.environment,
  attachments: [
    {
      name: 'replay.html',
      kind: 'replay',
      url: media('replay.html'),
      downloadUrl: `${media('replay.html')}?download`,
    },
    {
      name: 'report.html',
      kind: 'file',
      url: media('report.html'),
      downloadUrl: `${media('report.html')}?download`,
    },
  ],
  fields: {
    priority: draft.priority,
    labels: draft.labels.length ? draft.labels : ['rrweb', 'auto-captured'],
    assignee: jira.assignee,
    reporter: jira.reporter,
    sprint: jira.sprint,
  },
})}

<div class="grid-2">
  <div>
    ${card({
      title: 'Captured issues',
      iconName: 'alert',
      action: `<span class="count">${errors.length}</span>`,
      flush: true,
      body:
        (errors.map(issueItem).join('') ||
          emptyState(
            'check',
            'No errors captured',
            'No console errors or failed requests in this session.',
          )) +
        (warnings.length
          ? `<details class="more" style="padding:0 16px 14px"><summary>${
              warnings.length
            } development warning(s), not in the ticket</summary>${warnings
              .map(issueItem)
              .join('')}</details>`
          : ''),
    })}
  </div>
  <div>
    ${card({
      title: 'Pages visited',
      iconName: 'globe',
      flush: true,
      body: pageItems
        ? `<ul class="list">${pageItems}</ul>`
        : emptyState(
            'globe',
            'No page data',
            'Recorded with an older extension version.',
          ),
    })}
    ${
      feedbackItems
        ? card({
            title: 'Feedback in this session',
            iconName: 'feedback',
            flush: true,
            body: `<ul class="list">${feedbackItems}</ul>`,
          })
        : ''
    }
    ${card({
      title: 'Files',
      iconName: 'file',
      flush: true,
      body: `<ul class="list">
        <li><span>replay.html <span class="muted">· safe to share</span></span><a class="row-link" href="${media(
          'replay.html',
        )}?download">${icon('download', { size: 14 })}Download</a></li>
        <li><span>report.html</span><a class="row-link" href="${media(
          'report.html',
        )}?download">${icon('download', { size: 14 })}Download</a></li>
        <li><span>recording.json.gz <span class="muted">· raw, keep local</span></span><a class="row-link" href="${media(
          'recording.json.gz',
        )}">${icon('download', { size: 14 })}Download</a></li>
      </ul>`,
    })}
    <details class="more">
      <summary>Create the ticket through the Jira REST API (optional)</summary>
      <p class="muted">Request body for <code>POST /rest/api/2/issue</code>. The sample script
      <a href="${media(
        'create-jira-issue.sh',
      )}?download">create-jira-issue.sh</a> sends it and uploads the files once you add your Jira URL and API token.</p>
      <pre>${escapeHtml(JSON.stringify(draft.payload, null, 2))}</pre>
    </details>
    <p><button class="btn btn-danger" id="delete" type="button">${icon(
      'trash',
      { size: 14 },
    )}Delete session</button></p>
  </div>
</div>
<script>
document.getElementById('delete').addEventListener('click', async () => {
  if (!confirm('Delete this session, its issues, clicks and files? This cannot be undone.')) return;
  const res = await fetch('/api/sessions/${encodeURIComponent(
    session.id,
  )}', { method: 'DELETE' });
  if (res.ok) location.href = '/sessions';
  else alert('Delete failed: ' + (await res.text()));
});
</script>`,
  });
}
