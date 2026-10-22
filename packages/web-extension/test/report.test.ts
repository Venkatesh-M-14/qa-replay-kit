import { describe, expect, it } from 'vitest';
import {
  EventType,
  IncrementalSource,
  MouseInteractions,
  NodeType,
  type eventWithTime,
} from '@rrweb/types';
import { buildReport, pageKey, redact } from '~/utils/report';
import { eventsForReplay } from '~/utils/timeline';
import { CustomTag } from '~/types';

const T0 = 1_700_000_000_000;
const ev = (t: number, event: Record<string, unknown>) =>
  ({ ...event, timestamp: T0 + t }) as unknown as eventWithTime;

const meta = (t: number, href: string) =>
  ev(t, { type: EventType.Meta, data: { href, width: 1280, height: 800 } });

const snapshot = (t: number) =>
  ev(t, {
    type: EventType.FullSnapshot,
    data: {
      initialOffset: { top: 0, left: 0 },
      node: {
        type: NodeType.Document,
        id: 1,
        childNodes: [
          {
            type: NodeType.Element,
            id: 2,
            tagName: 'body',
            attributes: {},
            childNodes: [
              {
                type: NodeType.Element,
                id: 3,
                tagName: 'button',
                attributes: { id: 'buy' },
                childNodes: [
                  { type: NodeType.Text, id: 4, textContent: 'Buy shares' },
                ],
              },
              {
                type: NodeType.Element,
                id: 5,
                tagName: 'input',
                attributes: { type: 'password', name: 'pw' },
                childNodes: [],
              },
            ],
          },
        ],
      },
    },
  });

const click = (t: number, id: number, x: number, y: number) =>
  ev(t, {
    type: EventType.IncrementalSnapshot,
    data: {
      source: IncrementalSource.MouseInteraction,
      type: MouseInteractions.Click,
      id,
      x,
      y,
    },
  });

const custom = (t: number, tag: string, payload: unknown) =>
  ev(t, { type: EventType.Custom, data: { tag, payload } });

const metrics = (t: number, href: string, scrollY: number) =>
  custom(t, CustomTag.PageMetrics, {
    href,
    scrollY,
    viewportWidth: 1280,
    viewportHeight: 800,
    documentHeight: 2400,
    container: false,
  });

const consoleLog = (
  t: number,
  level: string,
  args: unknown[],
  trace: string[] = [],
) =>
  ev(t, {
    type: EventType.Plugin,
    data: {
      plugin: 'rrweb/console@1',
      payload: { level, trace, payload: args.map((a) => JSON.stringify(a)) },
    },
  });

const request = (t: number, req: Record<string, unknown>) =>
  ev(t, {
    type: EventType.Plugin,
    data: { plugin: 'rrweb/network@1', payload: { requests: [req] } },
  });

const URL_ = 'https://app.test/dashboard?token=abc';

describe('redact', () => {
  it('removes credentials, JWTs and IP addresses', () => {
    const text = redact(
      '{"Authorization":"Bearer abc.def","X-Fingerprint":"{\\"ipAddress\\":\\"10.1.2.3\\"}","password":"hunter2"} ' +
        'token eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl',
    );
    expect(text).not.toMatch(/abc\.def|10\.1\.2\.3|hunter2|eyJhbGciOi/);
    expect(text).toContain('[redacted]');
  });

  it('leaves ordinary messages alone', () => {
    expect(redact('Invalid or expired token')).toBe('Invalid or expired token');
  });
});

describe('pageKey', () => {
  it('drops query strings but keeps hash routes', () => {
    expect(pageKey('https://a.test/orders?id=5')).toBe('/orders');
    expect(pageKey('https://a.test/#/settings?tab=2')).toBe('/#/settings');
  });
});

