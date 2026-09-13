#!/usr/bin/env node
/**
 * Morning outfit alert: fetch the forecast, run the shared decision matrix, send the verdict to Telegram.
 *
 * Scheduled by .github/workflows/morning-alert.yml. To try it locally (reads ./.env when present):
 *   npm run alert:dry   # print the message only; Telegram variables not required
 *   npm run alert       # send it for real
 *
 * Required env: LATITUDE, LONGITUDE, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * Optional env: TEMP_UNIT (F | C, default F), LOCATION_NAME, TOLERANCE (cold | normal | warm)
 */
import { setTimeout as sleep } from 'node:timers/promises';

import { fetchForecast } from '../src/utils/openMeteo.js';
import { evaluateOutfit, formatTemp, formatWind, TOLERANCES } from '../src/utils/wardrobeLogic.js';

const DRY_RUN = process.argv.includes('--dry-run');
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [3_000, 10_000];

/* ------------------------------------------------------------------ config -- */

function readConfig(env) {
  const problems = [];

  const coordinate = (name, limit) => {
    const raw = env[name]?.trim();
    const value = Number(raw);
    if (!raw) problems.push(`${name} is not set.`);
    else if (!Number.isFinite(value) || Math.abs(value) > limit) {
      problems.push(`${name} must be a decimal number between -${limit} and ${limit}.`);
    }
    return value;
  };

  const latitude = coordinate('LATITUDE', 90);
  const longitude = coordinate('LONGITUDE', 180);
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!DRY_RUN && !botToken) problems.push('TELEGRAM_BOT_TOKEN is not set.');
  if (!DRY_RUN && !chatId) problems.push('TELEGRAM_CHAT_ID is not set.');

  if (problems.length) {
    throw new Error(`Missing or invalid configuration:\n   - ${problems.join('\n   - ')}`);
  }

  return {
    latitude,
    longitude,
    botToken,
    chatId,
    unit: readChoice(env, 'TEMP_UNIT', ['F', 'C'], 'F'),
    tolerance: readChoice(env, 'TOLERANCE', Object.keys(TOLERANCES), 'normal'),
    locationName: env.LOCATION_NAME?.trim() ?? '',
  };
}

/** Optional settings fall back to their default (with a warning) instead of skipping the alert. */
function readChoice(env, name, allowed, fallback) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const match = allowed.find((option) => option.toLowerCase() === raw.toLowerCase());
  if (match) return match;
  console.warn(`⚠️  Ignoring ${name}="${raw}" (expected ${allowed.join(' or ')}); using ${fallback}.`);
  return fallback;
}

/* ----------------------------------------------------------------- message -- */

