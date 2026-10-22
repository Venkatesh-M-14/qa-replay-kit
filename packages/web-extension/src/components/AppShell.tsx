import { useEffect, useState, type ReactNode } from 'react';
import { Box, Flex, Icon, Link, Text } from '@chakra-ui/react';
import {
  FiExternalLink,
  FiLayers,
  FiPlayCircle,
  FiSettings,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { getLogServerUrl } from '~/utils/logServer';

type Section = 'sessions' | 'settings';

const NAV: { id: Section; label: string; icon: IconType; href: string }[] = [
  {
    id: 'sessions',
    label: 'Sessions',
    icon: FiPlayCircle,
    href: '/pages/index.html#/',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: FiSettings,
    href: '/options/index.html#',
  },
];

function NavLink({
  href,
  icon,
  label,
  active,
  external,
}: {
  href: string;
  icon: IconType;
  label: string;
  active?: boolean;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      isExternal={external}
      aria-current={active ? 'page' : undefined}
      display="flex"
      alignItems="center"
      gap={2.5}
      px={2.5}
      py={2}
      borderRadius="6px"
      fontWeight={500}
      color={active ? 'accent.default' : 'text.secondary'}
      bg={active ? 'accent.soft' : 'transparent'}
      transition="background .15s, color .15s"
      _hover={{
        textDecoration: 'none',
        bg: active ? 'accent.soft' : 'bg.subtle',
        color: active ? 'accent.default' : 'text.default',
      }}
    >
      <Icon as={icon} boxSize="18px" />
      {label}
      {external && (
        <Icon as={FiExternalLink} boxSize="12px" ml="auto" color="text.muted" />
      )}
    </Link>
  );
}

/** Sidebar layout shared by the extension's pages, matching the log server dashboard. */
export function AppShell({
  active,
  children,
}: {
  active: Section;
  children: ReactNode;
}) {
  const [dashboardUrl, setDashboardUrl] = useState('');
  useEffect(() => {
    void getLogServerUrl().then(setDashboardUrl);
  }, []);

  return (
    <Flex minH="100vh" direction={{ base: 'column', md: 'row' }}>
      <Flex
        as="nav"
        aria-label="Main"
        direction={{ base: 'row', md: 'column' }}
        wrap={{ base: 'wrap', md: 'nowrap' }}
        align={{ base: 'center', md: 'stretch' }}
        gap={1}
        w={{ base: 'full', md: '232px' }}
        flexShrink={0}
        position={{ base: 'static', md: 'sticky' }}
        top={0}
        h={{ base: 'auto', md: '100vh' }}
        bg="bg.surface"
        borderRightWidth={{ base: 0, md: '1px' }}
        borderBottomWidth={{ base: '1px', md: 0 }}
        borderColor="border.default"
        px={3}
        py={{ base: 2.5, md: 4 }}
      >
        <Flex
          align="center"
          gap={2.5}
          px={2.5}
          pb={{ base: 0, md: 4 }}
          fontWeight={600}
          fontSize="15px"
        >
          <Flex
            w="28px"
            h="28px"
            borderRadius="8px"
            bg="accent.default"
            color="bg.surface"
            align="center"
            justify="center"
          >
            <Icon as={FiLayers} />
          </Flex>
          rrweb QA
        </Flex>
        {NAV.map((item) => (
          <NavLink key={item.id} {...item} active={item.id === active} />
        ))}
        {dashboardUrl && (
          <NavLink
            href={dashboardUrl}
            icon={FiLayers}
            label="Dashboard"
            external
          />
        )}
        <Text
          mt="auto"
          px={2.5}
          fontSize="12px"
          color="text.muted"
          display={{ base: 'none', md: 'block' }}
        >
          Recordings stay in this browser until you save them to the log server.
        </Text>
      </Flex>
      <Box
        as="main"
        flex={1}
        minW={0}
        px={{ base: 4, md: 8 }}
        py={{ base: 5, md: 7 }}
        maxW="1320px"
      >
        {children}
      </Box>
    </Flex>
  );
}
