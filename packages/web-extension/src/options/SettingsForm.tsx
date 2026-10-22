import { useEffect, useState } from 'react';
import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  Stack,
  Switch,
  Text,
  useToast,
} from '@chakra-ui/react';
import { DEFAULT_SETTINGS, type Settings } from '~/types';
import { Card } from '~/components/ui';
import { getSettings, saveSettings } from '~/utils/settings';

type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

const SWITCHES: { key: BooleanKey; label: string; help: string }[] = [
  {
    key: 'maskAllInputs',
    label: 'Mask all typed values',
    help: 'Every input is recorded as asterisks. Turn on when testing with real accounts.',
  },
  {
    key: 'captureConsole',
    label: 'Capture console output',
    help: 'Logs, warnings and errors appear in the report and the Jira draft.',
  },
  {
    key: 'captureNetworkBodies',
    label: 'Capture request and response details',
    help: 'Headers and bodies of API calls. Tokens, cookies and passwords are always redacted.',
  },
  {
    key: 'recordCanvas',
    label: 'Record charts drawn on canvas',
    help: 'Makes charts visible in replays, but recordings get much larger.',
  },
];

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      toast({
        status: 'success',
        title: 'Settings saved',
        description: 'They apply from the next recording.',
      });
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not save settings',
        description: String((err as Error).message),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card p={6} maxW="720px">
      <Stack spacing={6}>
        <Heading size="md">Recording</Heading>
        {SWITCHES.map(({ key, label, help }) => (
          <FormControl key={key} display="flex" alignItems="flex-start" gap={3}>
            <Switch
              id={key}
              mt={1}
              isChecked={settings[key]}
              onChange={(e) => update(key, e.target.checked)}
            />
            <div>
              <FormLabel htmlFor={key} mb={0}>
                {label}
              </FormLabel>
              <Text fontSize="sm" color="text.muted">
                {help}
              </Text>
            </div>
          </FormControl>
        ))}

        <FormControl>
          <FormLabel>Mask text in these elements</FormLabel>
          <Input
            placeholder=".balance, [data-private]"
            value={settings.maskTextSelector}
            onChange={(e) => update('maskTextSelector', e.target.value)}
          />
          <FormHelperText>
            CSS selector. Matching text is recorded as asterisks.
          </FormHelperText>
        </FormControl>

        <FormControl>
          <FormLabel>Do not record these elements</FormLabel>
          <Input
            placeholder=".kyc-form, #bank-details"
            value={settings.blockSelector}
            onChange={(e) => update('blockSelector', e.target.value)}
          />
          <FormHelperText>
            CSS selector. Matching elements appear as empty boxes in replays.
          </FormHelperText>
        </FormControl>

        <Heading size="md">Log server</Heading>
        <FormControl>
          <FormLabel>Address</FormLabel>
          <Input
            value={settings.logServerUrl}
            onChange={(e) => update('logServerUrl', e.target.value.trim())}
          />
          <FormHelperText>
            Where sessions and feedback are saved (the issue-server folder).
          </FormHelperText>
        </FormControl>

        <Text fontSize="sm" color="text.muted">
          Masking happens in the browser and reduces risk, but cannot catch
          everything. Review recordings before sharing them.
        </Text>
        <Button
          alignSelf="flex-start"
          colorScheme="brand"
          isLoading={saving}
          onClick={() => void save()}
        >
          Save settings
        </Button>
      </Stack>
    </Card>
  );
}
