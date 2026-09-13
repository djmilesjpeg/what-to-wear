import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildForecastUrl, parseForecast } from '../src/utils/openMeteo.js';
import {
  cToF,
  evaluateOutfit,
  formatHour,
  formatTemp,
  formatTempShift,
  formatWind,
  getDewPointZone,
  getRainOutlook,
} from '../src/utils/wardrobeLogic.js';

const forecastHours = (...chances) =>
  chances.map((precipitationProbability, i) => ({
    time: `2026-09-12T${String(7 + i).padStart(2, '0')}:00`,
    precipitationProbability,
  }));

/** Mild, dry, calm, rain-free defaults. Tests override only what they care about. */
const evaluate = (overrides = {}, options = undefined) =>
  evaluateOutfit(
    {
      feelsLikeF: 64,
      dewPointF: 45,
      windMph: 5,
      precipitationMm: 0,
      rainMm: 0,
      hourly: forecastHours(0, 0, 0, 0),
      ...overrides,
    },
    options,
  );

describe('top', () => {
  const cases = [
    // [feels like °F, dew point °F, expected]
    [70, 45, 'tshirt'],
    [69, 61, 'longsleeve'],
    [69, 62, 'tshirt'], // muggy exception
    [66, 62, 'tshirt'],
    [65, 64, 'longsleeve'], // muggy exception starts at 66
    [60, 45, 'longsleeve'],
    [59, 45, 'sweater'],
    [46, 40, 'sweater'],
    [45, 30, 'thermal'],
    [69.5, 45, 'tshirt'], // rounds to 70
    [69.4, 45, 'longsleeve'],
  ];
  for (const [feelsLikeF, dewPointF, expected] of cases) {
    it(`feels ${feelsLikeF}°F, dew point ${dewPointF}°F → ${expected}`, () => {
      assert.equal(evaluate({ feelsLikeF, dewPointF }).top.id, expected);
    });
  }

  it('explains the humidity exception without borrowing Muggy Meter labels', () => {
    assert.match(evaluate({ feelsLikeF: 67, dewPointF: 63 }).top.reason, /humid air \(63°F dew point\)/);
  });
});

describe('outerwear', () => {
  const cases = [
    // [feels like °F, wind mph, expected]
    [68, 5, 'none'],
    [67, 5, 'light'],
    [56, 5, 'light'],
    [55, 5, 'jacket'],
    [40, 5, 'jacket'],
    [39, 5, 'heavy'],
    [69, 25, 'light'], // windy lower 70s (and just below)
    [73, 19, 'light'],
    [74, 25, 'none'], // mid 70s: wind no longer adds a layer
    [72, 18, 'none'], // must be above 18 mph
    [72, 18.4, 'none'], // rounds to 18
  ];
  for (const [feelsLikeF, windMph, expected] of cases) {
    it(`feels ${feelsLikeF}°F, wind ${windMph} mph → ${expected}`, () => {
      assert.equal(evaluate({ feelsLikeF, windMph }).outerwear.id, expected);
    });
  }

  it('explains when the wind is the reason', () => {
    const { outerwear } = evaluate({ feelsLikeF: 72, windMph: 22 });
    assert.equal(outerwear.why, 'windy');
    assert.match(outerwear.reason, /22 mph winds/);
  });
});

describe('bottoms', () => {
  const cases = [
    // [feels like °F, dew point °F, peak rain chance %, expected id, expected why]
    [72, 45, 0, 'shorts', 'warm'],
    [71, 61, 0, 'pants', 'dry'],
    [67, 62, 0, 'shorts', 'muggy'],
    [66, 64, 0, 'pants', 'cool'],
    [85, 60, 51, 'pants', 'rain'],
    [85, 60, 50, 'shorts', 'warm'],
    [50, 40, 80, 'pants', 'cold'], // temperature, not rain, is the headline reason
  ];
  for (const [feelsLikeF, dewPointF, chance, id, why] of cases) {
    it(`feels ${feelsLikeF}°F, dew point ${dewPointF}°F, rain ${chance}% → ${id} (${why})`, () => {
      const { bottoms } = evaluate({ feelsLikeF, dewPointF, hourly: forecastHours(chance, 0, 0, 0) });
      assert.deepEqual([bottoms.id, bottoms.why], [id, why]);
    });
  }
});

describe('umbrella', () => {
  it('brings it when precipitation is already falling', () => {
    assert.equal(evaluate({ precipitationMm: 0.1 }).umbrella.why, 'now');
    assert.equal(evaluate({ rainMm: 0.2 }).umbrella.why, 'now');
  });

  it('brings it at a 35% chance and names the peak hour', () => {
    const { umbrella, rain } = evaluate({ hourly: forecastHours(0, 10, 35, 0) });
    assert.deepEqual([umbrella.id, rain.chance, rain.index], ['bring', 35, 2]);
    assert.match(umbrella.reason, /35% around 9 AM/);
    assert.match(evaluate({ hourly: forecastHours(0, 10, 35, 0) }, { unit: 'C' }).umbrella.reason, /around 09:00/);
  });

  it('says "right now" when the current hour is the peak', () => {
    assert.match(evaluate({ hourly: forecastHours(60, 10, 0, 0) }).umbrella.reason, /60% right now/);
  });

  it('leaves it below 35%', () => {
    assert.equal(evaluate({ hourly: forecastHours(34, 34, 34, 34) }).umbrella.id, 'leave');
  });

  it('only looks at the current hour plus the next three', () => {
    assert.equal(evaluate({ hourly: forecastHours(0, 0, 0, 0, 90) }).umbrella.id, 'leave');
  });

  it('ignores missing probabilities', () => {
    assert.deepEqual(getRainOutlook(forecastHours(null, 40, null, null)), {
      chance: 40,
      time: '2026-09-12T08:00',
      index: 1,
    });
    assert.deepEqual(getRainOutlook([]), { chance: 0, time: null, index: -1 });
  });
});

