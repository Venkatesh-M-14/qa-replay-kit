import { gunzipSync, gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fingerprint, insertSession } from './db.js';
import { buildJiraDraft, describeStep } from './jira.js';
import { pageKey } from './pages.js';
import { renderReplay } from './views/replay.js';

export const validId = (id) =>
  typeof id === 'string' && /^[\w-]{1,64}$/.test(id);

// framework development warnings that are logged through console.error
const DEV_WARNING =
  /^(Warning: |In HTML, |<%s>|.*validateDOMNesting|Each child in a list should have a unique)/;

// rrweb event types (from @rrweb/types)
const CUSTOM_EVENT = 5;
const PLUGIN_EVENT = 6;

/**
 * Events safe to show in a replay: console and network capture is dropped
 * (it may hold sensitive data) and so are page metrics (internal bookkeeping).
 */
export function replayableEvents(events) {
  return events.filter(
    (e) =>
      e.type !== PLUGIN_EVENT &&
      !(e.type === CUSTOM_EVENT && e.data?.tag === 'page-metrics'),
  );
}

export function readRecording(mediaDir, id) {
  const file = path.join(mediaDir, id, 'recording.json.gz');
  if (!existsSync(file)) return null;
  return JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
}

export function saveSession(
  db,
  { mediaDir, baseUrl, player },
  { session, events, report, reportHtml, userAgent },
) {
  if (!validId(session?.id) || !Array.isArray(events) || !report)
    throw Object.assign(
      new Error('Expected { session, events, report, reportHtml }'),
      { status: 400 },
    );

  const now = Date.now();
  // reports from older extension builds have no grouping or heatmap fields
  const issues = report.issues.map((issue) => ({
    count: 1,
    ...issue,
    severity:
      issue.severity ?? (DEV_WARNING.test(issue.title) ? 'warning' : 'error'),
  }));
  report = {
    clicks: [],
    pageViews: [],
    feedback: [],
    ...report,
    issues,
  };
  const errors = issues.filter((i) => i.severity === 'error');
  const dir = path.join(mediaDir, session.id);
  mkdirSync(dir, { recursive: true });
  const links = { session: `${baseUrl}/sessions/${session.id}` };

  writeFileSync(
    path.join(dir, 'recording.json.gz'),
    gzipSync(JSON.stringify({ session, events })),
  );
  writeFileSync(path.join(dir, 'report.html'), reportHtml || '');
  // kept so the Jira draft can be rebuilt with the latest wording when opened
  writeFileSync(
    path.join(dir, 'report.json'),
    JSON.stringify({ session, report, userAgent }),
  );
  writeFileSync(
    path.join(dir, 'replay.html'),
    renderReplay(session, replayableEvents(events), report, player),
  );

  const draft = buildJiraDraft({ session, report, userAgent, links });
  writeFileSync(path.join(dir, 'jira-description.txt'), draft.description);
  writeFileSync(
    path.join(dir, 'jira-issue.json'),
    JSON.stringify(draft.payload, null, 2),
  );
  writeFileSync(path.join(dir, 'create-jira-issue.sh'), draft.script, {
    mode: 0o755,
  });

  const recordedAt = report.startTimestamp;
  insertSession(
    db,
    {
      id: session.id,
      name: session.name,
      url: report.url ?? null,
      user_agent: userAgent ?? null,
      recorded_at: recordedAt,
      duration_ms: report.duration,
      steps_count: report.steps.length,
      console_errors: errors.filter((i) => i.source === 'console').length,
      failed_requests: errors.filter((i) => i.source === 'network').length,
      issues_count: errors.length,
      created_at: now,
    },
    {
      issues: issues.map((issue) => ({
        session_id: session.id,
        offset_ms: issue.offset,
        source: issue.source,
        title: issue.title,
        detail: issue.detail || null,
        trigger: issue.cause ? describeStep(issue.cause) : null,
        fingerprint: fingerprint(issue.source, issue.title),
        created_at: now,
        occurrences: issue.count,
        severity: issue.severity,
      })),
      clicks: report.clicks.map((c) => ({
        session_id: session.id,
        // re-derived on the server so a page always has one consistent key
        page: pageKey(`http://x${c.page}`),
        offset_ms: c.offset,
        x: c.x,
        y: c.y,
        page_y: c.pageY,
        x_ratio: Math.min(1, Math.max(0, c.xRatio)),
        viewport_w: c.viewportWidth,
        viewport_h: c.viewportHeight,
        element: String(c.element).slice(0, 300),
        recorded_at: recordedAt,
      })),
      pageViews: report.pageViews.map((v) => ({
        session_id: session.id,
        page: pageKey(`http://x${v.page}`),
        offset_ms: v.offset,
        viewport_w: v.viewportWidth,
        max_depth: Math.round(v.maxDepth),
        page_height: v.pageHeight ? Math.round(v.pageHeight) : null,
        container: v.container ? 1 : 0,
        recorded_at: recordedAt,
      })),
      feedback: report.feedback.map((f) => ({
        id: f.feedbackId,
        session_id: session.id,
        offset_ms: f.offset,
      })),
    },
  );
  return {
    id: session.id,
    url: links.session,
    issues: errors.length,
    clicks: report.clicks.length,
    feedbackLinked: report.feedback.length,
  };
}

/** The stored Jira draft, with the project key from the dashboard settings. */
export function readDraft(mediaDir, id, jira = {}, baseUrl = '') {
  const dir = path.join(mediaDir, id);
  const saved = path.join(dir, 'report.json');
  if (existsSync(saved)) {
    const { session, report, userAgent } = JSON.parse(
      readFileSync(saved, 'utf8'),
    );
    const draft = buildJiraDraft({
      session,
      report,
      userAgent,
      links: { session: `${baseUrl}/sessions/${id}` },
    });
    if (jira.projectKey)
      draft.payload.fields.project = { key: jira.projectKey };
    return {
      summary: draft.summary,
      priority: draft.priority,
      labels: draft.payload.fields.labels,
      issueType: 'Bug',
      description: draft.description,
      environment: draft.environment,
      payload: draft.payload,
    };
  }
  // sessions saved before report.json existed: use the draft stored at save time
  const payload = JSON.parse(
    readFileSync(path.join(dir, 'jira-issue.json'), 'utf8'),
  );
  let description = readFileSync(
    path.join(dir, 'jira-description.txt'),
    'utf8',
  );
  let environment = payload.fields.environment;
  // drafts saved before Environment became its own field had it in the description
  if (environment === undefined) {
    const at = description.indexOf('h3. Environment');
    environment =
      at === -1
        ? ''
        : description
            .slice(at)
            .replace(/^h3\. Environment\n/, '')
            .trim();
    description = at === -1 ? description : description.slice(0, at).trimEnd();
  }
  if (jira.projectKey) payload.fields.project = { key: jira.projectKey };
  payload.fields.description = description;
  payload.fields.environment = environment;
  return {
    summary: payload.fields.summary,
    priority: payload.fields.priority?.name,
    labels: payload.fields.labels || [],
    issueType: payload.fields.issuetype?.name || 'Bug',
    description,
    environment,
    payload,
  };
}
