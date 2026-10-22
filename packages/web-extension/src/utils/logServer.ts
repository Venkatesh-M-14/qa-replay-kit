import type { eventWithTime } from '@rrweb/types';
import type { Session } from '~/types';
import { renderHtmlReport, type SessionReport } from './report';

import { getSettings } from './settings';

/** The local issue server in /issue-server (`npm start`), set in Settings. */
export async function getLogServerUrl() {
  return (await getSettings()).logServerUrl.replace(/\/+$/, '');
}

export async function saveToLogServer(
  session: Session,
  events: eventWithTime[],
  report: SessionReport,
): Promise<{ id: string; url: string; issues: number }> {
  const response = await fetch(`${await getLogServerUrl()}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session,
      events,
      report,
      reportHtml: renderHtmlReport(session, report),
      userAgent: navigator.userAgent,
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error || `Log server responded ${response.status}`);
  }
  return response.json() as Promise<{
    id: string;
    url: string;
    issues: number;
  }>;
}
