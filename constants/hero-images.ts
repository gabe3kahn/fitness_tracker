import { ImageSourcePropType } from 'react-native';
import { HeroTier } from './heroes';

type HeroImageMap = Record<HeroTier, ImageSourcePropType>;

const HERO_IMAGES: Partial<Record<string, HeroImageMap>> = {
  hercules: {
    novice:     require('../assets/heroes/hercules/hercules_novice.png'),
    apprentice: require('../assets/heroes/hercules/hercules_apprentice.png'),
    champion:   require('../assets/heroes/hercules/hercules_champion.png'),
    legend:     require('../assets/heroes/hercules/hercules_legend.png'),
    mythic:     require('../assets/heroes/hercules/hercules_mythic.png'),
  },
  atalanta: {
    novice:     require('../assets/heroes/atalanta/atalanta_novice.png'),
    apprentice: require('../assets/heroes/atalanta/atalanta_apprentice.png'),
    champion:   require('../assets/heroes/atalanta/atalanta_champion.png'),
    legend:     require('../assets/heroes/atalanta/atalanta_legend.png'),
    mythic:     require('../assets/heroes/atalanta/atalanta_mythic.png'),
  },
  yoshitsune: {
    novice:     require('../assets/heroes/minamoto_no_yoshitsune/yoshitsune_novice.png'),
    apprentice: require('../assets/heroes/minamoto_no_yoshitsune/yoshitsune_apprentice.png'),
    champion:   require('../assets/heroes/minamoto_no_yoshitsune/yoshitsune_champion.png'),
    legend:     require('../assets/heroes/minamoto_no_yoshitsune/yoshitsune_legend.png'),
    mythic:     require('../assets/heroes/minamoto_no_yoshitsune/yoshitsune_mythic.png'),
  },
  mulan: {
    novice:     require('../assets/heroes/mulan/mulan_novice.png'),
    apprentice: require('../assets/heroes/mulan/mulan_apprentice.png'),
    champion:   require('../assets/heroes/mulan/mulan_champion.png'),
    legend:     require('../assets/heroes/mulan/mulan_legend.png'),
    mythic:     require('../assets/heroes/mulan/mulan_mythic.png'),
  },
  cuchulainn: {
    novice:     require('../assets/heroes/cuchulainn/cuchulainn_novice.png'),
    apprentice: require('../assets/heroes/cuchulainn/cuchulainn_apprentice.png'),
    champion:   require('../assets/heroes/cuchulainn/cuchulainn_champion.png'),
    legend:     require('../assets/heroes/cuchulainn/cuchulainn_legend.png'),
    mythic:     require('../assets/heroes/cuchulainn/cuchulainn_mythic.png'),
  },
  boudicca: {
    novice:     require('../assets/heroes/boudicca/boudicca_novice.png'),
    apprentice: require('../assets/heroes/boudicca/boudicca_apprentice.png'),
    champion:   require('../assets/heroes/boudicca/boudicca_champion.png'),
    legend:     require('../assets/heroes/boudicca/boudicca_legend.png'),
    mythic:     require('../assets/heroes/boudicca/boudicca_mythic.png'),
  },
};

export function getHeroImage(heroId: string, tier: HeroTier): ImageSourcePropType | null {
  return HERO_IMAGES[heroId]?.[tier] ?? null;
}