describe('dew point muggy meter', () => {
  const cases = [
    [54, 'crisp'],
    [54.5, 'comfortable'], // rounds to 55
    [55, 'comfortable'],
    [64, 'comfortable'],
    [65, 'sticky'],
    [69, 'sticky'],
    [70, 'tropical'],
    [-10, 'crisp'],
  ];
  for (const [dewPointF, expected] of cases) {
    it(`dew point ${dewPointF}°F → ${expected}`, () => {
      assert.equal(getDewPointZone(dewPointF).id, expected);
    });
  }

  it('recommends breathable fabrics once it gets sticky', () => {
    assert.equal(getDewPointZone(60).advice, undefined);
    assert.match(getDewPointZone(66).advice, /breathable/);
  });
});

describe('personal tolerance', () => {
  it('runs cold: shifts thresholds up 4°F and says so', () => {
    const { top } = evaluate({ feelsLikeF: 72 }, { tolerance: 'cold' });
    assert.equal(top.id, 'longsleeve');
    assert.match(top.reason, /adjusted because you run cold/);
    assert.equal(evaluate({ feelsLikeF: 70 }, { tolerance: 'cold' }).outerwear.id, 'light');
  });

  it('runs warm: shifts thresholds down 4°F', () => {
    const { top, bottoms } = evaluate({ feelsLikeF: 68 }, { tolerance: 'warm' });
    assert.equal(top.id, 'tshirt');
    assert.equal(bottoms.id, 'shorts');
    assert.match(top.reason, /run warm/);
  });

  it('only mentions tolerance when it changed the call', () => {
    assert.doesNotMatch(evaluate({ feelsLikeF: 90 }, { tolerance: 'cold' }).top.reason, /adjusted/);
  });

  it('leaves dew point, wind speed, and rain rules alone', () => {
    const outfit = evaluate({ feelsLikeF: 80, dewPointF: 65, hourly: forecastHours(35) }, { tolerance: 'warm' });
    assert.equal(outfit.muggy.id, 'sticky');
    assert.equal(outfit.umbrella.id, 'bring');
  });

  it('falls back to normal for unknown values', () => {
    assert.equal(evaluate({ feelsLikeF: 70 }, { tolerance: 'toString' }).top.id, 'tshirt');
  });
});

describe('formatting', () => {
  it('formats temperatures from the precise reading', () => {
    assert.equal(formatTemp(62.06), '62°F');
    assert.equal(formatTemp(cToF(16.4), 'C'), '16°C');
    assert.equal(formatTemp(cToF(-0.3), 'C'), '0°C');
    assert.equal(formatWind(10, 'C'), '16 km/h');
    assert.equal(formatTempShift(4), '+4°F');
    assert.equal(formatTempShift(-4, 'C'), '−2°C');
  });

  it('formats location-local hours', () => {
    assert.equal(formatHour('2026-09-12T00:00'), '12 AM');
    assert.equal(formatHour('2026-09-12T12:00'), '12 PM');
    assert.equal(formatHour('2026-09-12T15:30'), '3:30 PM');
    assert.equal(formatHour('2026-09-12T09:00', 'C'), '09:00');
  });

  it('words explanations in the chosen unit', () => {
    assert.match(evaluate({ feelsLikeF: cToF(18) }, { unit: 'C' }).top.reason, /^Feels like 18°C/);
  });
});

describe('Open-Meteo parsing', () => {
  // Trimmed live response for New York (2026-09-12).
  const sample = {
    timezone: 'America/New_York',
    current: {
      time: '2026-09-12T15:00',
      temperature_2m: 25.5,
      apparent_temperature: 25.7,
      dew_point_2m: 16.6,
      relative_humidity_2m: 58,
      precipitation: 0,
      rain: 0,
      wind_speed_10m: 18.6,
    },
    hourly: {
      time: ['2026-09-12T15:00', '2026-09-12T16:00', '2026-09-12T17:00', '2026-09-12T18:00'],
      precipitation_probability: [0, 1, 1, 1],
      temperature_2m: [25.5, 25.1, 24.3, 23.4],
      dew_point_2m: [16.6, 15.7, 16.1, 15.2],
    },
  };

  it('requests exactly the fields the matrix needs', () => {
    const url = buildForecastUrl(40.71, -74.01);
    assert.match(url, /latitude=40\.71&longitude=-74\.01/);
    assert.match(
      url,
      /current=temperature_2m,apparent_temperature,dew_point_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m/,
    );
    assert.match(url, /hourly=precipitation_probability,temperature_2m,dew_point_2m&forecast_hours=4/);
  });

  it('normalizes to °F and mph, then evaluates end to end', () => {
    const conditions = parseForecast(sample);
    assert.equal(Math.round(conditions.feelsLikeF), 78);
    assert.equal(Math.round(conditions.windMph), 12);
    assert.equal(conditions.hourly.length, 4);

    const outfit = evaluateOutfit(conditions);
    assert.deepEqual(
      [outfit.top.id, outfit.outerwear.id, outfit.bottoms.id, outfit.umbrella.id, outfit.muggy.id],
      ['tshirt', 'none', 'shorts', 'leave', 'comfortable'],
    );
  });

  it('rejects responses without current conditions', () => {
    assert.throws(() => parseForecast({ hourly: sample.hourly }), /missing current conditions/);
  });
});
