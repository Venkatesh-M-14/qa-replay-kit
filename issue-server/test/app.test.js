import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { scrollDistribution } from '../src/heatmap.js';

let server;
let base;
let dataDir;

const JPEG = `data:image/jpeg;base64,${Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 1, 2, 3,
]).toString('base64')}`;
const T0 = Date.UTC(2026, 9, 1, 10);

async function call(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  return {
    status: res.status,
    body: type.includes('json') ? await res.json() : await res.text(),
  };
}

/** A saved session as the extension sends it, with only the fields the server reads. */
function sessionPayload(
  id,
  { clicks = [], feedback = [], recordedAt = T0 } = {},
) {
  return {
    session: { id, name: `Session ${id}`, tags: [] },
    events: [
      {
        type: 4,
        data: { href: 'https://app.test/', width: 1280, height: 800 },
        timestamp: recordedAt,
      },
      {
        type: 2,
        data: { node: { type: 0, id: 1, childNodes: [] } },
        timestamp: recordedAt + 1,
      },
      {
        type: 6,
        data: {
          plugin: 'rrweb/network@1',
          payload: { requests: [{ name: 'secret-endpoint' }] },
        },
        timestamp: recordedAt + 2,
      },
      {
        type: 5,
        data: { tag: 'page-metrics', payload: {} },
        timestamp: recordedAt + 3,
      },
    ],
    report: {
      startTimestamp: recordedAt,
      duration: 5000,
      url: 'https://app.test/',
      steps: [{ offset: 0, action: 'navigate', target: 'https://app.test/' }],
      console: [],
      network: [],
      issues: [
        {
          offset: 100,
          lastOffset: 900,
          count: 3,
          severity: 'error',
          source: 'network',
          title: 'GET /profile → 401 Unauthorized',
          detail: 'Response: expired',
        },
        {
          offset: 200,
          lastOffset: 200,
          count: 1,
          severity: 'warning',
          source: 'console',
          title: 'In HTML, %s cannot be…',
          detail: '',
        },
      ],
      clicks,
      pageViews: [
        {
          offset: 0,
          page: '/',
          viewportWidth: 1280,
          maxDepth: 1200,
          pageHeight: 2400,
          container: false,
        },
      ],
      feedback,
    },
    reportHtml: '<html></html>',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0 Safari/537.36',
  };
}

