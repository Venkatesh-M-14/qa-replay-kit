# rrweb issue server

A local QA dashboard for the rrweb extension: session replays, error reports with Jira
drafts, heatmaps and tester feedback. Free, runs on one machine, no accounts.

```bash
cd issue-server
npm install
npm start            # http://localhost:4000   (PORT, HOST and DATA_DIR env vars override)
npm test             # API tests
```

It listens on 127.0.0.1 only, because it has no login. The extension sends sessions and
feedback to the address set in its Settings page (default `http://localhost:4000`).

## Pages

| Page | What it shows |
|---|---|
| Overview | Sessions, errors, clicks, scroll depth, feedback and rating, recurring errors. “—” means no data, not zero. |
| Sessions | Search and filter (date, page visited, errors only). Each session has a Jira draft, issues, pages visited and linked feedback. |
| Heatmaps | Per page and screen size: clicks drawn over a snapshot of the page, scroll depth, most clicked elements, links to the sessions. |
| Feedback | Inbox with filters, status, internal notes, screenshot, link to the replay moment, Jira draft, CSV export. |
| Settings | Stored data and retention (delete sessions older than N days). |

All pages share the date filter.

## How the pieces connect

- **Feedback → replay:** feedback submitted while recording adds a marker to the recording.
  When that session is saved, the feedback is linked to that moment of the replay.
- **Heatmap → sessions:** click a hot spot or an element to open the sessions that clicked it.
- **Replay timeline:** red markers are errors, blue are page changes, green is feedback.
  `replay.html?t=SECONDS` opens at a moment.

## Stored data

- `data/issues.db` (SQLite): `sessions`, `issues`, `clicks`, `page_views`, `feedback`.
- `data/media/<session id>/`: `replay.html` (no console or network data, safe to attach),
  `report.html`, `recording.json.gz` (raw, keep local), Jira draft files.
- `data/feedback/`: screenshots (JPEG/PNG, max 5 MB, checked from the file's bytes).

## Limits

- Heatmaps show where **testers** clicked, from saved sessions; they are not real-user analytics.
  With fewer than 3 sessions the page says so.
- Pages that scroll inside a panel: clicks made after scrolling that panel can be drawn too high.
- Click positions are compared by page width ratio and page height in pixels; pick a screen
  size when sessions used very different window sizes.

## API

| Method | Path | |
|---|---|---|
| POST | `/api/sessions` | `{ session, events, report, reportHtml, userAgent }` |
| GET | `/api/sessions` | filters: `from`, `to` (YYYY-MM-DD), `q`, `page`, `errors=1` |
| GET | `/api/sessions/:id` | session with issues |
| GET | `/api/sessions/:id/events` | replayable events (no console/network capture) |
| GET | `/api/sessions/:id/jira` | Jira draft |
| DELETE | `/api/sessions/:id` | remove session, its rows and media |
| GET | `/api/issues` | errors grouped across sessions |
| GET | `/api/heatmaps` | pages with clicks; with `page` (and `device`): heatmap data |
| GET | `/api/overview` | overview numbers |
| POST | `/api/feedback` | submit feedback (idempotent by `id`) |
| GET | `/api/feedback`, `/api/feedback.csv` | filters: `from`, `to`, `q`, `status`, `category`, `rating` |
| GET/PATCH | `/api/feedback/:id` | read; update `status` and `notes` |
| POST | `/api/retention` | `{ days }` deletes older sessions |
