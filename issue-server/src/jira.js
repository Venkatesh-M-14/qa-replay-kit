import { friendlySummary, friendlyTitle, reproSteps } from './wording.js';

/**
 * Builds a simple Jira bug draft from a stored session. Nothing is sent to
 * Jira: the output is a template to paste into the "Create issue" dialog, or
 * to post with the sample script once real credentials are filled in.
 */

// media attached to the ticket; the raw recording stays on the log server
export const ATTACHMENTS = [
  {
    file: 'replay.html',
    description: 'replay of the session, opens in any browser',
  },
  { file: 'report.html', description: 'full console and network log' },
];

const MAX_ISSUES_IN_TICKET = 8;

const BROWSERS = [
  [/Edg\/(\d+)/, 'Edge'],
  [/Firefox\/(\d+)/, 'Firefox'],
  [/Chrome\/(\d+)/, 'Chrome'],
  [/Version\/(\d+)/, 'Safari'],
];
const SYSTEMS = [
  [/iPhone|iPad/, 'iOS'],
  [/Mac OS X/, 'macOS'],
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/Linux/, 'Linux'],
];

const formatOffset = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
};

// characters that would break Jira wiki markup links, macros and tables
const escapeWiki = (text) => String(text ?? '').replace(/([[\]{}|])/g, '\\$1');

const clip = (text, max) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const oneLine = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const times = (issue) => (issue.count > 1 ? ` (×${issue.count})` : '');

export function describeStep(step) {
  if (step.action === 'navigate')
    return step.repeat
      ? `Open ${step.target} (page loaded ${step.repeat} times)`
      : `Open ${step.target}`;
  if (step.action === 'input')
    return `Type into ${step.target}: ${step.detail}`;
  return `${step.action[0].toUpperCase()}${step.action.slice(1)} ${
    step.target
  }`;
}

function describeBrowser(userAgent) {
  if (!userAgent) return undefined;
  let browser = 'Unknown browser';
  for (const [pattern, name] of BROWSERS) {
    const match = pattern.exec(userAgent);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }
  const os = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  return os ? `${browser} on ${os}` : browser;
}

function pageOf(url) {
  try {
    const { host, pathname } = new URL(url);
    return pathname === '/' ? host : `${host}${pathname}`;
  } catch {
    return url;
  }
}

/** The response text or app stack frames that explain an issue, kept short. */
function evidence(issue) {
  const lines = String(issue.detail || '').split('\n');
  if (issue.source === 'network') {
    const response = lines.find((l) => l.startsWith('Response: '));
    return response ? clip(oneLine(response), 300) : '';
  }
  return lines
    .filter((l) => l.trim().startsWith('at '))
    .slice(0, 2)
    .map((l) => l.trim())
    .join('\n');
}

function pickPriority(errors) {
  const serverError = errors.some((i) => /→ (5\d\d|no response)/.test(i.title));
  const crash = errors.some((i) => /uncaught|unhandled/i.test(i.title));
  if (serverError || crash) return 'High';
  return errors.length ? 'Medium' : 'Low';
}

function buildTitle(session, report, errors) {
  // the issue type is shown by Jira itself, so the title carries no [Bug] prefix
  return friendlyTitle(report, errors, session.name);
}

function buildDescription({ report, errors, warnings, userAgent, links }) {
  const lines = [];
  const push = (...l) => lines.push(...l);

  push('h3. Summary');
  push(escapeWiki(friendlySummary(report, errors)), '');

  push('h3. Steps to reproduce');
  const steps = reproSteps(report.steps, errors[0]);
  if (steps.length) steps.forEach((step) => push(`# ${escapeWiki(step)}`));
  else push('_No user actions were recorded._');
  push('');

  push('h3. Expected result');
  push('_Describe what should have happened._', '');

  push('h3. Actual result');
  if (!errors.length) push('_Describe what happened instead._');
  errors.slice(0, MAX_ISSUES_IN_TICKET).forEach((issue) => {
    push(
      `# *${escapeWiki(oneLine(issue.title))}*${times(issue)} at ${formatOffset(
        issue.offset,
      )}`,
    );
    const proof = evidence(issue);
    if (proof) push(`{noformat}${proof}{noformat}`);
  });
  if (errors.length > MAX_ISSUES_IN_TICKET)
    push(`_…and ${errors.length - MAX_ISSUES_IN_TICKET} more in report.html._`);
  push('');

  push('h3. Media');
  for (const a of ATTACHMENTS) push(`* [^${a.file}] — ${a.description}`);
  push('');

  if (warnings.length)
    push(
      '',
      `_Not included above: ${warnings.length} development warning(s), listed in report.html._`,
    );
  return lines.join('\n');
}

/** Jira's separate Environment field. */
function buildEnvironment({
  url,
  userAgent,
  viewport,
  time,
  timeLabel,
  link,
  linkLabel,
}) {
  const lines = [];
  if (url) lines.push(`* *URL:* ${url}`);
  const browser = describeBrowser(userAgent);
  if (browser) lines.push(`* *Browser:* ${browser}`);
  if (viewport) lines.push(`* *Window size:* ${viewport}`);
  lines.push(
    `* *${timeLabel}:* ${new Date(time)
      .toISOString()
      .slice(0, 16)
      .replace('T', ' ')} UTC`,
  );
  lines.push(`* *${linkLabel}:* [${link}]`);
  return lines.join('\n');
}