const click = (offset, pageY = 200) => ({
  offset,
  page: '/',
  x: 640,
  y: 200,
  pageY,
  xRatio: 0.5,
  viewportWidth: 1280,
  viewportHeight: 800,
  element: 'button#buy "Buy"',
});

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'issue-server-test-'));
  server = http.createServer(
    createApp({ dataDir, baseUrl: 'http://localhost' }).handler,
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test('feedback: validation rejects bad input with clear messages', async () => {
  const cases = [
    [{ id: 'a', category: 'spam', comment: 'x' }, /Category must be one of/],
    [{ id: 'a', category: 'bug', comment: '   ' }, /Add a rating or a comment/],
    [{ id: 'a', category: 'bug', rating: 7 }, /Rating must be/],
    [{ id: '../x', category: 'bug', comment: 'x' }, /invalid feedback id/],
    [
      {
        id: 'a',
        category: 'bug',
        comment: 'x',
        screenshot: 'data:image/png;base64,bm90IGFuIGltYWdl',
      },
      /does not match/,
    ],
    [
      {
        id: 'a',
        category: 'bug',
        comment: 'x',
        screenshot: 'data:text/html;base64,PGh0bWw+',
      },
      /JPEG or PNG/,
    ],
  ];
  for (const [body, message] of cases) {
    const res = await call('POST', '/api/feedback', body);
    assert.equal(res.status, 400);
    assert.match(res.body.error, message);
  }
});

test('feedback: saved once, retries return the same record', async () => {
  const body = {
    id: 'fb-1',
    category: 'bug',
    rating: 2,
    comment: '=HYPERLINK("evil")',
    pageUrl: 'https://app.test/orders?token=SECRET#/x',
    screenshot: JPEG,
    recording: true,
  };
  const first = await call('POST', '/api/feedback', body);
  assert.equal(first.status, 201);
  const retry = await call('POST', '/api/feedback', {
    ...body,
    comment: 'changed',
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.created, false);
  const stored = await call('GET', '/api/feedback/fb-1');
  assert.equal(stored.body.comment, '=HYPERLINK("evil")');
  // the query (with the token) is dropped; the hash route is kept
  assert.equal(stored.body.page_url, 'https://app.test/orders#/x');
  assert.ok(existsSync(path.join(dataDir, 'feedback', 'fb-1.jpg')));
});

test('sessions: saving links feedback, stores clicks, and re-saving does not duplicate', async () => {
  const payload = sessionPayload('s-1', {
    clicks: [click(1000), click(2000, 1500)],
    feedback: [{ offset: 1500, feedbackId: 'fb-1', category: 'bug' }],
  });
  assert.equal((await call('POST', '/api/sessions', payload)).status, 201);
  assert.equal((await call('POST', '/api/sessions', payload)).status, 201);

  const feedback = await call('GET', '/api/feedback/fb-1');
  assert.equal(feedback.body.session_id, 's-1');
  assert.equal(feedback.body.offset_ms, 1500);

  const heatmap = await call('GET', '/api/heatmaps?page=%2F');
  assert.equal(heatmap.body.clicks.length, 2);
  assert.equal(heatmap.body.elements[0].clicks, 2);
  assert.equal(heatmap.body.enoughData, false);

  const session = await call('GET', '/api/sessions/s-1');
  assert.equal(session.body.issues.length, 2);
  assert.equal(session.body.issues_count, 1, 'warnings do not count as issues');
});

test('sessions: replay data leaves out console/network capture and page metrics', async () => {
  const events = await call('GET', '/api/sessions/s-1/events');
  assert.deepEqual(
    events.body.map((e) => e.type),
    [4, 2],
  );
  const replay = await call('GET', '/media/s-1/replay.html');
  assert.ok(!replay.body.includes('secret-endpoint'));
});

test('heatmaps: date and device filters', async () => {
  await call(
    'POST',
    '/api/sessions',
    sessionPayload('s-old', {
      clicks: [click(500)],
      recordedAt: Date.UTC(2025, 0, 5, 10),
    }),
  );
  const all = await call('GET', '/api/heatmaps?page=%2F');
  assert.equal(all.body.clicks.length, 3);
  const recent = await call('GET', '/api/heatmaps?page=%2F&from=2026-01-01');
  assert.equal(recent.body.clicks.length, 2);
  const mobile = await call('GET', '/api/heatmaps?page=%2F&device=mobile');
  assert.equal(mobile.body.clicks.length, 0);
});

test('heatmaps: scroll distribution ignores visits without a known height', () => {
  const result = scrollDistribution([
    { max_depth: 2400, page_height: 2400 },
    { max_depth: 1200, page_height: 2400 },
    { max_depth: 800, page_height: null },
  ]);
  assert.equal(result.measured, 2);
  assert.equal(result.steps.find((s) => s.depth === 50).share, 1);
  assert.equal(result.steps.find((s) => s.depth === 100).share, 0.5);
  assert.equal(
    scrollDistribution([]).steps[0].share,
    null,
    'no data is not zero',
  );
});

test('feedback: triage updates and CSV export is safe for spreadsheets', async () => {
  const bad = await call('PATCH', '/api/feedback/fb-1', { status: 'done' });
  assert.equal(bad.status, 400);
  const ok = await call('PATCH', '/api/feedback/fb-1', {
    status: 'in_progress',
    notes: 'Looking',
  });
  assert.equal(ok.body.status, 'in_progress');
  const csv = await call('GET', '/api/feedback.csv?status=in_progress');
  assert.match(csv.body, /"'=HYPERLINK\(""evil""\)"/);
});

test('pages render, including empty and unknown states', async () => {
  for (const url of [
    '/',
    '/sessions',
    '/sessions/s-1',
    '/heatmaps',
    '/heatmaps?page=%2F',
    '/heatmaps?page=%2Fnone',
    '/feedback',
    '/feedback/fb-1',
    '/settings',
  ]) {
    const res = await call('GET', url);
    assert.equal(res.status, 200, url);
  }
  assert.equal((await call('GET', '/sessions/missing')).status, 404);
  assert.equal(
    (await call('GET', '/media/feedback/..%2Fissues.db')).status,
    404,
  );
});

test('retention deletes old sessions and keeps feedback without its link', async () => {
  const res = await call('POST', '/api/retention', { days: 100 });
  assert.equal(res.body.deleted, 1);
  assert.equal((await call('GET', '/api/sessions/s-old')).status, 404);
  assert.ok(!existsSync(path.join(dataDir, 'media', 's-old')));
  await call('DELETE', '/api/sessions/s-1');
  const feedback = await call('GET', '/api/feedback/fb-1');
  assert.equal(feedback.body.session_id, null);
});

test('jira: wiki rendering escapes captured text', async () => {
  const { renderWiki } = await import('../src/wiki.js');
  const html = renderWiki(
    'h3. Actual result\n# *<img src=x onerror=alert(1)>* at 00:01\n{noformat}<script>alert(1)</script>{noformat}',
  );
  assert.ok(!html.includes('<img'), 'no tags from captured text');
  assert.ok(!html.includes('<script'), 'no scripts from captured text');
  assert.match(html, /<h3 class="wiki-h">Actual result<\/h3>/);
  assert.match(html, /<strong>&lt;img src=x onerror=alert\(1\)&gt;<\/strong>/);
});

test('jira: settings are validated and used in the payload', async () => {
  await call('POST', '/api/sessions', sessionPayload('s-jira'));
  const bad = await call('PUT', '/api/settings/jira', { projectKey: 'shares vision' });
  assert.equal(bad.status, 400);
  const ok = await call('PUT', '/api/settings/jira', { projectKey: 'SHARESV', sprint: 'SHARESV Sprint 26' });
  assert.equal(ok.body.projectKey, 'SHARESV');
  const payload = (await call('GET', '/media/s-jira/jira-issue.json')).body;
  assert.equal(payload.fields.project.key, 'SHARESV');
  assert.match(payload.fields.environment, /Session log/);
  assert.doesNotMatch(payload.fields.description, /h3\. Environment/);
  const page = await call('GET', '/sessions/s-jira');
  assert.match(page.body, /SHARESV-NEW/);
  assert.match(page.body, /SHARESV Sprint 26/);
});

test('wording: page names, steps and titles are plain language', async () => {
  const { pageName, reproSteps, friendlyTitle, responseMessage } = await import('../src/wording.js');
  assert.equal(pageName('https://x.test/tenant/policies/approval/RP00000353?token=1'), 'Policies › Approval');
  assert.equal(pageName('https://x.test/#/award-management/manage-award'), 'Award management › Manage award');
  assert.equal(pageName('https://x.test/'), 'Home page');

  const confirm = { offset: 30, action: 'click', target: 'button.MuiButton-root "Confirm"' };
  const steps = [
    { offset: 0, action: 'navigate', target: 'https://x.test/dashboard' },
    { offset: 5, action: 'click', target: 'div.MuiBox-root "674"' },
    { offset: 10, action: 'navigate', target: 'https://x.test/policies/approval/RP1234' },
    { offset: 15, action: 'input', target: 'node #-1', detail: '' },
    { offset: 20, action: 'click', target: 'button.MuiButton-root "Approve"' },
    { offset: 25, action: 'input', target: 'textarea.MuiInputBase-input', detail: 'x' },
    confirm,
    { offset: 40, action: 'click', target: 'button.MuiButton-root "X"' },
  ];
  // starts at the page where it failed, skips noise, stops at the trigger
  assert.deepEqual(reproSteps(steps, { offset: 31, cause: confirm }), [
    'Open Policies › Approval (https://x.test/policies/approval/RP1234)',
    'Click “Approve”',
    'Enter a comment',
    'Click “Confirm”',
  ]);

  assert.equal(responseMessage('Response: {"code":"E1","message":"Not allowed."}'), 'Not allowed.');
  const title = friendlyTitle({ steps, url: steps[0].target }, [
    { offset: 31, cause: confirm, source: 'network', title: 'POST /a → 400 Bad Request', detail: 'Response: {"message":"Not allowed."}' },
  ]);
  assert.equal(title, '“Confirm” fails on Policies › Approval: Not allowed (400 Bad Request)');
});
