import { Fragment, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Flex,
  Icon,
  Switch,
  Tab,
  Table,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiEdit3,
  FiGlobe,
  FiMousePointer,
  FiPlay,
  FiTerminal,
  FiWifi,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import {
  describeStep,
  formatOffset,
  pathOf,
  type NetworkEntry,
  type SessionReport,
  type Step,
} from '~/utils/report';
import {
  Card,
  CountPill,
  DotBadge,
  EmptyState,
  type Tone,
} from '~/components/ui';

type Props = {
  report: SessionReport;
  onSeek: (offset: number) => void;
};

function TabLabel({
  label,
  count,
  alert,
}: {
  label: string;
  count: number;
  alert?: number;
}) {
  return (
    <Flex align="center" gap={2}>
      {label}
      <CountPill tone={alert ? 'danger' : 'neutral'}>
        {alert ? `${alert}/${count}` : count}
      </CountPill>
    </Flex>
  );
}

function Pre({ children }: { children: ReactNode }) {
  return (
    <Box
      as="pre"
      mt={2}
      p="10px 12px"
      bg="bg.subtle"
      color="text.secondary"
      borderRadius="6px"
      fontFamily="mono"
      fontSize="12px"
      lineHeight={1.55}
      whiteSpace="pre-wrap"
      wordBreak="break-word"
      maxH="320px"
      overflow="auto"
    >
      {children}
    </Box>
  );
}

/** A small button showing a time; jumps the replay there. */
function TimeButton({
  offset,
  onSeek,
}: {
  offset: number;
  onSeek: (offset: number) => void;
}) {
  return (
    <Button
      variant="outline"
      size="xs"
      h="26px"
      leftIcon={<Icon as={FiPlay} boxSize="10px" />}
      fontFamily="mono"
      fontWeight={500}
      onClick={(e) => {
        e.stopPropagation();
        onSeek(offset);
      }}
      title="Jump the replay here"
    >
      {formatOffset(offset)}
    </Button>
  );
}

function prettyBody(body?: string | null) {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function headerText(headers?: Record<string, string>) {
  return headers
    ? Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')
    : '';
}

function NetworkDetail({ entry }: { entry: NetworkEntry }) {
  const sections: [string, string][] = [
    ['Request headers', headerText(entry.requestHeaders)],
    ['Request body', prettyBody(entry.requestBody)],
    ['Response headers', headerText(entry.responseHeaders)],
    ['Response body', prettyBody(entry.responseBody)],
  ];
  const filled = sections.filter(([, value]) => value);
  if (!filled.length)
    return <Text color="text.muted">No headers or body were captured.</Text>;
  return (
    <Box>
      <Text
        fontFamily="mono"
        fontSize="12px"
        color="text.muted"
        wordBreak="break-all"
      >
        {entry.method} {entry.url}
      </Text>
      {filled.map(([title, value]) => (
        <Box key={title} mt={3}>
          <Text
            fontSize="11px"
            fontWeight={600}
            textTransform="uppercase"
            letterSpacing="0.05em"
            color="text.muted"
          >
            {title}
          </Text>
          <Pre>{value}</Pre>
        </Box>
      ))}
    </Box>
  );
}

const STEP_ICONS: Record<Step['action'], IconType> = {
  navigate: FiGlobe,
  click: FiMousePointer,
  'double click': FiMousePointer,
  'right click': FiMousePointer,
  input: FiEdit3,
};

const levelTone = (level: string): Tone =>
  level === 'error' || level === 'assert'
    ? 'danger'
    : level === 'warn'
    ? 'warning'
    : 'neutral';

function statusTone(entry: NetworkEntry): Tone {
  if (entry.failed) return 'danger';
  if (entry.status && entry.status >= 300) return 'warning';
  return entry.status ? 'success' : 'neutral';
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export function DebugPanel({ report, onSeek }: Props) {
  const [openRequest, setOpenRequest] = useState<number | null>(null);
  const [failedOnly, setFailedOnly] = useState(false);
  const errors = report.issues.filter((i) => i.severity === 'error');
  const consoleErrors = report.console.filter(
    (c) => levelTone(c.level) === 'danger',
  ).length;
  const failedRequests = report.network.filter((n) => n.failed).length;
  const network = report.network
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !failedOnly || entry.failed);

  return (
    <Card>
      <Tabs isLazy>
        <TabList
          px={2}
          borderColor="border.default"
          overflowX="auto"
          overflowY="hidden"
        >
          <Tab fontWeight={500} py={3}>
            <TabLabel
              label="Issues"
              count={report.issues.length}
              alert={errors.length}
            />
          </Tab>
          <Tab fontWeight={500} py={3}>
            <TabLabel label="Steps" count={report.steps.length} />
          </Tab>
          <Tab fontWeight={500} py={3}>
            <TabLabel
              label="Console"
              count={report.console.length}
              alert={consoleErrors}
            />
          </Tab>
          <Tab fontWeight={500} py={3}>
            <TabLabel
              label="Network"
              count={report.network.length}
              alert={failedRequests}
            />
          </Tab>
        </TabList>
        <TabPanels>
          <TabPanel p={0}>
            {report.issues.length === 0 && (
              <EmptyState
                icon={FiCheckCircle}
                title="No errors in this session"
                hint="No console errors or failed requests were recorded."
              />
            )}
            {report.issues.map((issue, i) => {
              const warning = issue.severity === 'warning';
              return (
                <Box
                  key={i}
                  px={4}
                  py={3.5}
                  borderBottomWidth="1px"
                  borderColor="border.default"
                  _last={{ borderBottomWidth: 0 }}
                >
                  <Flex justify="space-between" gap={3} align="flex-start">
                    <Flex
                      wrap="wrap"
                      align="center"
                      gap={2}
                      fontWeight={500}
                      minW={0}
                    >
                      {warning ? (
                        <DotBadge tone="warning">Warning</DotBadge>
                      ) : issue.source === 'network' ? (
                        <DotBadge tone="info">Network</DotBadge>
                      ) : (
                        <DotBadge tone="danger">Console</DotBadge>
                      )}
                      <Text as="span" wordBreak="break-word">
                        {issue.title}
                      </Text>
                      {issue.count > 1 && <CountPill>×{issue.count}</CountPill>}
                    </Flex>
                    <TimeButton offset={issue.offset} onSeek={onSeek} />
                  </Flex>
                  <Text color="text.muted" fontSize="12.5px" mt={1}>
                    Likely trigger:{' '}
                    {issue.cause
                      ? `${describeStep(issue.cause)} (at ${formatOffset(
                          issue.cause.offset,
                        )})`
                      : 'no user action in the previous 10s'}
                  </Text>
                  {issue.detail && <Pre>{prettyBody(issue.detail)}</Pre>}
                </Box>
              );
            })}
          </TabPanel>

          <TabPanel p={0}>
            {report.steps.length === 0 ? (
              <EmptyState
                icon={FiMousePointer}
                title="No user actions recorded"
              />
            ) : (
              <Table size="sm">
                <Tbody>
                  {report.steps.map((step, i) => (
                    <Tr
                      key={i}
                      cursor="pointer"
                      onClick={() => onSeek(step.offset)}
                    >
                      <Td w="96px" py={2.5}>
                        <TimeButton offset={step.offset} onSeek={onSeek} />
                      </Td>
                      <Td w="28px" px={0} color="text.muted">
                        <Icon as={STEP_ICONS[step.action]} />
                      </Td>
                      <Td wordBreak="break-word">{describeStep(step)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </TabPanel>

          <TabPanel p={0}>
            {report.console.length === 0 ? (
              <EmptyState
                icon={FiTerminal}
                title="No console output recorded"
              />
            ) : (
              <Table size="sm">
                <Tbody>
                  {report.console.map((entry, i) => (
                    <Tr
                      key={i}
                      cursor="pointer"
                      onClick={() => onSeek(entry.offset)}
                    >
                      <Td w="96px" verticalAlign="top" py={2.5}>
                        <TimeButton offset={entry.offset} onSeek={onSeek} />
                      </Td>
                      <Td w="96px" verticalAlign="top" py={3}>
                        <DotBadge tone={levelTone(entry.level)}>
                          {entry.level}
                        </DotBadge>
                      </Td>
                      <Td>
                        <Text
                          fontFamily="mono"
                          fontSize="12px"
                          whiteSpace="pre-wrap"
                          wordBreak="break-word"
                          color={
                            levelTone(entry.level) === 'danger'
                              ? 'danger.fg'
                              : undefined
                          }
                        >
                          {entry.message}
                          {entry.trace.length > 0 && (
                            <Box as="span" color="text.muted">
                              {`\n${entry.trace
                                .slice(0, 6)
                                .map((t) => `    at ${t}`)
                                .join('\n')}`}
                            </Box>
                          )}
                        </Text>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </TabPanel>

          <TabPanel p={0}>
            <Flex
              justify="space-between"
              align="center"
              px={4}
              py={2.5}
              gap={3}
              wrap="wrap"
              borderBottomWidth="1px"
              borderColor="border.default"
            >
              <Text fontSize="13px" color="text.muted">
                Click a request for its headers and body.
              </Text>
              <Flex
                as="label"
                align="center"
                gap={2}
                fontSize="13px"
                cursor="pointer"
              >
                <Switch
                  size="sm"
                  colorScheme="brand"
                  isChecked={failedOnly}
                  onChange={(e) => setFailedOnly(e.target.checked)}
                />
                Failed only
              </Flex>
            </Flex>
            {network.length === 0 ? (
              <EmptyState
                icon={FiWifi}
                title={
                  failedOnly ? 'No failed requests' : 'No requests recorded'
                }
              />
            ) : (
              <Box overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th w="24px" px={2} />
                      <Th w="96px">Time</Th>
                      <Th>Request</Th>
                      <Th w="110px">Status</Th>
                      <Th w="90px" isNumeric>
                        Duration
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {network.map(({ entry, index }) => (
                      <Fragment key={index}>
                        <Tr
                          cursor="pointer"
                          onClick={() =>
                            setOpenRequest(openRequest === index ? null : index)
                          }
                        >
                          <Td px={2} color="text.muted">
                            <Icon
                              as={
                                openRequest === index
                                  ? FiChevronDown
                                  : FiChevronRight
                              }
                            />
                          </Td>
                          <Td py={2.5}>
                            {entry.isInitial ? (
                              <Text color="text.muted" fontSize="12px">
                                page load
                              </Text>
                            ) : (
                              <TimeButton
                                offset={entry.offset}
                                onSeek={onSeek}
                              />
                            )}
                          </Td>
                          <Td>
                            <Flex gap={2} align="baseline" minW={0}>
                              <Text
                                fontFamily="mono"
                                fontSize="12px"
                                fontWeight={600}
                                flexShrink={0}
                              >
                                {entry.method}
                              </Text>
                              <Text
                                fontFamily="mono"
                                fontSize="12.5px"
                                wordBreak="break-all"
                                color={entry.failed ? 'danger.fg' : undefined}
                              >
                                {pathOf(entry.url)}
                              </Text>
                            </Flex>
                            <Text fontSize="12px" color="text.muted">
                              {hostOf(entry.url)}
                            </Text>
                          </Td>
                          <Td>
                            <DotBadge tone={statusTone(entry)}>
                              {entry.status || (entry.failed ? 'failed' : '—')}
                            </DotBadge>
                          </Td>
                          <Td
                            isNumeric
                            fontFamily="mono"
                            fontSize="12px"
                            color="text.muted"
                          >
                            {entry.duration !== undefined
                              ? `${entry.duration} ms`
                              : '—'}
                          </Td>
                        </Tr>
                        {openRequest === index && (
                          <Tr _hover={{}}>
                            <Td colSpan={5} bg="bg.canvas" py={3}>
                              <NetworkDetail entry={entry} />
                            </Td>
                          </Tr>
                        )}
                      </Fragment>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
      {report.skippedEvents > 0 && (
        <Flex
          gap={2}
          align="center"
          px={4}
          py={2.5}
          bg="warning.soft"
          color="warning.fg"
          fontSize="13px"
        >
          <Icon as={FiAlertTriangle} />
          {report.skippedEvents} event(s) could not be read and are not shown.
        </Flex>
      )}
    </Card>
  );
}
