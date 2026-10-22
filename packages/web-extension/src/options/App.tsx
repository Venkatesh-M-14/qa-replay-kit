import { Route, Routes } from 'react-router-dom';
import { AppShell } from '~/components/AppShell';
import { PageHeader } from '~/components/ui';
import { SettingsForm } from './SettingsForm';

export default function App() {
  return (
    <AppShell active="settings">
      <PageHeader
        title="Settings"
        description="What the extension records and where it sends sessions. Changes apply from the next recording."
      />
      <Routes>
        <Route path="/" element={<SettingsForm />} />
      </Routes>
    </AppShell>
  );
}
