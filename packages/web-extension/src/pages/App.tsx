import { Route, Routes } from 'react-router-dom';
import { AppShell } from '~/components/AppShell';
import { SessionList } from './SessionList';
import Player from './Player';

export default function App() {
  return (
    <AppShell active="sessions">
      <Routes>
        <Route path="/" element={<SessionList />} />
        <Route path="session/:sessionId" element={<Player />} />
      </Routes>
    </AppShell>
  );
}
