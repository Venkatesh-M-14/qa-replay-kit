import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { getFeedback, insertFeedback } from './db.js';
import { pageKey, stripQuery } from './pages.js';

export const CATEGORIES = {
  bug: 'Bug',
  usability: 'Usability issue',
  feature: 'Feature request',
  general: 'General feedback',
};

export const STATUSES = {
  new: 'New',
  reviewed: 'Reviewed',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const MAX_COMMENT = 5000;
const MAX_CONTACT = 200;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  jpeg: { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  png: { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
};

export class ValidationError extends Error {
  status = 400;
}

const fail = (message) => {
  throw new ValidationError(message);
};

/** Decodes and checks a screenshot data URL; the file's bytes must match its type. */
function decodeScreenshot(dataUrl) {
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl,
  );
  if (!match) fail('Screenshot must be a JPEG or PNG image');
  const type = IMAGE_TYPES[match[1]];
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_SCREENSHOT_BYTES)
    fail('Screenshot is larger than 5 MB');
  if (!type.magic.every((b, i) => bytes[i] === b))
    fail('Screenshot content does not match its image type');
  return { bytes, ext: type.ext };
}

export function validateFeedback(body) {
  if (!body || typeof body !== 'object') fail('Expected a JSON object');
  const { id, category, rating, comment = '', contact = '' } = body;
  if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id))
    fail('Missing or invalid feedback id');
  if (!CATEGORIES[category])
    fail(`Category must be one of: ${Object.keys(CATEGORIES).join(', ')}`);
  if (rating !== null && rating !== undefined)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      fail('Rating must be a whole number from 1 to 5');
  if (typeof comment !== 'string' || comment.length > MAX_COMMENT)
    fail(`Comment must be text of at most ${MAX_COMMENT} characters`);
  if (typeof contact !== 'string' || contact.length > MAX_CONTACT)
    fail(`Contact must be text of at most ${MAX_CONTACT} characters`);
  if ((rating === null || rating === undefined) && !comment.trim())
    fail('Add a rating or a comment');
  return {
    id,
    category,
    rating: rating ?? null,
    comment: comment.trim(),
    contact: contact.trim(),
    pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl : '',
    pageTitle:
      typeof body.pageTitle === 'string' ? body.pageTitle.slice(0, 300) : '',
    viewportWidth: Number.isInteger(body.viewportWidth)
      ? body.viewportWidth
      : null,
    viewportHeight: Number.isInteger(body.viewportHeight)
      ? body.viewportHeight
      : null,
    userAgent:
      typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : '',
    screenshot: body.screenshot ? decodeScreenshot(body.screenshot) : null,
    recording: body.recording === true,
  };
}

/**
 * Stores one feedback submission. Submitting the same id again returns the
 * stored record unchanged, so a retried request cannot create a duplicate.
 */
export function saveFeedback(db, feedbackDir, body) {
  const input = validateFeedback(body);
  const existing = getFeedback(db, input.id);
  if (existing) return { feedback: existing, created: false };

  let screenshot = null;
  if (input.screenshot) {
    mkdirSync(feedbackDir, { recursive: true });
    screenshot = `${input.id}.${input.screenshot.ext}`;
    writeFileSync(path.join(feedbackDir, screenshot), input.screenshot.bytes);
  }
  insertFeedback(db, {
    id: input.id,
    created_at: Date.now(),
    category: input.category,
    rating: input.rating,
    comment: input.comment,
    contact: input.contact,
    page_url: stripQuery(input.pageUrl),
    page: input.pageUrl ? pageKey(input.pageUrl) : '',
    page_title: input.pageTitle,
    viewport_w: input.viewportWidth,
    viewport_h: input.viewportHeight,
    user_agent: input.userAgent,
    screenshot,
    recording: input.recording ? 1 : 0,
  });
  return { feedback: getFeedback(db, input.id), created: true };
}
