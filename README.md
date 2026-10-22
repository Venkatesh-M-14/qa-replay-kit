# QA Replay Kit

A QA toolkit built on [rrweb](https://github.com/rrweb-io/rrweb). Testers record a
session in the browser and get a replay with its errors, console output and network
requests. From that they can write a Jira draft, see heatmaps and collect feedback, all
in a local dashboard. It runs on one machine and needs no accounts or cloud services.

It has two parts:

- **Browser extension** ([packages/web-extension](packages/web-extension/)): records the
  session, shows a debug report next to the replay, and collects tester feedback.
- **Issue server** ([issue-server](issue-server/)): a local dashboard that stores the
  sessions in SQLite and shows overview numbers, sessions, heatmaps, feedback and Jira
  drafts.

## Features

**Extension**

- Record, pause and resume from the popup. The recording follows navigation and tab
  changes.
- Debug panel next to the replay with four tabs: **Issues**, **Steps**, **Console** and
  **Network**. Click an entry to jump the replay to that moment.
- Issue detection: console errors and failed requests are grouped. Each issue is linked
  to the user action that probably caused it.
- Secrets are redacted: tokens, cookies, passwords and API keys are removed from headers
  and bodies before the report is built.
- A standalone HTML bug report you can download or attach.
- A feedback form in the popup with a rating, a category and a screenshot. The
  feedback is pinned to that moment of the recording.
- Privacy settings: mask all inputs, mask text by CSS selector, block elements, and turn
  canvas, console or network-body capture on or off.

**Issue server dashboard** (`http://localhost:4000`)

| Page     | What it shows                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Overview | Sessions, errors, clicks, scroll depth, feedback, rating and errors that keep coming back.            |
| Sessions | Search and filters. Each session has its replay, issues, pages visited, feedback and a Jira draft.    |
| Heatmaps | Clicks over a snapshot of each page, by screen size, plus scroll depth and the most clicked elements. |
| Feedback | Inbox with status, notes, screenshots, a link to the replay moment, a Jira draft and CSV export.      |
| Settings | Stored data and retention (delete sessions older than N days).                                        |

The server never sends anything to Jira. Each draft has a title, steps to reproduce,
environment details and attachments (`replay.html`, `report.html`), ready to paste into
Jira.

## Quick start

Requirements: Node.js 18 or newer, and Yarn 1.

```bash
git clone https://github.com/Venkatesh-M-14/qa-replay-kit.git
cd qa-replay-kit
yarn install
```

**1. Start the issue server**

```bash
cd issue-server
npm install
npm start            # http://localhost:4000
```

`PORT`, `HOST` and `DATA_DIR` change the defaults. The server listens on `127.0.0.1` only
because it has no login.

**2. Build and load the extension**

```bash
cd packages/web-extension
yarn build:chrome    # or: yarn build:firefox
```

- In Chrome, open `chrome://extensions` and turn on Developer mode. Click **Load
  unpacked** and pick `packages/web-extension/dist/chrome`.
- If you run the server at another address, set it under **Log server → Address** in the
  extension's Settings page. The default is `http://localhost:4000`.

For development with auto-reload, run `yarn dev:chrome` or `yarn dev:firefox`.

**3. Record**

Start a recording from the popup, use the app, then stop. Open the session to see the
replay and debug panel. Click **Save to log server** to send it to the dashboard.

## Data and privacy

Everything stays on your machine, in `issue-server/data/`:

- `issues.db` (SQLite): sessions, issues, clicks, page views and feedback.
- `media/<session id>/`: `replay.html` (no console or network data, safe to share),
  `report.html`, `recording.json.gz` (the raw recording, keep it local) and Jira draft
  files.
- `feedback/`: screenshots.

Heatmaps show where **testers** clicked in the sessions they saved. They are not
analytics from real users.

## Tests

```bash
cd issue-server && npm test                  # issue server API tests
cd packages/web-extension && yarn test       # report and issue detection tests
```

## Repository layout

| Path                                                                                                                                                         | Contents                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [issue-server/](issue-server/)                                                                                                                               | Local dashboard and API ([details](issue-server/README.md)) |
| [packages/web-extension/](packages/web-extension/)                                                                                                           | Chrome / Firefox extension                                  |
| [packages/rrweb](packages/rrweb/), [packages/record](packages/record/), [packages/replay](packages/replay/), [packages/rrweb-player](packages/rrweb-player/) | rrweb recording and replay libraries                        |
| [packages/plugins/](packages/plugins/)                                                                                                                       | rrweb console and network plugins                           |
| [docs/](docs/)                                                                                                                                               | rrweb internal design notes                                 |

## Built on rrweb

This repository is a fork of [rrweb](https://github.com/rrweb-io/rrweb) ("record and replay
the web"). The recording, snapshot and replay packages come from upstream. For how
they work, see the [rrweb guide](https://rrweb.com/docs/guide) and the design notes on
[serialization](./docs/serialization.md), [incremental snapshots](./docs/observer.md),
[replay](./docs/replay.md) and the [sandbox](./docs/sandbox.md).

## License

MIT. See [LICENSE](LICENSE). rrweb is © its contributors under the same license.
