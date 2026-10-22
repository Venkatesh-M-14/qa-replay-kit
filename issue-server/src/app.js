import { readFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deleteSession,
  getFeedback,
  getJiraSettings,
  saveJiraSettings,
  getSession,
  getSessionIssues,
  getSessionPages,
  listFeedback,
  listHeatmapPages,
  listIssueGroups,
  listSessions,
  openDb,
  overviewStats,
  sessionsRecordedBefore,
  updateFeedback,
} from './db.js';
import { saveFeedback, STATUSES, CATEGORIES } from './feedback.js';
import { buildHeatmap } from './heatmap.js';
import { buildFeedbackJiraDraft } from './jira.js';
import {
  readDraft,
  readRecording,
  replayableEvents,
  saveSession,
  validId,
} from './sessions.js';
import { renderFeedbackList, renderFeedbackPage } from './views/feedback.js';
import { renderHeatmapIndex, renderHeatmapPage } from './views/heatmaps.js';
import { renderOverview } from './views/overview.js';
import { renderSessionList, renderSessionPage } from './views/sessions.js';
import { renderSettings } from './views/settings.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES = path.join(here, '..', '..', 'packages');
const MAX_BODY_BYTES = 300 * 1024 * 1024;
const HTML = 'text/html; charset=utf-8';

const MEDIA_FILES = {
  'report.html': HTML,
  'replay.html': HTML,
  'recording.json.gz': 'application/gzip',
  'jira-description.txt': 'text/plain; charset=utf-8',
  'jira-issue.json': 'application/json; charset=utf-8',
  'create-jira-issue.sh': 'text/plain; charset=utf-8',
};
const SCREENSHOT_TYPES = { jpg: 'image/jpeg', png: 'image/png' };

function loadAsset(...parts) {
  const file = path.join(PACKAGES, ...parts);
  if (!existsSync(file))
    throw new Error(`${file} is missing. Build the rrweb packages first.`);
  return readFileSync(file, 'utf8');
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(
  res,
  status,
  body,
  type = 'application/json; charset=utf-8',
  extra = {},
) {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    ...extra,
  });
  res.end(
    type.startsWith('application/json') && typeof body !== 'string'
      ? JSON.stringify(body)
      : body,
  );
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Payload too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body is not valid JSON');
  }
}

/** Shared filters from the query string; dates are whole local days. */
export function parseFilters(searchParams) {
  const get = (key) => searchParams.get(key) || '';
  const day = (text, addDays = 0) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
    const date = new Date(`${text}T00:00:00`);
    date.setDate(date.getDate() + addDays);
    return date.getTime();
  };
  const from = day(get('from'));
  const to = day(get('to'), 1);
  return {
    fromText: from === undefined ? '' : get('from'),
    toText: to === undefined ? '' : get('to'),
    from,
    to,
    q: get('q').slice(0, 200),
    page: get('page').slice(0, 500),
    device: ['desktop', 'tablet', 'mobile'].includes(get('device'))
      ? get('device')
      : '',
    errors: get('errors') === '1',
    status: STATUSES[get('status')] ? get('status') : '',
    category: CATEGORIES[get('category')] ? get('category') : '',
    rating: /^[1-5]$/.test(get('rating')) ? get('rating') : '',
  };
}

