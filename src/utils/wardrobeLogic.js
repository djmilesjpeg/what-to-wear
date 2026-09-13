/**
 * What to Wear Right Now — the outfit decision matrix.
 *
 * Single source of truth for every threshold, shared by the React dashboard and
 * scripts/daily-alert.js. Keep it dependency-free ESM with no browser or Node APIs.
 *
 * Thresholds are canonical in °F. Readings are rounded to whole degrees before they are
 * compared, so the number people see ("Feels like 70°F") always agrees with the rule that fired.
 */

/**
 * @typedef {object} Conditions  Produced by parseForecast() in openMeteo.js.
 * @property {number} feelsLikeF       Apparent temperature, °F.
 * @property {number} dewPointF        Dew point, °F.
 * @property {number} windMph          Sustained 10 m wind speed, mph.
 * @property {number} precipitationMm  Precipitation falling right now, mm.
 * @property {number} [rainMm]         Rain portion of the above, mm.
 * @property {{ time: string, precipitationProbability: number | null }[]} hourly  Current hour first.
 */

/* ------------------------------------------------------------------ units -- */

export const cToF = (celsius) => (celsius * 9) / 5 + 32;
export const fToC = (fahrenheit) => ((fahrenheit - 32) * 5) / 9;
export const kmhToMph = (kmh) => kmh / 1.609344;
export const mphToKmh = (mph) => mph * 1.609344;

/** °F reading → "62°F" or "17°C". */
export function formatTemp(tempF, unit = 'F') {
  return `${Math.round(unit === 'C' ? fToC(tempF) : tempF)}°${unit}`;
}

/** mph reading → "12 mph" for °F users, "19 km/h" for °C users. */
export function formatWind(windMph, unit = 'F') {
  return unit === 'C' ? `${Math.round(mphToKmh(windMph))} km/h` : `${Math.round(windMph)} mph`;
}

/** Tolerance shift in °F → "+4°F" or "−2°C". */
export function formatTempShift(shiftF, unit = 'F') {
  const amount = Math.round(Math.abs(unit === 'C' ? (shiftF * 5) / 9 : shiftF));
  return `${shiftF < 0 ? '−' : '+'}${amount}°${unit}`;
}

/** Location-local ISO time ("2026-09-12T15:00") → "3 PM" for °F users, "15:00" for °C users. */
export function formatHour(isoTime, unit = 'F') {
  const hours = Number(isoTime.slice(11, 13));
  const minutes = isoTime.slice(14, 16) || '00';
  if (unit === 'C') return `${String(hours).padStart(2, '0')}:${minutes}`;
  const hour12 = hours % 12 || 12;
  return `${minutes === '00' ? hour12 : `${hour12}:${minutes}`} ${hours < 12 ? 'AM' : 'PM'}`;
}

/* ------------------------------------------------------------- thresholds -- */

/** Personal tolerance shifts every feels-like threshold: "Runs Cold" needs 4°F more warmth. */
export const TOLERANCES = {
  cold: { label: 'Runs Cold', shiftF: 4 },
  normal: { label: 'Normal', shiftF: 0 },
  warm: { label: 'Runs Warm', shiftF: -4 },
};

/** Feels-like values are inclusive lower bounds in °F, before the tolerance shift. */
export const THRESHOLDS = {
  top: { tshirt: 70, tshirtIfMuggy: 66, longSleeve: 60, sweater: 46 },
  outerwear: { none: 68, lightLayer: 56, jacket: 40, windyLayerBelow: 74 },
  bottoms: { shorts: 72, shortsIfMuggy: 67 },
  muggyDewPointF: 62, // unlocks short sleeves and shorts a few degrees early
  windyMph: 18, // sustained wind above this earns a windbreaker in the lower 70s
  pantsRainChance: 50, // pants when the rain chance is above this (%)
  umbrellaRainChance: 35, // umbrella when the rain chance is at or above this (%)
  rainWindowHours: 4, // the current hour plus the next 3
};

/** Dew point comfort zones, driest first. `minF` is inclusive, `maxF` exclusive. */
export const DEW_POINT_ZONES = [
  {
    id: 'crisp',
    label: 'Crisp & Dry',
    minF: -Infinity,
    maxF: 55,
    description: 'Pleasant, non-sticky air.',
  },
  {
    id: 'comfortable',
    label: 'Comfortable',
    minF: 55,
    maxF: 65,
    description: 'A little moisture in the air, but nothing sticky.',
  },
  {
    id: 'sticky',
    label: 'Sticky / Humid',
    minF: 65,
    maxF: 70,
    description: 'Muggy enough that sweat lingers.',
    advice: 'Go for breathable fabrics like cotton or linen.',
  },
  {
    id: 'tropical',
    label: 'Tropical / Oppressive',
    minF: 70,
    maxF: Infinity,
    description: 'Heavy, oppressive humidity.',
    advice: 'Wear your lightest, most breathable fabrics.',
  },
];

