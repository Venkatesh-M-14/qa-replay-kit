import {
  EventType,
  IncrementalSource,
  MouseInteractions,
  NodeType,
  type eventWithTime,
  type NetworkData,
  type NetworkHeaders,
  type serializedNodeWithId,
} from '@rrweb/types';
import { CustomTag, type Session } from '~/types';

const CONSOLE_PLUGIN = 'rrweb/console@1';
const NETWORK_PLUGIN = 'rrweb/network@1';
// A user action is only blamed for an issue if it happened this recently before it.
const CAUSE_WINDOW_MS = 10_000;

export type Step = {
  offset: number;
  action: 'navigate' | 'click' | 'double click' | 'right click' | 'input';
  target: string;
  detail?: string;
  // consecutive loads of the same page
  repeat?: number;
};

export type ConsoleEntry = {
  offset: number;
  level: string;
  message: string;
  trace: string[];
};

export type NetworkEntry = {
  offset: number;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  type?: string;
  failed: boolean;
  isInitial: boolean;
  requestHeaders?: NetworkHeaders;
  requestBody?: string | null;
  responseHeaders?: NetworkHeaders;
  responseBody?: string | null;
};

export type Issue = {
  // first and last time this issue occurred
  offset: number;
  lastOffset: number;
  // identical issues are grouped; this is how many times it happened
  count: number;
  // 'warning' is used for framework development warnings logged as errors
  severity: 'error' | 'warning';
  source: 'console' | 'network';
  title: string;
  detail: string;
  // the last user action before the first occurrence, the most likely trigger
  cause?: Step;
};

/** One click with the position needed to draw it on a heatmap. */
export type ClickPoint = {
  offset: number;
  page: string;
  // position in the viewport, and in the page (viewport + scroll)
  x: number;
  y: number;
  pageY: number;
  // x as a fraction of the viewport width, so different widths can be compared
  xRatio: number;
  viewportWidth: number;
  viewportHeight: number;
  element: string;
};

/** How far down one visit to a page was scrolled. */
export type PageView = {
  offset: number;
  page: string;
  viewportWidth: number;
  // deepest pixel that was on screen
  maxDepth: number;
  // full scrollable height; unknown for recordings without page metrics
  pageHeight?: number;
  // the page scrolls inside a panel rather than the document
  container: boolean;
};

export type FeedbackMarker = {
  offset: number;
  feedbackId: string;
  category?: string;
};

export type SessionReport = {
  startTimestamp: number;
  duration: number;
  url?: string;
  steps: Step[];
  console: ConsoleEntry[];
  network: NetworkEntry[];
  issues: Issue[];
  clicks: ClickPoint[];
  pageViews: PageView[];
  feedback: FeedbackMarker[];
  // events that could not be read (malformed or unexpected) and were left out
  skippedEvents: number;
  skipError?: string;
};

type PageMetrics = {
  href: string;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  documentHeight: number;
  container: boolean;
};

/**
 * A page identifier without query strings (they may hold personal data).
 * Hash-based routes such as #/dashboard are kept.
 */
export function pageKey(href: string) {
  try {
    const url = new URL(href);
    const hashRoute = url.hash.startsWith('#/') ? url.hash.split('?')[0] : '';
    return `${url.pathname}${hashRoute}`;
  } catch {
    return href.split('?')[0];
  }
}

/** Follows the current page, viewport and scroll position through a recording. */
class PageState {
  href = '';
  viewportWidth = 0;
  viewportHeight = 0;
  scrollY = 0;
  documentNodeId = -1;
  current?: PageView;
  views: PageView[] = [];

  open(href: string, offset: number) {
    this.close();
    this.href = href;
    this.scrollY = 0;
    this.current = {
      offset,
      page: pageKey(href),
      viewportWidth: this.viewportWidth,
      maxDepth: this.viewportHeight,
      container: false,
    };
  }

  close() {
    if (this.current) this.views.push(this.current);
    this.current = undefined;
  }

