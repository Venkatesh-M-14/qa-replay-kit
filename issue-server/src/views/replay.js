import { escapeHtml, scriptJson } from './layout.js';

// must match MARKER_COLORS in the extension (src/utils/timeline.ts)
const MARKER_COLORS = {
  error: '#e53e3e',
  navigation: '#3182ce',
  feedback: '#38a169',
};
const ANNOTATION_EVENT = 8;

/** A red timeline marker for each error, placed at its first occurrence. */
function errorMarkers(report) {
  return report.issues
    .filter((i) => i.severity === 'error')
    .map((i) => ({
      type: ANNOTATION_EVENT,
      data: {
        type: 'timelineMarker',
        text: i.count > 1 ? `${i.title} (×${i.count})` : i.title,
      },
      timestamp: report.startTimestamp + i.offset,
    }));
}

/**
 * A single HTML file that replays the session without network access, so it
 * can be attached to a ticket. Open it with ?t=SECONDS to start at a moment.
 */
export function renderReplay(session, events, report, player) {
  const withMarkers = [...events, ...errorMarkers(report)].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Replay – ${escapeHtml(session.name)}</title>
<style>${player.css}</style>
<style>
body{margin:0;padding:16px;background:#f7fafc;font:14px system-ui,sans-serif;color:#1a202c}
h1{font-size:16px;margin:0 0 4px}.legend{font-size:12px;color:#4a5568;margin-bottom:12px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 12px;vertical-align:middle}
#player{display:flex;justify-content:center}
</style>
</head><body>
<h1>${escapeHtml(session.name)}</h1>
<div class="legend">Timeline markers:
  <i style="background:${MARKER_COLORS.error}"></i>error
  <i style="background:${MARKER_COLORS.navigation}"></i>page change
  <i style="background:${MARKER_COLORS.feedback}"></i>feedback</div>
<div id="player"></div>
<script>${player.js}</script>
<script>
const events = ${scriptJson(withMarkers)};
const Player = window.rrwebPlayer.default || window.rrwebPlayer;
const width = Math.min(window.innerWidth - 32, 1024);
const player = new Player({
  target: document.getElementById('player'),
  props: {
    events, width, height: Math.round(width * 0.5625), autoPlay: false,
    tags: ${scriptJson({
      navigation: MARKER_COLORS.navigation,
      feedback: MARKER_COLORS.feedback,
    })},
    timelineMarkerColor: ${scriptJson(MARKER_COLORS.error)},
  },
});
const t = Number(new URLSearchParams(location.search).get('t'));
// seeking before the page has loaded leaves the replay frame in a loading state
if (t > 0) window.addEventListener('load', () => player.goto(t * 1000, false));
</script>
</body></html>`;
}
