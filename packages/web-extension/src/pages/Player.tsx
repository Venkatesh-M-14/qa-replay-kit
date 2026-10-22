/// <reference types="chrome"/>
import { useRef, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Replayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Center,
  Flex,
  Icon,
  Link,
  Text,
  useToast,
} from '@chakra-ui/react';
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiClock,
  FiDownload,
  FiExternalLink,
  FiGlobe,
  FiUploadCloud,
} from 'react-icons/fi';
import { Card, PageHeader } from '~/components/ui';
import type { eventWithTime } from '@rrweb/types';
import { getEvents, getSession } from '~/utils/storage';
import {
  buildReport,
  downloadHtmlReport,
  formatOffset,
  type SessionReport,
} from '~/utils/report';
import { getLogServerUrl, saveToLogServer } from '~/utils/logServer';
import type { Session } from '~/types';
import { DebugPanel } from './DebugPanel';
import { eventsForReplay, MARKER_COLORS } from '~/utils/timeline';

// Jumping to an issue starts the replay a little earlier so the lead-up is visible.
const SEEK_LEAD_MS = 2000;

export default function Player() {
  const playerElRef = useRef<HTMLDivElement>(null);
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const [savedUrl, setSavedUrl] = useState('');
  const playerRef = useRef<Replayer | null>(null);
  const { sessionId } = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [report, setReport] = useState<SessionReport | null>(null);
  const eventsRef = useRef<eventWithTime[]>([]);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const addProblem = (text: string) =>
    setProblems((current) =>
      current.includes(text) ? current : [...current, text],
    );
  const toast = useToast();

  useEffect(() => {
    if (!sessionId) return;
    getSession(sessionId)
      .then((session) => {
        setSession(session);
      })
      .catch((err: Error) => {
        addProblem(`The session could not be loaded: ${err.message}`);
      });
    getEvents(sessionId)
      .then((events) => {
        if (!playerElRef.current) return;
        if (playerRef.current) return;
        eventsRef.current = events;
        if (events.length < 2) {
          addProblem(
            `This recording has ${events.length} event(s), too few to replay. ` +
              'Recording probably stopped right after it started, or the page could not be recorded (for example a browser settings page).',
          );
          return;
        }

        // the report and the replay are independent: one failing must not hide the other
        let sessionReport: SessionReport | null = null;
        try {
          sessionReport = buildReport(events);
          setReport(sessionReport);
          if (sessionReport.skippedEvents)
            addProblem(
              `${sessionReport.skippedEvents} event(s) could not be read and were left out of the report (${sessionReport.skipError}).`,
            );
        } catch (err) {
          addProblem(
            `The report could not be built: ${(err as Error).message}`,
          );
        }

        try {
          playerRef.current = new Replayer({
            target: playerElRef.current,
            props: {
              events: sessionReport
                ? eventsForReplay(events, sessionReport)
                : events,
              autoPlay: true,
              // fit the card; 16:9 like the default player
              width: Math.min(
                1024,
                (playerWrapRef.current?.clientWidth || 1024) - 8,
              ),
              height: Math.round(
                Math.min(
                  1024,
                  (playerWrapRef.current?.clientWidth || 1024) - 8,
                ) * 0.5625,
              ),
              tags: MARKER_COLORS,
              timelineMarkerColor: MARKER_COLORS.error,
            },
          });
          // open at a moment passed in the URL, e.g. #/session/abc?t=12
          const t = Number(
            new URLSearchParams(location.hash.split('?')[1]).get('t'),
          );
          if (t > 0) playerRef.current.goto(t * 1000, true);
        } catch (err) {
          addProblem(`The replay could not start: ${(err as Error).message}`);
        }
      })
      .catch((err: Error) => {
        addProblem(`The recording could not be read: ${err.message}`);
      });
    return () => {
      // eslint-disable-next-line
      playerRef.current?.pause();
      // eslint-disable-next-line
      playerRef.current?.$destroy();
    };
  }, [sessionId]);

  const seek = (offset: number) => {
    playerRef.current?.goto(Math.max(0, offset - SEEK_LEAD_MS), true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!session || !report) return;
    setSaving(true);
    const serverUrl = await getLogServerUrl();
    try {
      const saved = await saveToLogServer(session, eventsRef.current, report);
      setSavedUrl(saved.url);
      toast({
        status: 'success',
        title: `Saved with ${saved.issues} issue(s)`,
        description: (
          <Link href={saved.url} isExternal textDecoration="underline">
            Open log and Jira draft
          </Link>
        ),
        duration: 10000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        status: 'error',
        title: 'Could not save to the log server',
        description: `Is it running at ${serverUrl}? ${String(
          (err as Error).message,
        )}`,
        duration: 10000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const errorCount =
    report?.issues.filter((i) => i.severity === 'error').length ?? 0;
  const description = (
    <Flex wrap="wrap" gap="6px 16px" fontSize="13px" mt={1}>
      {report?.url && (
        <Flex align="center" gap={1.5} minW={0}>
          <Icon as={FiGlobe} />
          <Text noOfLines={1} maxW="460px">
            {report.url}
          </Text>
        </Flex>
      )}
      {session && (
        <Flex align="center" gap={1.5}>
          <Icon as={FiClock} />
          {new Date(session.createTimestamp).toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {report && ` · ${formatOffset(report.duration)}`}
        </Flex>
      )}
      {report && (
        <Flex align="center" gap={1.5}>
          <Icon as={FiAlertTriangle} />
          {errorCount ? `${errorCount} issue(s)` : 'No errors'}
        </Flex>
      )}
    </Flex>
  );

  return (
    <>
      <PageHeader
        back={
          <Link
            href="#/"
            display="inline-flex"
            alignItems="center"
            gap={1.5}
            color="text.muted"
            fontSize="13px"
            mb={2.5}
          >
            <Icon as={FiArrowLeft} /> Sessions
          </Link>
        }
        title={session?.name || 'Session'}
        description={description}
        actions={
          <>
            {savedUrl && (
              <Button
                as={Link}
                href={savedUrl}
                isExternal
                variant="outline"
                leftIcon={<FiExternalLink />}
                _hover={{ textDecoration: 'none', bg: 'bg.subtle' }}
              >
                Open in dashboard
              </Button>
            )}
            <Button
              variant="outline"
              leftIcon={<FiDownload />}
              isDisabled={!session || !report}
              onClick={() =>
                session && report && downloadHtmlReport(session, report)
              }
            >
              Export report
            </Button>
            <Button
              colorScheme="brand"
              leftIcon={<FiUploadCloud />}
              isDisabled={!session || !report}
              isLoading={saving}
              onClick={() => void save()}
            >
              Save to log server
            </Button>
          </>
        }
      />
      {problems.map((problem) => (
        <Alert
          key={problem}
          status="warning"
          mb={4}
          borderRadius="card"
          bg="warning.soft"
        >
          <AlertIcon color="warning.fg" />
          <Box>
            <AlertTitle>
              Something in this session could not be shown
            </AlertTitle>
            <AlertDescription>{problem}</AlertDescription>
          </Box>
        </Alert>
      ))}
      <Card mb={5} p={4}>
        <Center
          ref={playerWrapRef}
          // the player keeps its own light styling, so its text must stay dark in dark mode
          sx={{ '.rr-player': { color: '#0F172A' } }}
        >
          <Box ref={playerElRef}></Box>
        </Center>
        <Flex
          justify="center"
          gap={4}
          mt={3}
          fontSize="12px"
          color="text.muted"
          wrap="wrap"
        >
          <Flex align="center" gap={1.5}>
            <Box
              w="10px"
              h="10px"
              borderRadius="2px"
              bg={MARKER_COLORS.error}
            />
            error
          </Flex>
          <Flex align="center" gap={1.5}>
            <Box
              w="10px"
              h="10px"
              borderRadius="2px"
              bg={MARKER_COLORS.navigation}
            />
            page change
          </Flex>
          <Flex align="center" gap={1.5}>
            <Box
              w="10px"
              h="10px"
              borderRadius="2px"
              bg={MARKER_COLORS.feedback}
            />
            feedback
          </Flex>
        </Flex>
      </Card>
      {report && <DebugPanel report={report} onSeek={seek} />}
    </>
  );
}