// a cell starting with = + - @ would run as a formula when opened in a spreadsheet
const csvCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export function createApp({ dataDir, baseUrl }) {
  const db = openDb(dataDir);
  const mediaDir = path.join(dataDir, 'media');
  const feedbackDir = path.join(dataDir, 'feedback');
  const player = {
    js: loadAsset('rrweb-player', 'dist', 'rrweb-player.umd.min.cjs'),
    css: loadAsset('rrweb-player', 'dist', 'style.min.css'),
  };
  const vendor = {
    'rrweb.js': [
      'application/javascript; charset=utf-8',
      loadAsset('rrweb', 'dist', 'rrweb.umd.min.cjs'),
    ],
    'rrweb.css': [
      'text/css; charset=utf-8',
      loadAsset('rrweb', 'dist', 'style.min.css'),
    ],
  };

  const removeSession = (id) => {
    deleteSession(db, id);
    rmSync(path.join(mediaDir, id), { recursive: true, force: true });
  };

  const feedbackContext = (feedback) => {
    const session = feedback.session_id
      ? getSession(db, feedback.session_id)
      : null;
    const issues = session ? getSessionIssues(db, session.id) : [];
    const draft = buildFeedbackJiraDraft({
      feedback,
      session,
      issues,
      links: { feedback: `${baseUrl}/feedback/${feedback.id}` },
    });
    return { feedback, session, draft, jira: getJiraSettings(db) };
  };

  async function handleApi(req, res, url, parts) {
    const filters = parseFilters(url.searchParams);
    const route = `${req.method} /${parts.slice(1).join('/')}`;

    if (route === 'POST /sessions')
      return send(
        res,
        201,
        saveSession(db, { mediaDir, baseUrl, player }, await readJson(req)),
      );
    if (route === 'GET /sessions')
      return send(res, 200, listSessions(db, filters));
    if (route === 'GET /issues')
      return send(res, 200, listIssueGroups(db, filters));
    if (route === 'GET /overview')
      return send(res, 200, overviewStats(db, filters));
    if (route === 'GET /settings/jira')
      return send(res, 200, getJiraSettings(db));
    if (route === 'PUT /settings/jira') {
      const values = await readJson(req);
      if (
        values.projectKey !== undefined &&
        !/^[A-Z][A-Z0-9_]{0,19}$/.test(values.projectKey)
      )
        throw new HttpError(
          400,
          'Project key must be capital letters and digits, e.g. SHARESV',
        );
      for (const key of ['assignee', 'reporter', 'sprint'])
        if (
          values[key] !== undefined &&
          (typeof values[key] !== 'string' || values[key].length > 100)
        )
          throw new HttpError(
            400,
            `${key} must be text of at most 100 characters`,
          );
      saveJiraSettings(db, values);
      return send(res, 200, getJiraSettings(db));
    }
    if (route === 'GET /heatmaps') {
      if (!filters.page) return send(res, 200, listHeatmapPages(db, filters));
      return send(res, 200, buildHeatmap(db, filters));
    }
    if (route === 'POST /retention') {
      const { days } = await readJson(req);
      if (!Number.isInteger(days) || days < 1)
        throw new HttpError(400, 'days must be a whole number of at least 1');
      const ids = sessionsRecordedBefore(db, Date.now() - days * 86_400_000);
      ids.forEach(removeSession);
      return send(res, 200, { deleted: ids.length });
    }

    if (route === 'POST /feedback') {
      const { feedback, created } = saveFeedback(
        db,
        feedbackDir,
        await readJson(req),
      );
      return send(res, created ? 201 : 200, {
        id: feedback.id,
        created,
        url: `${baseUrl}/feedback/${feedback.id}`,
      });
    }
    if (route === 'GET /feedback')
      return send(res, 200, listFeedback(db, filters));
    if (route === 'GET /feedback.csv') {
      const columns = [
        'id',
        'created_at',
        'status',
        'category',
        'rating',
        'comment',
        'contact',
        'page_url',
        'session_id',
        'offset_ms',
        'notes',
      ];
      const rows = listFeedback(db, filters).map((f) =>
        columns
          .map((c) =>
            csvCell(c === 'created_at' ? new Date(f[c]).toISOString() : f[c]),
          )
          .join(','),
      );
      return send(
        res,
        200,
        [columns.join(','), ...rows].join('\n'),
        'text/csv; charset=utf-8',
        {
          'Content-Disposition': 'attachment; filename="feedback.csv"',
        },
      );
    }

    const id = parts[2];
    if (parts[1] === 'feedback' && validId(id)) {
      const feedback = getFeedback(db, id);
      if (!feedback) throw new HttpError(404, 'Feedback not found');
      if (req.method === 'GET') return send(res, 200, feedback);
      if (req.method === 'PATCH') {
        const { status, notes } = await readJson(req);
        if (status !== undefined && !STATUSES[status])
          throw new HttpError(
            400,
            `status must be one of: ${Object.keys(STATUSES).join(', ')}`,
          );
        if (
          notes !== undefined &&
          (typeof notes !== 'string' || notes.length > 5000)
        )
          throw new HttpError(
            400,
            'notes must be text of at most 5000 characters',
          );
        updateFeedback(db, id, { status, notes });
        return send(res, 200, getFeedback(db, id));
      }
    }

    if (parts[1] === 'sessions' && validId(id)) {
      const session = getSession(db, id);
      if (!session) throw new HttpError(404, 'Session not found');
      if (req.method === 'GET' && parts[3] === 'jira')
        return send(
          res,
          200,
          readDraft(mediaDir, id, getJiraSettings(db), baseUrl),
        );
      if (req.method === 'GET' && parts[3] === 'events') {
        const recording = readRecording(mediaDir, id);
        if (!recording) throw new HttpError(404, 'Recording file is missing');
        return send(res, 200, replayableEvents(recording.events));
      }
      if (req.method === 'GET' && !parts[3])
        return send(res, 200, { ...session, issues: getSessionIssues(db, id) });
      if (req.method === 'DELETE' && !parts[3]) {
        removeSession(id);
        return send(res, 200, { deleted: id });
      }
    }
    throw new HttpError(404, 'Not found');
  }

  function handlePage(res, url, parts) {
    const filters = parseFilters(url.searchParams);
    const html = (body) => send(res, 200, body, HTML);

    if (url.pathname === '/')
      return html(
        renderOverview({
          stats: overviewStats(db, filters),
          issueGroups: listIssueGroups(db, filters),
          heatmapPages: listHeatmapPages(db, filters),
          recentFeedback: listFeedback(db, filters),
          filters,
        }),
      );
    if (url.pathname === '/sessions')
      return html(
        renderSessionList(
          listSessions(db, filters),
          filters,
          listHeatmapPages(db),
        ),
      );
    if (parts[0] === 'sessions' && validId(parts[1])) {
      const session = getSession(db, parts[1]);
      if (!session) throw new HttpError(404, 'Session not found');
      return html(
        renderSessionPage({
          session,
          issues: getSessionIssues(db, session.id),
          draft: readDraft(mediaDir, session.id, getJiraSettings(db), baseUrl),
          jira: getJiraSettings(db),
          pages: getSessionPages(db, session.id),
          feedback: listFeedback(db).filter((f) => f.session_id === session.id),
        }),
      );
    }
    if (url.pathname === '/heatmaps')
      return html(
        filters.page
          ? renderHeatmapPage(buildHeatmap(db, filters), filters)
          : renderHeatmapIndex(listHeatmapPages(db, filters), filters),
      );
    if (url.pathname === '/feedback')
      return html(renderFeedbackList(listFeedback(db, filters), filters));
    if (parts[0] === 'feedback' && validId(parts[1])) {
      const feedback = getFeedback(db, parts[1]);
      if (!feedback) throw new HttpError(404, 'Feedback not found');
      return html(renderFeedbackPage(feedbackContext(feedback)));
    }
    if (url.pathname === '/settings')
      return html(
        renderSettings({
          dataDir,
          jira: getJiraSettings(db),
          counts: {
            sessions: listSessions(db).length,
            feedback: listFeedback(db).length,
          },
        }),
      );

    if (parts[0] === 'vendor' && vendor[parts[1]]) {
      const [type, body] = vendor[parts[1]];
      return send(res, 200, body, type, { 'Cache-Control': 'max-age=3600' });
    }
    if (parts[0] === 'media' && parts[1] === 'feedback') {
      const match = /^([\w-]+)\.(jpg|png)$/.exec(parts[2] || '');
      const file = match && path.join(feedbackDir, parts[2]);
      if (!file || !existsSync(file)) throw new HttpError(404, 'Not found');
      return send(
        res,
        200,
        readFileSync(file),
        SCREENSHOT_TYPES[match[2]],
        url.searchParams.has('download')
          ? { 'Content-Disposition': `attachment; filename="${parts[2]}"` }
          : {},
      );
    }
    // the REST payload is served with the current project key from Settings
    if (
      parts[0] === 'media' &&
      validId(parts[1]) &&
      parts[2] === 'jira-issue.json'
    ) {
      if (!getSession(db, parts[1])) throw new HttpError(404, 'Not found');
      const { payload } = readDraft(
        mediaDir,
        parts[1],
        getJiraSettings(db),
        baseUrl,
      );
      return send(
        res,
        200,
        JSON.stringify(payload, null, 2),
        MEDIA_FILES['jira-issue.json'],
        {
          'Content-Disposition': 'attachment; filename="jira-issue.json"',
        },
      );
    }
    if (parts[0] === 'media' && validId(parts[1]) && MEDIA_FILES[parts[2]]) {
      const file = path.join(mediaDir, parts[1], parts[2]);
      if (!existsSync(file)) throw new HttpError(404, 'Not found');
      const download =
        url.searchParams.has('download') || parts[2].endsWith('.gz');
      return send(
        res,
        200,
        readFileSync(file),
        MEDIA_FILES[parts[2]],
        download
          ? { 'Content-Disposition': `attachment; filename="${parts[2]}"` }
          : {},
      );
    }
    throw new HttpError(404, 'Not found');
  }

  async function handle(req, res) {
    const url = new URL(req.url, baseUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    if (req.method === 'OPTIONS')
      return send(res, 204, '', 'text/plain', {
        'Access-Control-Allow-Methods':
          'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
    if (parts[0] === 'api') return handleApi(req, res, url, parts);
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
    return handlePage(res, url, parts);
  }

  return {
    db,
    handler(req, res) {
      handle(req, res).catch((err) => {
        const status = err.status || 500;
        // unexpected errors are logged; validation errors go back to the caller
        if (status >= 500) console.error(err);
        if (!res.headersSent)
          req.url.startsWith('/api/')
            ? send(res, status, { error: err.message })
            : send(res, status, err.message, 'text/plain; charset=utf-8');
      });
    },
  };
}