  resize(width: number, height: number) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    if (this.current) {
      this.current.viewportWidth ||= width;
      this.reach(this.scrollY + height);
    }
  }

  scrollDocument(y: number) {
    this.scrollY = y;
    this.reach(y + this.viewportHeight);
  }

  applyMetrics(m: PageMetrics) {
    if (!this.current) return;
    this.current.pageHeight = m.documentHeight;
    this.current.container = m.container;
    this.viewportWidth = m.viewportWidth;
    if (!m.container) this.scrollY = m.scrollY;
    this.reach(m.scrollY + m.viewportHeight);
  }

  private reach(depth: number) {
    if (this.current && depth > this.current.maxDepth)
      this.current.maxDepth = depth;
  }
}

type NodeInfo = {
  tag?: string;
  attrs?: Record<string, unknown>;
  text?: string | null;
  children: number[];
};

class NodeIndex {
  private nodes = new Map<number, NodeInfo>();

  reset() {
    this.nodes.clear();
  }

  add(node: serializedNodeWithId, parentId?: number) {
    const info: NodeInfo = { children: [] };
    if (node.type === NodeType.Element) {
      info.tag = node.tagName;
      info.attrs = node.attributes;
    } else if (node.type === NodeType.Text) {
      info.text = node.textContent;
    }
    this.nodes.set(node.id, info);
    if (parentId !== undefined)
      this.nodes.get(parentId)?.children.push(node.id);
    if ('childNodes' in node)
      for (const child of node.childNodes) this.add(child, node.id);
  }

  remove(parentId: number, id: number) {
    const parent = this.nodes.get(parentId);
    if (parent) parent.children = parent.children.filter((c) => c !== id);
  }

  setText(id: number, value: string | null) {
    const node = this.nodes.get(id);
    if (node) node.text = value;
  }

  isPassword(id: number) {
    return this.nodes.get(id)?.attrs?.type === 'password';
  }

  private textOf(id: number, depth = 0): string {
    const node = this.nodes.get(id);
    if (!node || depth > 6 || node.tag === 'script' || node.tag === 'style')
      return '';
    if (node.text) return node.text;
    return node.children.map((c) => this.textOf(c, depth + 1)).join(' ');
  }

  describe(id: number): string {
    const node = this.nodes.get(id);
    if (!node) return `node #${id}`;
    if (!node.tag) return `text "${clip(node.text || '', 40)}"`;
    const attrs = node.attrs || {};
    let selector = node.tag;
    if (attrs.id) selector += `#${String(attrs.id)}`;
    else if (typeof attrs.class === 'string' && attrs.class.trim())
      selector += `.${attrs.class.trim().split(/\s+/).slice(0, 2).join('.')}`;
    const label = [
      attrs['aria-label'],
      attrs.title,
      attrs.placeholder,
      attrs.name,
      this.textOf(id).replace(/\s+/g, ' ').trim(),
      node.tag === 'input' && attrs.type !== 'password' ? attrs.value : '',
    ].find((l) => typeof l === 'string' && l.trim()) as string | undefined;
    return label ? `${selector} "${clip(label, 50)}"` : selector;
  }
}