export function buildJiraDraft({ session, report, userAgent, links }) {
  const issues = report.issues.map((i) => ({
    count: 1,
    severity: 'error',
    ...i,
  }));
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const summary = buildTitle(session, report, errors);
  const description = buildDescription({
    report,
    errors,
    warnings,
    userAgent,
    links,
  });
  const environment = buildEnvironment({
    url: report.url,
    userAgent,
    time: report.startTimestamp,
    timeLabel: 'Recorded',
    link: links.session,
    linkLabel: 'Session log',
  });
  const priority = pickPriority(errors);
  // Jira REST API v2 accepts wiki markup in `description` and `environment`;
  // the project key is filled in from the dashboard settings when read
  const payload = {
    fields: {
      project: { key: 'SHARESV' },
      issuetype: { name: 'Bug' },
      summary,
      description,
      environment,
      priority: { name: priority },
      labels: ['rrweb', 'auto-captured'],
    },
  };
  return {
    summary,
    description,
    environment,
    priority,
    payload,
    script: buildScript(),
  };
}

function buildScript() {
  return `#!/usr/bin/env bash
# SAMPLE ONLY: creates the Jira bug from jira-issue.json and uploads the media.
# Not run by the log server. Fill in the three variables before using it.
set -euo pipefail
cd "$(dirname "$0")"

JIRA_URL="https://your-company.atlassian.net"
JIRA_EMAIL="you@example.com"
JIRA_API_TOKEN="<create one at https://id.atlassian.com/manage-profile/security/api-tokens>"
# Also change "PROJ" in jira-issue.json to your project key.

KEY=$(curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -X POST "$JIRA_URL/rest/api/2/issue" \\
  --data @jira-issue.json | sed -n 's/.*"key":"\\([^"]*\\)".*/\\1/p')
echo "Created $KEY"

for file in ${ATTACHMENTS.map((a) => a.file).join(' ')}; do
  curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \\
    -H "X-Atlassian-Token: no-check" \\
    -X POST "$JIRA_URL/rest/api/2/issue/$KEY/attachments" \\
    -F "file=@$file" > /dev/null
  echo "Attached $file"
done
`;
}

const FEEDBACK_ISSUE_TYPES = {
  bug: 'Bug',
  usability: 'Task',
  feature: 'Story',
  general: 'Task',
};
const CATEGORY_LABELS = {
  bug: 'Bug',
  usability: 'Usability',
  feature: 'Feature request',
  general: 'Feedback',
};

/** A Jira draft for one feedback submission, in the same simple format. */
export function buildFeedbackJiraDraft({ feedback, session, issues, links }) {
  const label = CATEGORY_LABELS[feedback.category] || 'Feedback';
  const firstLine = oneLine(feedback.comment.split('\n')[0]);
  const page = feedback.page_url ? pageOf(feedback.page_url) : 'the app';
  const summary = clip(
    firstLine || `${label}: rated ${feedback.rating}/5 on ${page}`,
    200,
  );

  const lines = [];
  const push = (...l) => lines.push(...l);
  push('h3. Feedback');
  if (feedback.comment) push(`{quote}${escapeWiki(feedback.comment)}{quote}`);
  // shows the attached screenshot inside the description, as Jira does
  if (feedback.screenshot) push(`!${feedback.screenshot}|width=640!`);
  push(`* *Category:* ${label}`);
  if (feedback.rating) push(`* *Rating:* ${feedback.rating}/5`);
  push(`* *Page:* ${feedback.page_url || 'unknown'}`);
  push('');

  const errors = (issues || []).filter((i) => i.severity !== 'warning');
  if (session) {
    push('h3. What happened in the session');
    push(
      `The tester was recording; the feedback was given at ${formatOffset(
        feedback.offset_ms ?? 0,
      )} of the replay.`,
    );
    for (const issue of errors.slice(0, 5))
      push(
        `# *${escapeWiki(oneLine(issue.title))}*${
          issue.occurrences > 1 ? ` (×${issue.occurrences})` : ''
        } at ${formatOffset(issue.offset_ms)}`,
      );
    push('');
  }

  push('h3. Expected result');
  push('_Describe what should happen._', '');

  push('h3. Media');
  if (feedback.screenshot)
    push(`* [^${feedback.screenshot}] — screenshot taken with the feedback`);
  if (session)
    push(
      `* [^replay.html] — replay of the session (feedback at ${formatOffset(
        feedback.offset_ms ?? 0,
      )})`,
    );
  if (!feedback.screenshot && !session) push('_No media attached._');
  push('');

  const environment = buildEnvironment({
    url: feedback.page_url,
    userAgent: feedback.user_agent,
    viewport: feedback.viewport_w
      ? `${feedback.viewport_w}×${feedback.viewport_h}`
      : '',
    time: feedback.created_at,
    timeLabel: 'Submitted',
    link: links.feedback,
    linkLabel: 'Feedback log',
  });

  const issueType = FEEDBACK_ISSUE_TYPES[feedback.category] || 'Task';
  const priority =
    feedback.category === 'bug' && errors.length
      ? 'High'
      : feedback.rating !== null && feedback.rating <= 2
      ? 'Medium'
      : 'Low';
  return {
    summary,
    description: lines.join('\n').trimEnd(),
    environment,
    issueType,
    priority,
    labels: ['rrweb', 'feedback', feedback.category],
  };
}
