import { record } from 'rrweb';
import type { eventWithTime, NetworkBody, NetworkHeaders } from '@rrweb/types';
import { getRecordConsolePlugin } from '@rrweb/rrweb-plugin-console-record';
import { getRecordNetworkPlugin } from '@rrweb/rrweb-plugin-network-record';
import {
  MessageName,
  type RecordStartedMessage,
  type RecorderConfig,
} from '~/types';
import { isInCrossOriginIFrame } from '~/utils';
import { startPageTracking } from './pageTracking';

/**
 * This script is injected into both main page and cross-origin IFrames through <script> tags.
 */

// header names that carry credentials or identify the user's device
const REDACTED_HEADER =
  /authorization|cookie|token|secret|api-?key|fingerprint|session/i;
// Keep stored sessions small: large payloads are cut off after this many characters.
const MAX_BODY_LENGTH = 20_000;

function redactHeaders(headers?: NetworkHeaders) {
  if (!headers) return headers;
  const result: NetworkHeaders = {};
  for (const [key, value] of Object.entries(headers))
    result[key] = REDACTED_HEADER.test(key) ? '[redacted]' : value;
  return result;
}

function truncateBody(body?: NetworkBody) {
  if (typeof body === 'string' && body.length > MAX_BODY_LENGTH)
    return `${body.slice(0, MAX_BODY_LENGTH)}… [truncated ${
      body.length - MAX_BODY_LENGTH
    } chars]`;
  return body;
}

let stopFn: (() => void) | null = null;

function startRecord(config: Partial<RecorderConfig>) {
  const plugins = [];
  if (config.captureConsole !== false) plugins.push(getRecordConsolePlugin());
  const captureBodies = config.captureNetworkBodies !== false;
  plugins.push(
    getRecordNetworkPlugin({
      initiatorTypes: ['fetch', 'xmlhttprequest', 'navigation', 'script'],
      recordHeaders: captureBodies,
      recordBody: captureBodies,
      recordInitialRequests: true,
      transformRequestFn: (request) => ({
        ...request,
        requestHeaders: redactHeaders(request.requestHeaders),
        responseHeaders: redactHeaders(request.responseHeaders),
        requestBody: truncateBody(request.requestBody),
        responseBody: truncateBody(request.responseBody),
      }),
    }),
  );
  const stopRecording = record<eventWithTime>({
    emit: (event) => {
      postMessage({
        message: MessageName.EmitEvent,
        event,
      });
    },
    plugins,
    recordCrossOriginIframes: true,
    maskAllInputs: Boolean(config.maskAllInputs),
    maskTextSelector: config.maskTextSelector?.trim() || undefined,
    blockSelector: config.blockSelector?.trim() || undefined,
    recordCanvas: Boolean(config.recordCanvas),
    // canvas frames are images; two per second keeps recordings manageable
    sampling: config.recordCanvas ? { canvas: 2 } : undefined,
  });
  const stopTracking = stopRecording ? startPageTracking() : undefined;
  stopFn = stopRecording
    ? () => {
        stopTracking?.();
        stopRecording();
      }
    : null;
  postMessage({
    message: MessageName.RecordStarted,
    startTimestamp: Date.now(),
  } as RecordStartedMessage);
}

const messageHandler = (
  event: MessageEvent<{
    message: MessageName;
    config?: Partial<RecorderConfig>;
  }>,
) => {
  if (event.source !== window) return;
  const data = event.data;
  const eventHandler = {
    [MessageName.StartRecord]: () => {
      startRecord(data.config || {});
    },
    [MessageName.StopRecord]: () => {
      if (stopFn) {
        try {
          stopFn();
        } catch (e) {
          //
        }
      }
      postMessage({
        message: MessageName.RecordStopped,
        endTimestamp: Date.now(),
      });
      window.removeEventListener('message', messageHandler);
    },
  } as Record<MessageName, () => void>;
  if (eventHandler[data.message]) eventHandler[data.message]();
};

/**
 * Only post message in the main page.
 */
function postMessage(message: unknown) {
  if (!isInCrossOriginIFrame()) window.postMessage(message, location.origin);
}

window.addEventListener('message', messageHandler);

window.postMessage(
  {
    message: MessageName.RecordScriptReady,
  },
  location.origin,
);