function clip(value: unknown, max: number) {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// key/value pairs whose value must never reach a report or ticket
const SECRET_KEY = String.raw`[\w-]*(?:authorization|cookie|token|password|passwd|secret|api[-_]?key|session[-_]?id|ip[-_]?address|fingerprint)[\w-]*`;
const SECRET_PAIR = new RegExp(
  String.raw`(\\?"?${SECRET_KEY}\\?"?\s*[:=]\s*)(\\?"(?:[^"\\]|\\.)*?\\?"|[^\s,;}&]+)`,
  'gi',
);

const SECRET_HEADER = new RegExp(`^${SECRET_KEY}$`, 'i');

function redactHeaders(headers?: NetworkHeaders) {
  if (!headers) return headers;
  const result: NetworkHeaders = {};
  for (const [key, value] of Object.entries(headers))
    result[key] = SECRET_HEADER.test(key) ? '[redacted]' : redact(value);
  return result;
}

/** Removes tokens, passwords, cookies and IP addresses from captured text. */
export function redact(text: string): string {
  return text
    .replace(SECRET_PAIR, '$1"[redacted]"')
    .replace(/Bearer\s+[\w.~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt redacted]');
}

/** Turns an error-like object (e.g. an AxiosError) into one readable line. */
function summarizeObject(value: Record<string, unknown>): string {
  if (typeof value.message !== 'string')
    return clip(JSON.stringify(value), 300);
  const response = value.response as Record<string, unknown> | undefined;
  let config = value.config as Record<string, unknown> | string | undefined;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config) as Record<string, unknown>;
    } catch {
      config = undefined;
    }
  }
  const status = [value.status, response?.status].find(
    (s): s is number => typeof s === 'number',
  );
  const request =
    config && typeof config.url === 'string'
      ? `${String(config.method || 'get').toUpperCase()} ${config.url}`
      : undefined;
  const extras = [
    typeof value.code === 'string' ? value.code : undefined,
    status ? `HTTP ${String(status)}` : undefined,
    request,
  ].filter(Boolean);
  const name =
    typeof value.name === 'string' && value.name !== 'Error'
      ? `${value.name}: `
      : '';
  return `${name}${value.message}${
    extras.length ? ` (${extras.join(', ')})` : ''
  }`;
}

function summarizeConsoleArg(part: string): string {
  try {
    const value: unknown = JSON.parse(part);
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && !Array.isArray(value))
      return summarizeObject(value as Record<string, unknown>);
    return clip(part, 300);
  } catch {
    // the console plugin truncates huge objects, which leaves invalid JSON
    const message = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(part)?.[1];
    if (part.startsWith('{') && message) {
      const code = /"code"\s*:\s*"([^"]*)"/.exec(part)?.[1];
      const status = /"status"\s*:\s*(\d{3})/.exec(part)?.[1];
      const extras = [code, status && `HTTP ${status}`].filter(Boolean);
      return `${message}${extras.length ? ` (${extras.join(', ')})` : ''}`;
    }
    return clip(part, 300);
  }
}

function parseConsolePayload(payload: string[]) {
  return redact(payload.map(summarizeConsoleArg).join(' '));
}

/** Shortens a stack frame to the app's source path, e.g. src/api.ts:12:3. */
function cleanFrame(frame: string) {
  return frame
    .replace(/(?:https?|chrome-extension):\/\/[^/\s)]+\//g, '')
    .replace(/\?(?:t|v)=[\w]+/g, '');
}

const isLibraryFrame = (frame: string) =>
  /node_modules\/|content\/inject\.js|\.vite\/deps\//.test(frame);

function appFrames(trace: string[], max = 5) {
  const app = trace.filter((t) => !isLibraryFrame(t));
  return (app.length ? app : trace).slice(0, max);
}

// React and similar libraries report development-only warnings through console.error
const isDevWarning = (entry: ConsoleEntry) =>
  /^(Warning: |In HTML, |<%s>|.*validateDOMNesting|Each child in a list should have a unique)/.test(
    entry.message,
  ) ||
  (entry.message.includes('%s') &&
    entry.trace.some((t) => /react-dom|react\.development/.test(t)));

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export function pathOf(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0];
  }
}

export function describeStatus(status?: number) {
  if (!status) return 'no response (network/CORS error)';
  return `${status} ${STATUS_TEXT[status] || ''}`.trim();
}

function isFailedRequest(status: number | undefined, method?: string) {
  if (status !== undefined) return status === 0 || status >= 400;
  // fetch/XHR requests always carry a method; no status means the request
  // never got a response (network error, CORS block, aborted)
  return method !== undefined;
}

