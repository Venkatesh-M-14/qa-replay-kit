import { CATEGORIES, STATUSES } from '../feedback.js';
import { icon } from './icons.js';
import {
  badge,
  card,
  emptyState,
  escapeHtml,
  filterBar,
  formatDate,
  formatOffset,
  page,
  pageHead,
} from './layout.js';

// "—" means there is no data to calculate from, which is different from a real 0
function kpi({ label, value, note = '', iconName, tone = '' }) {
  const empty = value === '—';
  return `<div class="kpi">
  <div class="kpi-top">${label}<span class="kpi-icon ${tone}">${icon(
    iconName,
  )}</span></div>
  <div class="kpi-value${empty ? ' empty' : ''}">${value}</div>
  ${note ? `<div class="kpi-note">${note}</div>` : ''}
</div>`;
}

const STATUS_TONE = {
  new: 'danger',
  reviewed: 'info',
  in_progress: 'warning',
  resolved: 'success',
};

export function renderOverview({
  stats,
  issueGroups,
  heatmapPages,
  recentFeedback,
  filters,
}) {
  const { sessions, clicks, errors, scroll, feedback } = stats;
  const averageScroll =
    scroll.views > 0 && scroll.average !== null
      ? `${Math.round(scroll.average * 100)}%`
      : '—';
  const averageRating =
    feedback.rated > 0 ? feedback.average_rating.toFixed(1) : '—';

  const errorRows = issueGroups
    .slice(0, 10)
    .map(
      (g) => `<tr>
  <td>${badge(
    g.source === 'network' ? 'Network' : 'Console',
    g.source === 'network' ? 'info' : 'danger',
  )}</td>
  <td><div class="cell-title">${escapeHtml(
    g.title,
  )}</div><div class="cell-sub">Last seen ${formatDate(g.last_seen)}</div></td>
  <td class="right num">${g.occurrences}</td>
  <td class="right num">${g.sessions}</td>
  <td class="right"><a class="row-link" href="/sessions/${escapeHtml(
    g.latest_session,
  )}">Open ${icon('chevron', { size: 14 })}</a></td></tr>`,
    )
    .join('');

  const topClicks = heatmapPages[0]?.clicks || 1;
  const pageItems = heatmapPages
    .slice(0, 6)
    .map(
      (p) => `<li><div style="flex:1;min-width:0">
    <a class="cell-title" href="/heatmaps?page=${encodeURIComponent(
      p.page,
    )}">${escapeHtml(p.page)}</a>
    <div class="bar"><span style="width:${Math.max(
      4,
      Math.round((p.clicks / topClicks) * 100),
    )}%"></span></div></div>
    <span class="num muted">${p.clicks}</span></li>`,
    )
    .join('');

  const feedbackItems = recentFeedback
    .slice(0, 5)
    .map(
      (f) => `<li><div style="min-width:0">
    <a class="cell-title" href="/feedback/${escapeHtml(f.id)}">${escapeHtml(
        f.comment
          ? f.comment.split('\n')[0].slice(0, 90)
          : `Rated ${f.rating}/5`,
      )}</a>
    <div class="cell-sub">${escapeHtml(
      CATEGORIES[f.category] || f.category,
    )} · ${formatDate(f.created_at)}</div></div>
    ${badge(STATUSES[f.status] || f.status, STATUS_TONE[f.status])}</li>`,
    )
    .join('');

  return page({
    title: 'Overview',
    active: '/',
    filters,
    body: `${pageHead({
      title: 'Overview',
      description:
        'Everything recorded with the rrweb extension on this machine. A dash means there is no data yet, not zero.',
    })}
${filterBar(filters)}
<div class="kpis">
  ${kpi({
    label: 'Sessions',
    value: sessions.total,
    note: `${formatOffset(sessions.duration)} recorded`,
    iconName: 'sessions',
    tone: 'info',
  })}
  ${kpi({
    label: 'With errors',
    value: sessions.with_errors,
    note: sessions.total
      ? `${Math.round(
          (sessions.with_errors / sessions.total) * 100,
        )}% of sessions`
      : '',
    iconName: 'bug',
    tone: sessions.with_errors ? 'danger' : '',
  })}
  ${kpi({
    label: 'Errors',
    value: errors.total,
    note: 'repeats counted',
    iconName: 'alert',
    tone: errors.total ? 'danger' : '',
  })}
  ${kpi({ label: 'Clicks', value: clicks.total, iconName: 'click' })}
  ${kpi({
    label: 'Scroll depth',
    value: averageScroll,
    note: scroll.views
      ? `${scroll.views} measured visits`
      : 'needs new recordings',
    iconName: 'scroll',
  })}
  ${kpi({
    label: 'Feedback',
    value: feedback.total,
    note: `${feedback.unread} new`,
    iconName: 'feedback',
    tone: feedback.unread ? 'warning' : '',
  })}
  ${kpi({
    label: 'Avg rating',
    value: averageRating,
    note: feedback.rated
      ? `out of 5 · ${feedback.rated} rated`
      : 'no ratings yet',
    iconName: 'star',
    tone: 'warning',
  })}
</div>
<div class="grid-2">
  ${card({
    title: 'Recurring errors',
    iconName: 'alert',
    action: `<span class="count">${issueGroups.length}</span>`,
    flush: true,
    body: errorRows
      ? `<div class="table-wrap"><table><thead><tr><th>Source</th><th>Error</th><th class="right">Seen</th><th class="right">Sessions</th><th></th></tr></thead><tbody>${errorRows}</tbody></table></div>`
      : emptyState(
          'check',
          'No errors captured',
          'Errors from saved sessions appear here.',
        ),
  })}
  <div>
    ${card({
      title: 'Most clicked pages',
      iconName: 'heatmap',
      action: '<a class="row-link" href="/heatmaps">All</a>',
      flush: true,
      body: pageItems
        ? `<ul class="list">${pageItems}</ul>`
        : emptyState('click', 'No clicks yet', 'Record a session and save it.'),
    })}
    ${card({
      title: 'Recent feedback',
      iconName: 'feedback',
      action: '<a class="row-link" href="/feedback">Inbox</a>',
      flush: true,
      body: feedbackItems
        ? `<ul class="list">${feedbackItems}</ul>`
        : emptyState(
            'inbox',
            'No feedback yet',
            'Use “Give feedback” in the extension popup.',
          ),
    })}
  </div>
</div>`,
  });
}