const OUTCOMES = {
  top: {
    tshirt: { label: 'T-Shirt / Tank', chip: 'T-Shirt' },
    longsleeve: { label: 'Long-Sleeve / Henley', chip: 'Long Sleeves' },
    sweater: { label: 'Sweater / Fleece', chip: 'Sweater' },
    thermal: { label: 'Thermal + Heavy Knit', chip: 'Thermal Layers' },
  },
  outerwear: {
    none: { label: 'None Needed', chip: 'No Jacket' },
    light: { label: 'Light Layer / Windbreaker', chip: 'Light Layer' },
    jacket: { label: 'Jacket / Coat', chip: 'Jacket' },
    heavy: { label: 'Heavy Winter Coat', chip: 'Heavy Coat' },
  },
  bottoms: {
    shorts: { label: 'Shorts', chip: 'Shorts' },
    pants: { label: 'Pants', chip: 'Pants' },
  },
  umbrella: {
    bring: { label: 'Bring It', chip: 'Bring Umbrella' },
    leave: { label: 'Leave It', chip: 'Leave Umbrella' },
  },
};

/* --------------------------------------------------------- decision matrix -- */
// `t` is the rounded feels-like temperature minus the tolerance shift (°F).

function pickTop(t, dewF) {
  const { tshirt, tshirtIfMuggy, longSleeve, sweater } = THRESHOLDS.top;
  if (t >= tshirt) return { id: 'tshirt', why: 'warm' };
  if (t >= tshirtIfMuggy && dewF >= THRESHOLDS.muggyDewPointF) return { id: 'tshirt', why: 'muggy' };
  if (t >= longSleeve) return { id: 'longsleeve' };
  if (t >= sweater) return { id: 'sweater' };
  return { id: 'thermal' };
}

function pickOuterwear(t, windMph) {
  const { none, lightLayer, jacket, windyLayerBelow } = THRESHOLDS.outerwear;
  if (t >= none) {
    const windy = windMph > THRESHOLDS.windyMph && t < windyLayerBelow;
    return windy ? { id: 'light', why: 'windy' } : { id: 'none' };
  }
  if (t >= lightLayer) return { id: 'light', why: 'cool' };
  if (t >= jacket) return { id: 'jacket' };
  return { id: 'heavy' };
}

function pickBottoms(t, dewF, rainChance) {
  const { shorts, shortsIfMuggy } = THRESHOLDS.bottoms;
  const warm = t >= shorts;
  const muggy = t >= shortsIfMuggy && dewF >= THRESHOLDS.muggyDewPointF;
  if (!warm && !muggy) {
    const why = t >= shortsIfMuggy ? 'dry' : t >= THRESHOLDS.outerwear.lightLayer ? 'cool' : 'cold';
    return { id: 'pants', why };
  }
  if (rainChance > THRESHOLDS.pantsRainChance) return { id: 'pants', why: 'rain' };
  return { id: 'shorts', why: warm ? 'warm' : 'muggy' };
}

function pickUmbrella(precipitationMm, rainChance) {
  if (precipitationMm > 0) return { id: 'bring', why: 'now' };
  if (rainChance >= THRESHOLDS.umbrellaRainChance) return { id: 'bring', why: 'chance' };
  return { id: 'leave' };
}

/** Highest precipitation probability across the current hour and the next three. */
export function getRainOutlook(hourly = []) {
  let peak = { chance: 0, time: null, index: -1 };
  hourly.slice(0, THRESHOLDS.rainWindowHours).forEach((hour, index) => {
    const chance = hour.precipitationProbability;
    if (Number.isFinite(chance) && (peak.index === -1 || chance > peak.chance)) {
      peak = { chance, time: hour.time, index };
    }
  });
  return peak;
}

export function getDewPointZone(dewPointF) {
  const dewF = Math.round(dewPointF);
  return DEW_POINT_ZONES.find((zone) => dewF >= zone.minF && dewF < zone.maxF) ?? DEW_POINT_ZONES[0];
}

/* ------------------------------------------------------------ explanations -- */

