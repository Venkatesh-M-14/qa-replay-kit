/**
 * Turns captured data into plain language for Jira tickets:
 * page names instead of URLs, button labels instead of CSS selectors, and the
 * server's own error message instead of the raw endpoint.
 */

// path segments that carry an id (RP00000353, uuids, numbers) are not page names
const ID_SEGMENT = /^[0-9a-f-]{8,}$|^(?=[^/]*\d)[\w-]{4,}$|^\d+$/i;
// framework/tenant segments that do not help a reader
const NOISE_SEGMENTS = new Set([
  'tenant',
  'app',
  'apps',
  'en',
  'v1',
  'v2',
  'api',
]);
const MAX_STEPS = 8;

const humanize = (segment) => {
  const text = decodeURIComponent(segment)
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** "https://x/tenant/policies/approval/RP00000353" → "Policies › Approval" */
export function pageName(url) {
  let path;
  try {
    const parsed = new URL(url);
    path = parsed.hash.startsWith('#/')
      ? parsed.hash.slice(1).split('?')[0]
      : parsed.pathname;
  } catch {
    path = String(url || '').split('?')[0];
  }
  const parts = path
    .split('/')
    .filter(Boolean)
    .filter((p) => !ID_SEGMENT.test(p) && !NOISE_SEGMENTS.has(p.toLowerCase()));
  if (!parts.length) return 'Home page';
  return parts.slice(-2).map(humanize).join(' › ');
}

/** `button#buy.btn "Place order"` → { tag: 'button', selector, label: 'Place order' } */
function parseTarget(target) {
  const match = /^([a-z][\w-]*)([^\s"]*)(?:\s+"(.*)")?$/i.exec(
    String(target || ''),
  );
  if (!match) return { tag: '', selector: String(target || ''), label: '' };
  return {
    tag: match[1].toLowerCase(),
    selector: match[2],
    label: (match[3] || '').trim(),
  };
}

const quote = (text) =>
  `“${text.length > 60 ? `${text.slice(0, 59)}…` : text}”`;

/** One recorded step as a tester would write it, or null when it is noise. */
export function friendlyStep(step) {
  if (step.action === 'navigate')
    return `Open ${pageName(step.target)} (${
      String(step.target).split('?')[0]
    })`;

  const { tag, selector, label } = parseTarget(step.target);

  if (step.action === 'input') {
    // unresolved elements, empty values and dropdown controls (page size etc.) add nothing
    if (!tag || String(step.target).startsWith('node #')) return null;
    if (!step.detail || !String(step.detail).trim()) return null;
    if (tag === 'select' || /select/i.test(selector)) return null;
    if (/checked: /.test(step.detail))
      return label ? `Tick ${quote(label)}` : null;
    if (tag === 'textarea')
      return label ? `Enter text in ${quote(label)}` : 'Enter a comment';
    return label ? `Fill in ${quote(label)}` : null;
  }

  // clicks: keep only clicks on something with a readable label
  if (!label || /^[\d\s.,%]+$/.test(label)) return null;
  if (/^[x×✕✖]$/i.test(label)) return 'Close the dialog';
  if (/tab/i.test(selector)) return `Open the ${quote(label)} tab`;
  if (tag === 'a') return `Click the ${quote(label)} link`;
  if (tag === 'td' || tag === 'tr') return `Select the row ${quote(label)}`;
  if (step.action === 'double click') return `Double-click ${quote(label)}`;
  return `Click ${quote(label)}`;
}

/**
 * The few steps that lead to the first error: from the last page opened before
 * it, up to the action that triggered it. Noise (unlabelled clicks, typing into
 * search boxes, paging) is left out.
 */
export function reproSteps(steps, firstError) {
  const until = firstError ? firstError.offset : Infinity;
  const before = steps.filter((s) => s.offset <= until);
  let start = 0;
  for (let i = before.length - 1; i >= 0; i--)
    if (before[i].action === 'navigate') {
      start = i;
      break;
    }
  const lines = [];
  for (const step of before.slice(start)) {
    const line = friendlyStep(step);
    if (line && line !== lines[lines.length - 1]) lines.push(line);
  }
  if (firstError && !firstError.cause)
    lines.push('Wait for the page to finish loading');
  if (lines.length <= MAX_STEPS) return lines;
  // keep the page that was opened and the actions closest to the error
  return [lines[0], ...lines.slice(-(MAX_STEPS - 1))];
}

/** The message the server sent back, if the response has one. */
export function responseMessage(detail) {
  const line = String(detail || '')
    .split('\n')
    .find((l) => l.startsWith('Response: '));
  if (!line) return '';
  const body = line.slice('Response: '.length).trim();
  try {
    const json = JSON.parse(body);
    for (const key of [
      'message',
      'error',
      'title',
      'detail',
      'errorMessage',
      'error_description',
    ])
      if (typeof json?.[key] === 'string' && json[key].trim())
        return json[key].trim();
    return '';
  } catch {
    // plain-text responses are used when they are short enough to be a message
    return body.length <= 120 && !body.startsWith('<') ? body : '';
  }
}

/** What went wrong, in one short phrase. */
export function problemText(issue) {
  if (issue.source === 'network') {
    const status = String(issue.title).split('→ ')[1] || 'request failed';
    const message = responseMessage(issue.detail);
    return message ? `${message.replace(/\.$/, '')} (${status})` : status;
  }
  return String(issue.title)
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\b\w*Error:\s*/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

/** The button or link the user pressed just before the error, if known. */
function triggerLabel(issue) {
  if (!issue?.cause || issue.cause.action === 'navigate') return '';
  const { label } = parseTarget(issue.cause.target);
  return label && !/^[\d\s.,%]+$/.test(label) ? label : '';
}

/** The page the user was on when the error happened. */
export function pageAt(steps, offset, fallbackUrl) {
  let url = fallbackUrl;
  for (const step of steps) {
    if (step.offset > offset) break;
    if (step.action === 'navigate') url = step.target;
  }
  return url ? pageName(url) : 'the app';
}

const clip = (text, max) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** e.g. “Confirm” fails on Policies › Approval: Maker cannot process the request (400 Bad Request) */
export function friendlyTitle(report, errors, fallback) {
  const first = errors[0];
  if (!first) return fallback;
  const page = pageAt(report.steps, first.offset, report.url);
  const label = triggerLabel(first);
  const problem = problemText(first);
  const subject = label
    ? `${quote(label)} fails on ${page}`
    : `Error on ${page}`;
  return clip(`${subject}: ${problem}`, 120);
}

/** Two or three plain sentences for the top of the description. */
export function friendlySummary(report, errors) {
  const first = errors[0];
  if (!first) return 'No errors were captured. Describe the problem here.';
  const page = pageAt(report.steps, first.offset, report.url);
  const label = triggerLabel(first);
  const what =
    first.source === 'network'
      ? (() => {
          const status = String(first.title).split('→ ')[1] || 'an error';
          const message = responseMessage(first.detail);
          return `the server returned ${status}${
            message ? `: “${message.replace(/\.$/, '')}”` : ''
          }`;
        })()
      : `the app logged an error: “${problemText(first)}”`;
  const sentences = [
    label
      ? `On ${page}, clicking ${quote(label)} does not work; ${what}.`
      : `On ${page}, ${what}.`,
  ];
  if (first.count > 1)
    sentences.push(`It happened ${first.count} times in this session.`);
  const others = errors.length - 1;
  if (others > 0)
    sentences.push(
      `${others} other error${
        others > 1 ? 's were' : ' was'
      } also recorded (see Actual result).`,
    );
  return sentences.join(' ');
}