describe('buildReport', () => {
  it('summarises error objects and groups repeated errors', () => {
    const axiosError = {
      name: 'AxiosError',
      message: 'Unauthorized',
      code: 'ERR_BAD_REQUEST',
      status: 401,
      config: {
        url: '/profile',
        method: 'get',
        headers: { Authorization: 'Bearer secret' },
      },
    };
    const report = buildReport([
      meta(0, URL_),
      snapshot(1),
      consoleLog(10, 'error', ['Auth failed', axiosError], [
        'handleError (https://app.test/src/api.ts?t=123:12:3)',
        'node_modules/axios/lib/core.js:1:1',
      ]),
      request(20, { name: 'https://api.test/profile?x=1', method: 'GET', status: 401 }),
      request(30, {
        name: 'https://api.test/profile?x=2',
        method: 'GET',
        status: 401,
        responseBody: 'Invalid or expired token',
      }),
    ]);
    const consoleIssue = report.issues.find((i) => i.source === 'console');
    expect(consoleIssue?.title).toBe(
      'Auth failed AxiosError: Unauthorized (ERR_BAD_REQUEST, HTTP 401, GET /profile)',
    );
    expect(consoleIssue?.detail).toContain('at handleError (src/api.ts:12:3)');
    expect(consoleIssue?.detail).not.toContain('node_modules');
    expect(JSON.stringify(report)).not.toContain('Bearer secret');

    const network = report.issues.filter((i) => i.source === 'network');
    expect(network).toHaveLength(1);
    expect(network[0].count).toBe(2);
    expect(network[0].title).toBe('GET /profile → 401 Unauthorized');
    // the later occurrence had the response body; the group keeps it
    expect(network[0].detail).toContain('Invalid or expired token');
  });

  it('marks React development warnings as warnings, not errors', () => {
    const report = buildReport([
      meta(0, URL_),
      consoleLog(5, 'error', ['In HTML, %s cannot be a descendant of <%s>.']),
    ]);
    expect(report.issues[0].severity).toBe('warning');
  });

  it('flags failed requests without a response', () => {
    const report = buildReport([
      meta(0, URL_),
      request(5, { name: 'https://api.test/x', method: 'POST' }),
    ]);
    expect(report.issues[0].title).toBe(
      'POST /x → no response (network/CORS error)',
    );
  });

  it('records clicks with their position in the scrolled page', () => {
    const report = buildReport([
      meta(0, URL_),
      snapshot(1),
      metrics(100, URL_, 600),
      click(110, 3, 640, 200),
    ]);
    expect(report.clicks).toEqual([
      expect.objectContaining({
        page: '/dashboard',
        x: 640,
        y: 200,
        pageY: 800,
        xRatio: 0.5,
        element: 'button#buy "Buy shares"',
      }),
    ]);
  });

  it('tracks scroll depth and route changes as page views', () => {
    const report = buildReport([
      meta(0, URL_),
      snapshot(1),
      metrics(100, URL_, 0),
      metrics(200, URL_, 1200),
      custom(300, CustomTag.Navigation, { href: 'https://app.test/settings' }),
      metrics(400, 'https://app.test/settings', 0),
    ]);
    expect(report.pageViews.map((v) => [v.page, v.maxDepth, v.pageHeight])).toEqual([
      ['/dashboard', 2000, 2400],
      ['/settings', 800, 2400],
    ]);
    expect(report.steps.map((s) => s.action)).toEqual(['navigate', 'navigate']);
  });

  it('collapses reloads of the same page into one step', () => {
    const report = buildReport([meta(0, URL_), meta(100, URL_), meta(200, URL_)]);
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0].repeat).toBe(3);
  });

  it('never shows typed passwords', () => {
    const report = buildReport([
      meta(0, URL_),
      snapshot(1),
      ev(10, {
        type: EventType.IncrementalSnapshot,
        data: { source: IncrementalSource.Input, id: 5, text: 'hunter2', isChecked: false },
      }),
    ]);
    expect(JSON.stringify(report.steps)).not.toContain('hunter2');
  });

  it('collects feedback markers for linking feedback to the replay', () => {
    const report = buildReport([
      meta(0, URL_),
      custom(1500, CustomTag.Feedback, { feedbackId: 'fb1', category: 'bug' }),
    ]);
    expect(report.feedback).toEqual([
      { offset: 1500, feedbackId: 'fb1', category: 'bug' },
    ]);
  });
});

describe('robustness', () => {
  it('skips events it cannot read instead of failing the whole report', () => {
    const report = buildReport([
      meta(0, URL_),
      snapshot(1),
      // a custom navigation event without a payload
      ev(5, { type: EventType.Custom, data: { tag: CustomTag.Navigation } }),
      click(10, 3, 100, 100),
    ]);
    expect(report.skippedEvents).toBe(1);
    expect(report.skipError).toBeTruthy();
    expect(report.clicks).toHaveLength(1);
  });
});

describe('eventsForReplay', () => {
  it('hides page metrics and adds a marker per error', () => {
    const events = [
      meta(0, URL_),
      metrics(100, URL_, 0),
      request(200, { name: 'https://api.test/x', method: 'GET', status: 500 }),
    ];
    const replay = eventsForReplay(events, buildReport(events));
    expect(
      replay.some(
        (e) => e.type === EventType.Custom && e.data.tag === CustomTag.PageMetrics,
      ),
    ).toBe(false);
    expect(replay.filter((e) => e.type === EventType.Annotation)).toHaveLength(1);
  });
});