export function buildReport(events: eventWithTime[]): SessionReport {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const start = sorted[0]?.timestamp ?? 0;
  const end = sorted[sorted.length - 1]?.timestamp ?? start;
  const report: SessionReport = {
    startTimestamp: start,
    duration: end - start,
    steps: [],
    console: [],
    network: [],
    issues: [],
    clicks: [],
    pageViews: [],
    feedback: [],
    skippedEvents: 0,
  };
  const nodes = new NodeIndex();
  const page = new PageState();

  const navigate = (href: string, offset: number) => {
    page.open(href, offset);
    const last = report.steps[report.steps.length - 1];
    // a page that keeps reloading shows up once, with a count
    if (last?.action === 'navigate' && last.target === href) {
      last.repeat = (last.repeat || 1) + 1;
      return;
    }
    report.steps.push({ offset, action: 'navigate', target: href });
  };

  for (const event of sorted) {
    const offset = event.timestamp - start;
    try {
      switch (event.type) {
        case EventType.Meta:
          report.url ??= event.data.href;
          page.resize(event.data.width, event.data.height);
          navigate(event.data.href, offset);
          break;
        case EventType.FullSnapshot:
          nodes.reset();
          nodes.add(event.data.node);
          page.documentNodeId = event.data.node.id;
          page.scrollY = event.data.initialOffset?.top ?? 0;
          break;
        case EventType.Custom: {
          const payload = event.data.payload as Record<string, unknown>;
          if (event.data.tag === CustomTag.Navigation)
            navigate(String(payload.href), offset);
          else if (event.data.tag === CustomTag.PageMetrics) {
            const metrics = payload as PageMetrics;
            if (pageKey(metrics.href) !== page.current?.page)
              navigate(metrics.href, offset);
            page.applyMetrics(metrics);
          } else if (event.data.tag === CustomTag.Feedback)
            report.feedback.push({
              offset,
              feedbackId: String(payload.feedbackId),
              category:
                typeof payload.category === 'string'
                  ? payload.category
                  : undefined,
            });
          break;
        }
        case EventType.IncrementalSnapshot: {
          const data = event.data;
          if (data.source === IncrementalSource.Mutation) {
            for (const r of data.removes) nodes.remove(r.parentId, r.id);
            for (const a of data.adds) nodes.add(a.node, a.parentId);
            for (const t of data.texts) nodes.setText(t.id, t.value);
          } else if (data.source === IncrementalSource.MouseInteraction) {
            const action = {
              [MouseInteractions.Click]: 'click',
              [MouseInteractions.DblClick]: 'double click',
              [MouseInteractions.ContextMenu]: 'right click',
            }[data.type as number] as Step['action'] | undefined;
            if (action) {
              const target = nodes.describe(data.id);
              report.steps.push({ offset, action, target });
              if (
                typeof data.x === 'number' &&
                typeof data.y === 'number' &&
                page.current &&
                page.viewportWidth > 0
              )
                report.clicks.push({
                  offset,
                  page: page.current.page,
                  x: Math.round(data.x),
                  y: Math.round(data.y),
                  pageY: Math.round(data.y + page.scrollY),
                  xRatio: data.x / page.viewportWidth,
                  viewportWidth: page.viewportWidth,
                  viewportHeight: page.viewportHeight,
                  element: target,
                });
            }
          } else if (data.source === IncrementalSource.Scroll) {
            if (data.id === page.documentNodeId) page.scrollDocument(data.y);
          } else if (data.source === IncrementalSource.ViewportResize) {
            page.resize(data.width, data.height);
          } else if (data.source === IncrementalSource.Input) {
            const value = nodes.isPassword(data.id)
              ? '••••••'
              : data.isChecked !== undefined && data.text === 'on'
              ? `checked: ${String(data.isChecked)}`
              : clip(data.text, 80);
            const last = report.steps[report.steps.length - 1];
            const target = nodes.describe(data.id);
            // typing produces one event per keystroke; keep only the final value
            if (last?.action === 'input' && last.target === target) {
              last.detail = value;
              last.offset = offset;
            } else {
              report.steps.push({
                offset,
                action: 'input',
                target,
                detail: value,
              });
            }
          }
          break;
        }
        case EventType.Plugin: {
          if (event.data.plugin === CONSOLE_PLUGIN) {
            const log = event.data.payload as {
              level: string;
              trace: string[];
              payload: string[];
            };
            report.console.push({
              offset,
              level: log.level,
              message: parseConsolePayload(log.payload),
              trace: log.trace.map(cleanFrame),
            });
          } else if (event.data.plugin === NETWORK_PLUGIN) {
            const data = event.data.payload as NetworkData;
            for (const request of data.requests) {
              const isInitial = Boolean(data.isInitial || request.isInitial);
              report.network.push({
                offset: isInitial ? 0 : offset,
                method: request.method || 'GET',
                url: request.name,
                status: request.status,
                duration:
                  request.duration !== undefined
                    ? Math.round(request.duration)
                    : undefined,
                type: request.initiatorType,
                failed: isFailedRequest(request.status, request.method),
                isInitial,
                requestHeaders: redactHeaders(request.requestHeaders),
                requestBody: request.requestBody && redact(request.requestBody),
                responseHeaders: redactHeaders(request.responseHeaders),
                responseBody:
                  request.responseBody && redact(request.responseBody),
              });
            }
          }
          break;
        }
      }
    } catch (err) {
      // one unusual event must not stop the whole report; it is counted instead
      report.skippedEvents += 1;
      report.skipError ??= String((err as Error)?.message || err);
    }
  }

  page.close();
  report.pageViews = page.views;
  report.network.sort((a, b) => a.offset - b.offset);
  report.issues = collectIssues(report);
  return report;
}

