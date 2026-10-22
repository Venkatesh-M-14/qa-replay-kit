import { getLogServerUrl } from './logServer';

export const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: 'Bug' },
  { value: 'usability', label: 'Usability issue' },
  { value: 'feature', label: 'Feature request' },
  { value: 'general', label: 'General feedback' },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]['value'];

export type FeedbackPayload = {
  // generated once per form, so retrying a failed submit cannot create duplicates
  id: string;
  category: FeedbackCategory;
  rating: number | null;
  comment: string;
  contact: string;
  pageUrl: string;
  pageTitle: string;
  viewportWidth?: number;
  viewportHeight?: number;
  userAgent: string;
  // data URL of a JPEG of the visible tab
  screenshot: string | null;
  // true when a recording was running; the session is linked once saved
  recording: boolean;
};

export async function submitFeedback(payload: FeedbackPayload) {
  const response = await fetch(`${await getLogServerUrl()}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    url?: string;
  };
  if (!response.ok)
    throw new Error(body.error || `Log server responded ${response.status}`);
  return body as { url: string };
}
