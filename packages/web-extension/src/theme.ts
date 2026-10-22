import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

/*
 * Same design system as the log server dashboard (issue-server/src/views/layout.js):
 * slate neutrals, blue primary, Fira Sans / Fira Code, light and dark mode.
 */

const config: ThemeConfig = {
  initialColorMode: 'system',
  useSystemColorMode: true,
};

export const theme = extendTheme({
  config,
  fonts: {
    heading: "'Fira Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
    body: "'Fira Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  colors: {
    brand: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#2563EB',
      600: '#1E40AF',
      700: '#1E3A8A',
      800: '#172554',
      900: '#0F172A',
    },
  },
  semanticTokens: {
    colors: {
      'bg.canvas': { default: '#F8FAFC', _dark: '#020617' },
      'bg.surface': { default: '#FFFFFF', _dark: '#0F172A' },
      'bg.subtle': { default: '#F1F5F9', _dark: '#1E293B' },
      'border.default': { default: '#E2E8F0', _dark: '#1E293B' },
      'border.strong': { default: '#CBD5E1', _dark: '#334155' },
      'text.default': { default: '#0F172A', _dark: '#F1F5F9' },
      'text.secondary': { default: '#334155', _dark: '#CBD5E1' },
      'text.muted': { default: '#64748B', _dark: '#94A3B8' },
      'accent.default': { default: '#1E40AF', _dark: '#60A5FA' },
      'accent.soft': { default: '#DBEAFE', _dark: '#172554' },
      'danger.fg': { default: '#DC2626', _dark: '#F87171' },
      'danger.soft': { default: '#FEE2E2', _dark: '#450A0A' },
      'warning.fg': { default: '#B45309', _dark: '#FBBF24' },
      'warning.soft': { default: '#FEF3C7', _dark: '#422006' },
      'info.fg': { default: '#1D4ED8', _dark: '#93C5FD' },
      'info.soft': { default: '#DBEAFE', _dark: '#172554' },
      'success.fg': { default: '#15803D', _dark: '#4ADE80' },
      'success.soft': { default: '#DCFCE7', _dark: '#052E16' },
    },
  },
  styles: {
    global: {
      body: {
        bg: 'bg.canvas',
        color: 'text.default',
        fontSize: '14px',
        lineHeight: 1.5,
        WebkitFontSmoothing: 'antialiased',
      },
      '@media (prefers-reduced-motion: reduce)': {
        '*': { transition: 'none !important', animation: 'none !important' },
      },
    },
  },
  radii: { card: '10px' },
  shadows: {
    card: '0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.08)',
  },
  components: {
    Button: {
      baseStyle: { fontWeight: 500, borderRadius: '6px' },
      defaultProps: { colorScheme: 'gray', size: 'sm' },
      variants: {
        solid: (props: { colorScheme: string }) =>
          props.colorScheme === 'brand'
            ? {
                bg: 'accent.default',
                color: 'bg.surface',
                _hover: { bg: 'brand.700', _dark: { bg: 'brand.300' } },
              }
            : {},
        outline: {
          borderColor: 'border.strong',
          bg: 'bg.surface',
          _hover: { bg: 'bg.subtle' },
        },
      },
    },
    Table: {
      variants: {
        simple: {
          th: {
            bg: 'bg.subtle',
            color: 'text.muted',
            fontSize: '11px',
            letterSpacing: '0.05em',
            borderColor: 'border.default',
            py: 2.5,
          },
          td: { borderColor: 'border.default', py: 2.5 },
          tbody: { tr: { _hover: { bg: 'bg.subtle' } } },
        },
      },
    },
    Tabs: {
      defaultProps: { colorScheme: 'brand' },
    },
    Badge: {
      baseStyle: {
        borderRadius: 'full',
        textTransform: 'none',
        fontWeight: 600,
        px: 2,
      },
    },
    Input: { defaultProps: { focusBorderColor: 'brand.400' } },
    Select: { defaultProps: { focusBorderColor: 'brand.400' } },
    Textarea: { defaultProps: { focusBorderColor: 'brand.400' } },
    Code: {
      baseStyle: {
        fontFamily: 'mono',
        bg: 'bg.subtle',
        color: 'text.secondary',
      },
    },
  },
});
