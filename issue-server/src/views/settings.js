import { icon } from './icons.js';
import { card, escapeHtml, page, pageHead } from './layout.js';

const field = (
  name,
  label,
  value,
  placeholder,
  help,
) => `<label class="field">${label}
  <input name="${name}" value="${escapeHtml(value)}" placeholder="${escapeHtml(
  placeholder,
)}">
  <span class="muted" style="font-weight:400">${help}</span></label>`;

export function renderSettings({ dataDir, counts, jira }) {
  return page({
    title: 'Settings',
    active: '/settings',
    body: `${pageHead({
      title: 'Settings',
      description:
        'Jira fields for the ticket preview, stored data and clean-up. Recording options live in the extension.',
    })}
<div class="grid-2">
  <div>
    ${card({
      title: 'Jira',
      iconName: 'layers',
      body: `<form id="jira" class="stack" style="max-width:460px">
        ${field(
          'projectKey',
          'Project key',
          jira.projectKey,
          'SHARESV',
          'Shown in the preview as SHARESV-NEW and used in the REST payload.',
        )}
        ${field(
          'assignee',
          'Assignee',
          jira.assignee,
          'Unassigned',
          'Name shown in the preview’s Details panel.',
        )}
        ${field(
          'reporter',
          'Reporter',
          jira.reporter,
          'Your name',
          'Feedback uses the tester’s contact when this is empty.',
        )}
        ${field(
          'sprint',
          'Sprint',
          jira.sprint,
          'SHARESV Sprint 26',
          'Optional.',
        )}
        <div class="inline"><button class="btn btn-primary" type="submit">Save Jira settings</button><span id="jira-result" class="muted" role="status"></span></div>
      </form>`,
    })}
    ${card({
      title: 'Retention',
      iconName: 'trash',
      body: `<form id="retention" class="stack" style="max-width:460px">
        <label class="field">Delete sessions recorded more than this many days ago
          <input type="number" name="days" min="1" value="30" style="max-width:120px"></label>
        <span class="muted">Removes their issues, clicks, page visits and files. Feedback is kept but loses its replay link.</span>
        <div class="inline"><button class="btn btn-danger" type="submit">${icon(
          'trash',
          { size: 14 },
        )}Delete old sessions</button><span id="result" class="muted" role="status"></span></div>
      </form>`,
    })}
  </div>
  <div>
    ${card({
      title: 'Stored data',
      iconName: 'database',
      flush: true,
      body: `<ul class="list">
        <li><span>Sessions</span><span class="num">${
          counts.sessions
        }</span></li>
        <li><span>Feedback</span><span class="num">${
          counts.feedback
        }</span></li>
        <li style="display:block"><div class="muted" style="font-size:12px">Location</div><code style="overflow-wrap:anywhere">${escapeHtml(
          dataDir,
        )}</code></li>
      </ul>`,
    })}
    ${card({
      title: 'Recording options',
      iconName: 'settings',
      body: `<p style="margin:0" class="muted">Masking, blocked elements, console and network capture, and the log server address are set in the extension: rrweb icon, then the gear icon. They apply from the next recording.</p>`,
    })}
  </div>
</div>
<script>
document.getElementById('jira').addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  values.projectKey = values.projectKey.trim().toUpperCase();
  const res = await fetch('/api/settings/jira', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
  });
  const body = await res.json();
  document.getElementById('jira-result').textContent = res.ok ? 'Saved' : body.error;
});
document.getElementById('retention').addEventListener('submit', async (event) => {
  event.preventDefault();
  const days = Number(new FormData(event.target).get('days'));
  if (!confirm('Delete all sessions older than ' + days + ' days? This cannot be undone.')) return;
  const res = await fetch('/api/retention', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days }),
  });
  const body = await res.json();
  document.getElementById('result').textContent = res.ok ? 'Deleted ' + body.deleted + ' session(s).' : body.error;
});
</script>`,
  });
}
