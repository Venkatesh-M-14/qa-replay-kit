import type { eventWithTime } from '@rrweb/types';

export enum SyncDataKey {
  settings = 'settings',
}

export type SyncData = {
  [SyncDataKey.settings]: Settings;
};

export type Settings = {
  /** Replace every typed value with asterisks in the recording. */
  maskAllInputs: boolean;
  /** CSS selector whose text is masked, e.g. ".balance, [data-private]". */
  maskTextSelector: string;
  /** CSS selector of elements that are not recorded at all. */
  blockSelector: string;
  /** Record <canvas> content (charts) as images; larger recordings. */
  recordCanvas: boolean;
  /** Capture console output. */
  captureConsole: boolean;
  /** Capture request/response headers and bodies (redacted). */
  captureNetworkBodies: boolean;
  /** Local issue server the sessions and feedback are sent to. */
  logServerUrl: string;
};

export const DEFAULT_SETTINGS: Settings = {
  maskAllInputs: false,
  maskTextSelector: '',
  blockSelector: '',
  recordCanvas: false,
  captureConsole: true,
  captureNetworkBodies: true,
  logServerUrl: 'http://localhost:4000',
};

/** Recorder options sent from the content script to the injected recorder. */
export type RecorderConfig = Pick<
  Settings,
  | 'maskAllInputs'
  | 'maskTextSelector'
  | 'blockSelector'
  | 'recordCanvas'
  | 'captureConsole'
  | 'captureNetworkBodies'
>;

/** Custom event tags the extension adds to recordings. */
export enum CustomTag {
  Navigation = 'navigation',
  PageMetrics = 'page-metrics',
  Feedback = 'feedback',
}

export enum LocalDataKey {
  recorderStatus = 'recorder_status',
}

export type LocalData = {
  [LocalDataKey.recorderStatus]: {
    status: RecorderStatus;
    activeTabId: number;
    startTimestamp?: number;
    // the timestamp when the recording is paused
    pausedTimestamp?: number;
    errorMessage?: string; // error message when recording failed
  };
};

export enum RecorderStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PAUSED = 'PAUSED',
  // when user change the tab, the recorder will be paused during the tab change
  PausedSwitch = 'PAUSED_SWITCH',
}

export type Session = {
  id: string;
  name: string;
  tags: string[];
  createTimestamp: number;
  modifyTimestamp: number;
  recorderVersion: string;
};

// all service names for channel
export enum ServiceName {
  StartRecord = 'start-record',
  StopRecord = 'stop-record',
}

// all event names for channel
export enum EventName {
  SessionUpdated = 'session-updated',
  ContentScriptEmitEvent = 'content-script-emit-event',
  StartButtonClicked = 'start-recording-button-clicked',
  StopButtonClicked = 'stop-recording-button-clicked',
  PauseButtonClicked = 'pause-recording-button-clicked',
  ResumeButtonClicked = 'resume-recording-button-clicked',
  FeedbackSubmitted = 'feedback-submitted',
}

// all message names for postMessage API
export enum MessageName {
  RecordScriptReady = 'rrweb-extension-record-script-ready',
  StartRecord = 'rrweb-extension-start-record',
  RecordStarted = 'rrweb-extension-record-started',
  StopRecord = 'rrweb-extension-stop-record',
  RecordStopped = 'rrweb-extension-record-stopped',
  EmitEvent = 'rrweb-extension-emit-event',
}

export type RecordStartedMessage = {
  message: MessageName.RecordStarted;
  startTimestamp: number;
};

export type RecordStoppedMessage = {
  message: MessageName.RecordStopped;
  endTimestamp: number;
};

export type EmitEventMessage = {
  message: MessageName.EmitEvent;
  event: eventWithTime;
};