function collectIssues(report: SessionReport): Issue[] {
  const userSteps = report.steps.filter((s) => s.action !== 'navigate');
  const causeOf = (offset: number) => {
    let cause: Step | undefined;
    for (const step of userSteps) {
      if (step.offset > offset) break;
      cause = step;
    }
    return cause && offset - cause.offset <= CAUSE_WINDOW_MS
      ? cause
      : undefined;
  };

  // the same error repeated (polling, retries, re-renders) becomes one issue with a count
  const groups = new Map<string, Issue>();
  const add = (key: string, issue: Omit<Issue, 'count' | 'lastOffset'>) => {
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastOffset = issue.offset;
      // early occurrences may lack a response body that later ones have
      if (issue.detail.length > existing.detail.length)
        existing.detail = issue.detail;
    } else {
      groups.set(key, { ...issue, count: 1, lastOffset: issue.offset });
    }
  };

  for (const entry of report.console) {
    if (entry.level !== 'error' && entry.level !== 'assert') continue;
    const title = clip(entry.message.split('\n')[0] || 'Console error', 140);
    add(`console|${title.replace(/\d+/g, 'n')}`, {
      offset: entry.offset,
      severity: isDevWarning(entry) ? 'warning' : 'error',
      source: 'console',
      title,
      detail: [
        clip(entry.message, 600),
        ...appFrames(entry.trace).map((t) => `    at ${t}`),
      ].join('\n'),
      cause: causeOf(entry.offset),
    });
  }
  for (const entry of report.network) {
    if (!entry.failed) continue;
    const path = pathOf(entry.url);
    add(`network|${entry.method} ${path} ${entry.status ?? 'none'}`, {
      offset: entry.offset,
      severity: 'error',
      source: 'network',
      title: `${entry.method} ${path} → ${describeStatus(entry.status)}`,
      detail: [
        `${entry.method} ${entry.url.split('?')[0]}`,
        entry.responseBody ? `Response: ${clip(entry.responseBody, 500)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      cause: entry.isInitial ? undefined : causeOf(entry.offset),
    });
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(a.severity === 'warning') - Number(b.severity === 'warning') ||
      a.offset - b.offset,
  );
}

export function formatOffset(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
}

export function describeStep(step: Step) {
  if (step.action === 'navigate')
    return step.repeat
      ? `Opened ${step.target} (page loaded ${step.repeat} times)`
      : `Opened ${step.target}`;
  if (step.action === 'input')
    return `Typed into ${step.target}: ${step.detail}`;
  return `${step.action[0].toUpperCase()}${step.action.slice(1)} ${
    step.target
  }`;
}

const escapeHtml = (text: unknown) =>
  String(text ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ] as string),
  );

function prettyBody(body?: string | null) {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function headersBlock(headers?: NetworkHeaders) {
  if (!headers || !Object.keys(headers).length) return '';
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

/**
 * A self-contained HTML bug report that can be attached to a ticket.
 */
export function renderHtmlReport(session: Session, report: SessionReport) {
  const failed = report.network.filter((n) => n.failed).length;
  const errors = report.console.filter(
    (c) => c.level === 'error' || c.level === 'assert',
  ).length;
  const errorIssues = report.issues.filter((i) => i.severity === 'error');
  const issueRows = report.issues
    .map(
      (issue) => `<details class="issue ${issue.severity}"${
        issue.severity === 'error' && errorIssues.length <= 5 ? ' open' : ''
      }>
  <summary><span class="t">${formatOffset(
    issue.offset,
  )}</span> <span class="tag ${
        issue.severity === 'warning' ? 'warning' : issue.source
      }">${
        issue.severity === 'warning' ? 'warning' : issue.source
      }</span> ${escapeHtml(issue.title)}${
        issue.count > 1 ? ` <span class="count">×${issue.count}</span>` : ''
      }</summary>
  <p><b>Likely trigger:</b> ${
    issue.cause
      ? `${escapeHtml(
          describeStep(issue.cause),
        )} <span class="muted">at ${formatOffset(issue.cause.offset)}</span>`
      : '<span class="muted">no user action in the previous 10s</span>'
  }</p>
  ${issue.detail ? `<pre>${escapeHtml(prettyBody(issue.detail))}</pre>` : ''}
</details>`,
    )
    .join('\n');
  const stepRows = report.steps
    .map(
      (s) =>
        `<tr><td class="t">${formatOffset(s.offset)}</td><td>${escapeHtml(
          describeStep(s),
        )}</td></tr>`,
    )
    .join('');
  const consoleRows = report.console
    .map(
      (c) =>
        `<tr class="lvl-${escapeHtml(c.level)}"><td class="t">${formatOffset(
          c.offset,
        )}</td><td>${escapeHtml(c.level)}</td><td><pre>${escapeHtml(
          c.message,
        )}${
          c.trace.length
            ? `\n${escapeHtml(c.trace.map((t) => `    at ${t}`).join('\n'))}`
            : ''
        }</pre></td></tr>`,
    )
    .join('');
  const networkRows = report.network
    .map(
      (n) => `<tr class="${n.failed ? 'failed' : ''}"><td class="t">${
        n.isInitial ? 'load' : formatOffset(n.offset)
      }</td><td>${escapeHtml(n.method)}</td><td>${n.status ?? '—'}</td><td>${
        n.duration !== undefined ? `${n.duration} ms` : '—'
      }</td><td>
<details><summary>${escapeHtml(n.url)}</summary>
${
  n.requestHeaders
    ? `<h4>Request headers</h4><pre>${escapeHtml(
        headersBlock(n.requestHeaders),
      )}</pre>`
    : ''
}
${
  n.requestBody
    ? `<h4>Request body</h4><pre>${escapeHtml(prettyBody(n.requestBody))}</pre>`
    : ''
}
${
  n.responseHeaders
    ? `<h4>Response headers</h4><pre>${escapeHtml(
        headersBlock(n.responseHeaders),
      )}</pre>`
    : ''
}
${
  n.responseBody
    ? `<h4>Response body</h4><pre>${escapeHtml(
        prettyBody(n.responseBody),
      )}</pre>`
    : ''
}
</details></td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bug report – ${escapeHtml(session.name)}</title>
<style>
:root{--bg:#fff;--fg:#1a202c;--muted:#718096;--line:#e2e8f0;--card:#f7fafc;--err:#c53030;--errbg:#fff5f5;--warn:#975a16;--warnbg:#fffff0;--accent:#2b6cb0}
@media (prefers-color-scheme:dark){:root{--bg:#171923;--fg:#e2e8f0;--muted:#a0aec0;--line:#2d3748;--card:#1a202c;--err:#fc8181;--errbg:#2d1b1b;--warn:#f6e05e;--warnbg:#2b2a1a;--accent:#63b3ed}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{margin:0 0 4px;font-size:22px}h2{margin:32px 0 8px;font-size:17px}h4{margin:8px 0 2px;font-size:12px;color:var(--muted)}
.muted{color:var(--muted)}.t{font-variant-numeric:tabular-nums;color:var(--muted);white-space:nowrap}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 14px}.stat b{display:block;font-size:20px}
.stat.bad b{color:var(--err)}
table{width:100%;border-collapse:collapse;table-layout:fixed}td{border-top:1px solid var(--line);padding:6px 8px;vertical-align:top;overflow-wrap:anywhere}
pre{margin:4px 0;white-space:pre-wrap;word-break:break-word;font:12px/1.45 ui-monospace,Menlo,monospace;background:var(--card);padding:6px 8px;border-radius:6px;max-height:400px;overflow:auto}
td pre{background:none;padding:0}
.issue{border:1px solid var(--line);border-left:4px solid var(--err);border-radius:6px;padding:8px 12px;margin:8px 0;background:var(--errbg)}
.issue.warning{border-left-color:var(--warn);background:var(--warnbg)}.count{font-size:12px;padding:0 6px;border-radius:9px;background:var(--line)}
.issue summary{cursor:pointer;font-weight:600;overflow-wrap:anywhere}
.tag{font-size:11px;text-transform:uppercase;padding:1px 6px;border-radius:4px;border:1px solid currentColor;font-weight:600}.tag.console{color:var(--err)}.tag.network{color:var(--accent)}.tag.warning{color:var(--warn)}
tr.failed,tr.lvl-error,tr.lvl-assert{background:var(--errbg);color:var(--err)}tr.lvl-warn{background:var(--warnbg);color:var(--warn)}
details summary{cursor:pointer}
</style></head><body><main>
<h1>${escapeHtml(session.name)}</h1>
<div class="muted">${escapeHtml(report.url || '')} · recorded ${new Date(
    report.startTimestamp,
  ).toLocaleString()} · ${formatOffset(report.duration)} long</div>
<div class="stats">
<div class="stat ${errorIssues.length ? 'bad' : ''}"><b>${
    errorIssues.length
  }</b>issues</div>
<div class="stat ${errors ? 'bad' : ''}"><b>${errors}</b>console errors</div>
<div class="stat ${failed ? 'bad' : ''}"><b>${failed}</b>failed requests</div>
<div class="stat"><b>${report.steps.length}</b>user steps</div>
<div class="stat"><b>${report.network.length}</b>requests</div>
</div>
<h2>Issues</h2>
${
  issueRows ||
  '<p class="muted">No console errors or failed requests were recorded.</p>'
}
<h2>Steps to reproduce</h2>
<table><colgroup><col style="width:70px"><col></colgroup>${stepRows}</table>
<h2>Console</h2>
${
  consoleRows
    ? `<table><colgroup><col style="width:70px"><col style="width:70px"><col></colgroup>${consoleRows}</table>`
    : '<p class="muted">No console output.</p>'
}
<h2>Network</h2>
${
  networkRows
    ? `<table><colgroup><col style="width:70px"><col style="width:70px"><col style="width:60px"><col style="width:80px"><col></colgroup>${networkRows}</table>`
    : '<p class="muted">No requests.</p>'
}
<p class="muted" style="margin-top:32px">Times are relative to the start of the recording. Authorization and cookie headers are redacted.</p>
</main></body></html>`;
}

export function downloadHtmlReport(session: Session, report: SessionReport) {
  const blob = new Blob([renderHtmlReport(session, report)], {
    type: 'text/html',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.name}-report.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
