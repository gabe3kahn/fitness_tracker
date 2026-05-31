import { HeroClass, HeroTier } from './heroes';

export const CLASS_COLORS: Record<HeroClass, { border: string; accent: string; dimBg: string }> = {
  warrior:       { border: '#D97706', accent: '#FCD34D', dimBg: '#78350F' },
  runner:        { border: '#059669', accent: '#6EE7B7', dimBg: '#064E3B' },
  disciplined:   { border: '#7C3AED', accent: '#C4B5FD', dimBg: '#2E1065' },
  'all-rounder': { border: '#2563EB', accent: '#93C5FD', dimBg: '#1E3A8A' },
  berserker:     { border: '#DC2626', accent: '#FCA5A5', dimBg: '#7F1D1D' },
  endurance:     { border: '#EA580C', accent: '#FDBA74', dimBg: '#7C2D12' },
};

export const TIER_LABELS: Record<HeroTier, string> = {
  novice:     'Novice',
  apprentice: 'Apprentice',
  champion:   'Champion',
  legend:     'Legend',
  mythic:     'Mythic',
};

export const CLASS_LABELS: Record<HeroClass, string> = {
  warrior:       'Warrior',
  runner:        'Runner',
  disciplined:   'Disciplined',
  'all-rounder': 'All-Rounder',
  berserker:     'Berserker',
  endurance:     'Endurance',
};

export const CLASS_SYMBOLS: Record<string, string> = {
  hercules:   '⚡',
  atalanta:   '🏹',
  yoshitsune: '⚔',
  mulan:      '🌸',
  cuchulainn: '🔥',
  boudicca:   '🛡',
};