function explainTop({ id, why }, { feels, dew }) {
  switch (id) {
    case 'tshirt':
      return why === 'muggy'
        ? `Feels like ${feels} with humid air (${dew} dew point), so short sleeves will breathe better`
        : `Feels like ${feels}, warm enough for short sleeves`;
    case 'longsleeve':
      return `Feels like ${feels}: mild, but a touch cool for short sleeves`;
    case 'sweater':
      return `Feels like ${feels}, cool enough that you'll want a sweater or fleece`;
    default:
      return `Feels like ${feels}, cold enough for a thermal base layer under a heavy knit`;
  }
}

function explainOuterwear({ id, why }, { feels, wind }) {
  switch (id) {
    case 'none':
      return `Feels like ${feels}, so you can skip the extra layer`;
    case 'light':
      return why === 'windy'
        ? `Feels like ${feels}, but ${wind} winds make a windbreaker worth it`
        : `Feels like ${feels}, so a light layer or windbreaker takes the edge off`;
    case 'jacket':
      return `Feels like ${feels}, chilly enough for a real jacket or coat`;
    default:
      return `Feels like ${feels}, so bundle up in your heaviest winter coat`;
  }
}

function explainBottoms({ why }, { feels, dew, rain }) {
  switch (why) {
    case 'warm':
      return `Feels like ${feels}, which is solid shorts weather`;
    case 'muggy':
      return `Feels like ${feels} with humid air (${dew} dew point), so shorts will keep you cooler`;
    case 'rain':
      return `Warm enough for shorts, but a ${rain.chance}% rain chance makes pants the safer call`;
    case 'dry':
      return `Feels like ${feels} with dry air, just shy of shorts weather`;
    case 'cool':
      return `Feels like ${feels}, a bit too cool for shorts`;
    default:
      return `Feels like ${feels}, which is definitely pants weather`;
  }
}

function explainUmbrella({ why }, { rain, unit }) {
  if (why === 'now') return "It's already coming down out there, so bring one";
  if (why === 'chance') {
    const when = rain.index === 0 ? 'right now' : `around ${formatHour(rain.time, unit)}`;
    return `Rain chance peaks at ${rain.chance}% ${when}, so bring one to be safe`;
  }
  return rain.chance === 0
    ? 'No rain in the forecast for the next 3 hours, so leave it at home'
    : `Rain chance tops out at ${rain.chance}% over the next 3 hours, so leave it at home`;
}

const EXPLAIN = { top: explainTop, outerwear: explainOuterwear, bottoms: explainBottoms, umbrella: explainUmbrella };

/* --------------------------------------------------------------- public API -- */

/**
 * Runs the full decision matrix.
 *
 * @param {Conditions} conditions
 * @param {{ tolerance?: 'cold' | 'normal' | 'warm', unit?: 'F' | 'C' }} [options]
 *   `unit` only changes how explanations are worded; decisions are always made in °F.
 */
export function evaluateOutfit(conditions, { tolerance = 'normal', unit = 'F' } = {}) {
  const toleranceId = Object.hasOwn(TOLERANCES, tolerance) ? tolerance : 'normal';
  const feelsF = Math.round(conditions.feelsLikeF);
  const dewF = Math.round(conditions.dewPointF);
  const windMph = Math.round(conditions.windMph);
  const precipitationMm = Math.max(conditions.precipitationMm ?? 0, conditions.rainMm ?? 0);
  const rain = getRainOutlook(conditions.hourly);
  const t = feelsF - TOLERANCES[toleranceId].shiftF;

  const context = {
    unit,
    rain,
    feels: formatTemp(conditions.feelsLikeF, unit),
    dew: formatTemp(conditions.dewPointF, unit),
    wind: formatWind(conditions.windMph, unit),
  };

  // `baseline` is what a "Normal" person would get, so we can say when tolerance changed the call.
  const describe = (category, pick, baseline) => {
    const adjusted = baseline && baseline.id !== pick.id;
    const note = adjusted ? ` (adjusted because you run ${toleranceId})` : '';
    return { ...pick, ...OUTCOMES[category][pick.id], reason: `${EXPLAIN[category](pick, context)}${note}.` };
  };

  return {
    top: describe('top', pickTop(t, dewF), pickTop(feelsF, dewF)),
    outerwear: describe('outerwear', pickOuterwear(t, windMph), pickOuterwear(feelsF, windMph)),
    bottoms: describe('bottoms', pickBottoms(t, dewF, rain.chance), pickBottoms(feelsF, dewF, rain.chance)),
    umbrella: describe('umbrella', pickUmbrella(precipitationMm, rain.chance)),
    muggy: getDewPointZone(conditions.dewPointF),
    rain,
    windy: windMph > THRESHOLDS.windyMph,
    tolerance: toleranceId,
  };
}
