export const Colors = {
  light: {
    text: '#20231F',
    background: '#F7F7F2',
    card: '#FFFFFF',
    border: '#E4E6DD',
    secondaryText: '#656B61',
    accent: '#427A55',
    accentSoft: '#E7F0E7',
  },
  dark: {
    text: '#F2F4EE',
    background: '#151915',
    card: '#202620',
    border: '#343C34',
    secondaryText: '#B5BDB3',
    accent: '#91C99B',
    accentSoft: '#27372A',
  },
} as const;

export type ColorScheme = keyof typeof Colors;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;
