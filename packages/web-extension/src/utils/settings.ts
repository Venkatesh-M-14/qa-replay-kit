import Browser from 'webextension-polyfill';
import { DEFAULT_SETTINGS, SyncDataKey, type Settings } from '~/types';

export async function getSettings(): Promise<Settings> {
  const stored = (await Browser.storage.sync.get(SyncDataKey.settings)) as {
    settings?: Partial<Settings>;
  };
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

export async function saveSettings(settings: Settings) {
  await Browser.storage.sync.set({ [SyncDataKey.settings]: settings });
}
