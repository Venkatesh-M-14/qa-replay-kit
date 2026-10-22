import type { ReactNode } from 'react';
import {
  Badge,
  Box,
  Flex,
  Heading,
  Icon,
  Text,
  type BoxProps,
} from '@chakra-ui/react';
import type { IconType } from 'react-icons';

/** A bordered surface, matching the dashboard's cards. */
export function Card({ children, ...rest }: BoxProps) {
  return (
    <Box
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="card"
      boxShadow="card"
      overflow="hidden"
      {...rest}
    >
      {children}
    </Box>
  );
}

export function CardHeader({
  title,
  icon,
  action,
}: {
  title: ReactNode;
  icon?: IconType;
  action?: ReactNode;
}) {
  return (
    <Flex
      justify="space-between"
      align="center"
      gap={3}
      px={4}
      py={3}
      borderBottomWidth="1px"
      borderColor="border.default"
    >
      <Heading
        as="h2"
        size="sm"
        display="flex"
        alignItems="center"
        gap={2}
        fontWeight={600}
      >
        {icon && <Icon as={icon} />}
        {title}
      </Heading>
      {action}
    </Flex>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <Box mb={5}>
      {back}
      <Flex justify="space-between" align="flex-end" gap={4} wrap="wrap">
        <Box minW={0}>
          <Heading
            as="h1"
            fontSize="22px"
            fontWeight={600}
            letterSpacing="-0.01em"
          >
            {title}
          </Heading>
          {description && (
            <Box color="text.muted" mt={1}>
              {description}
            </Box>
          )}
        </Box>
        {actions && (
          <Flex gap={2} wrap="wrap">
            {actions}
          </Flex>
        )}
      </Flex>
    </Box>
  );
}

const TONES = {
  danger: ['danger.soft', 'danger.fg'],
  warning: ['warning.soft', 'warning.fg'],
  info: ['info.soft', 'info.fg'],
  success: ['success.soft', 'success.fg'],
  neutral: ['bg.subtle', 'text.secondary'],
} as const;

export type Tone = keyof typeof TONES;

/** Pill badge with a coloured dot, as on the dashboard. */
export function DotBadge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const [bg, fg] = TONES[tone];
  return (
    <Badge
      bg={bg}
      color={fg}
      display="inline-flex"
      alignItems="center"
      gap="5px"
      h="22px"
      fontSize="11.5px"
      whiteSpace="nowrap"
      _before={{
        content: '""',
        w: '6px',
        h: '6px',
        borderRadius: 'full',
        bg: 'currentColor',
      }}
    >
      {children}
    </Badge>
  );
}

export function CountPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const [bg, fg] = TONES[tone];
  return (
    <Box
      as="span"
      bg={bg}
      color={fg}
      px="7px"
      minW="22px"
      textAlign="center"
      borderRadius="full"
      fontFamily="mono"
      fontSize="12px"
      fontWeight={600}
      lineHeight="20px"
      display="inline-block"
    >
      {children}
    </Box>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: IconType;
  title: string;
  hint?: ReactNode;
}) {
  return (
    <Flex
      direction="column"
      align="center"
      gap={2}
      textAlign="center"
      py={9}
      px={4}
      color="text.muted"
    >
      <Icon as={icon} boxSize={8} color="border.strong" />
      <Text fontWeight={600} color="text.secondary">
        {title}
      </Text>
      {hint && <Text>{hint}</Text>}
    </Flex>
  );
}