const MARKDOWN_V2_RESERVED = /[_*[\]()~`>#+\-=|{}.!\\]/g;

const markdown = {
  text: (value) => String(value).replace(MARKDOWN_V2_RESERVED, '\\$&'),
  bold: (value) => `*${markdown.text(value)}*`,
  italic: (value) => `_${markdown.text(value)}_`,
};

const plain = { text: String, bold: String, italic: String };

function headerEmoji({ umbrella, outerwear }) {
  if (umbrella.why === 'now') return '🌧️';
  if (umbrella.id === 'bring') return '🌦️';
  if (outerwear.id === 'heavy') return '🥶';
  return '🌤️';
}

function composeMessage({ locationName, unit, conditions, outfit }, fmt) {
  const { top, outerwear, bottoms, umbrella, muggy, rain } = outfit;
  const title = locationName ? `Morning Outfit Check: ${locationName}` : 'Morning Outfit Check';
  const feels = formatTemp(conditions.feelsLikeF, unit);
  const dew = formatTemp(conditions.dewPointF, unit);
  const umbrellaText =
    umbrella.why === 'now'
      ? 'Bring it (already coming down)'
      : `${umbrella.id === 'bring' ? 'Bring it' : 'Not needed'} (${rain.chance}% rain)`;

  const lines = [
    `${headerEmoji(outfit)} ${fmt.bold(title)}`,
    `🌡️ ${fmt.text(`Feels like ${feels} • Dew Point: ${dew} (${muggy.label})`)}`,
    '',
    `• ${fmt.bold('Top:')} ${fmt.text(top.label)}`,
    `• ${fmt.bold('Layer:')} ${fmt.text(outerwear.label)}`,
    `• ${fmt.bold('Bottoms:')} ${fmt.text(bottoms.label)}`,
    `• ${fmt.bold('Umbrella:')} ${fmt.text(umbrellaText)}`,
  ];

  const tips = [];
  if (outfit.windy) tips.push(`💨 ${fmt.text(`Windy out: ${formatWind(conditions.windMph, unit)} sustained`)}`);
  if (muggy.advice) tips.push(`💧 ${fmt.italic(muggy.advice)}`);
  if (tips.length) lines.push('', ...tips);

  return lines.join('\n');
}

/* ---------------------------------------------------------------- delivery -- */

const describeError = (error) =>
  error?.cause?.message ? `${error.message} (${error.cause.message})` : String(error?.message ?? error);

// Network failures, timeouts, rate limits, and 5xx are worth retrying; other 4xx errors are not.
const isRetryable = (error) => error.status === undefined || error.status === 429 || error.status >= 500;

async function withRetry(label, task) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isRetryable(error)) throw error;
      console.warn(`⚠️  ${label} attempt ${attempt + 1} failed: ${describeError(error)}. Retrying in ${delay / 1000}s…`);
      await sleep(delay);
    }
  }
}

function explainTelegramError(status, description = 'Unknown error') {
  let hint = '';
  if (status === 401 || status === 404) {
    hint = ' Double-check TELEGRAM_BOT_TOKEN (copy it again from @BotFather).';
  } else if (/chat not found/i.test(description)) {
    hint = ' Double-check TELEGRAM_CHAT_ID, and make sure you sent your bot a message first.';
  } else if (/blocked by the user/i.test(description)) {
    hint = ' Unblock the bot in Telegram, then run the workflow again.';
  }
  return `Telegram API error ${status}: ${description}.${hint}`;
}

function postToTelegram(botToken, payload) {
  return withRetry('Telegram', async () => {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.ok) return body;
    const error = new Error(explainTelegramError(response.status, body.description));
    error.status = response.status;
    error.description = body.description ?? '';
    throw error;
  });
}

async function sendToTelegram({ botToken, chatId }, message) {
  try {
    await postToTelegram(botToken, { chat_id: chatId, text: message.markdown, parse_mode: 'MarkdownV2' });
  } catch (error) {
    // Formatting must never cost you the alert: if Telegram rejects the Markdown, send plain text.
    if (!/can't parse entities/i.test(error.description ?? '')) throw error;
    console.warn('⚠️  Telegram rejected the Markdown formatting; resending as plain text.');
    await postToTelegram(botToken, { chat_id: chatId, text: message.plain });
  }
}

/* -------------------------------------------------------------------- main -- */

async function main() {
  const config = readConfig(process.env);

  // Coordinates and location stay out of the logs: Actions logs are public on public repos.
  console.log('⛅ Fetching the forecast from Open-Meteo…');
  const conditions = await withRetry('Open-Meteo', () =>
    fetchForecast(config.latitude, config.longitude, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }),
  );
  const outfit = evaluateOutfit(conditions, { unit: config.unit, tolerance: config.tolerance });

  const data = { ...config, conditions, outfit };
  const message = { markdown: composeMessage(data, markdown), plain: composeMessage(data, plain) };

  if (DRY_RUN) {
    console.log(`\n${message.plain}\n\n🧪 Dry run: nothing was sent to Telegram.`);
    return;
  }

  await sendToTelegram(config, message);
  console.log('✅ Outfit alert sent to Telegram.');
}

main().catch((error) => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const text = describeError(error);
  console.error(`❌ ${token ? text.replaceAll(token, '[redacted]') : text}`);
  process.exitCode = 1;
});
