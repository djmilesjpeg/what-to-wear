import {
  CloudRain,
  Layers,
  Shirt,
  Snowflake,
  Sun,
  Thermometer,
  ThermometerSnowflake,
  ThermometerSun,
  Umbrella,
  UmbrellaOff,
  Wind,
} from 'lucide-react';

export const TONE_CLASSES = {
  warm: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  mild: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  cool: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  cold: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300',
  rain: 'bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

// Tops and umbrellas are keyed by outcome; bottoms by *why* (rain vs. cold pants look different).
const VISUALS = {
  top: {
    tshirt: { Icon: Shirt, tone: 'warm' },
    longsleeve: { Icon: Shirt, tone: 'mild' },
    sweater: { Icon: Shirt, tone: 'cool' },
    thermal: { Icon: Shirt, tone: 'cold' },
  },
  outerwear: {
    none: { Icon: Sun, tone: 'warm' },
    light: { Icon: Wind, tone: 'mild' },
    jacket: { Icon: Layers, tone: 'cool' },
    heavy: { Icon: Snowflake, tone: 'cold' },
  },
  bottoms: {
    warm: { Icon: ThermometerSun, tone: 'warm' },
    muggy: { Icon: ThermometerSun, tone: 'warm' },
    rain: { Icon: CloudRain, tone: 'rain' },
    dry: { Icon: Thermometer, tone: 'mild' },
    cool: { Icon: Thermometer, tone: 'cool' },
    cold: { Icon: ThermometerSnowflake, tone: 'cold' },
  },
  umbrella: {
    bring: { Icon: Umbrella, tone: 'rain' },
    leave: { Icon: UmbrellaOff, tone: 'neutral' },
  },
};

/** Icon and color tone for one category of an `evaluateOutfit` result. */
export function getVisual(category, result) {
  return VISUALS[category][category === 'bottoms' ? result.why : result.id];
}
