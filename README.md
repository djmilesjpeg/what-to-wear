# What to Wear Right Now

> Do I need a jacket, an umbrella, shorts, or a sweater? One glance, one answer.

A hyper-focused weather dashboard (Vite + React + Tailwind CSS) plus a morning outfit alert that GitHub Actions sends to Telegram. Both use the **same decision matrix** in [`src/utils/wardrobeLogic.js`](src/utils/wardrobeLogic.js), so the message on your phone always matches the dashboard.

- **Verdict banner:** the feels-like temperature plus summary chips like `T-Shirt` • `Pants` • `No Jacket` • `Leave Umbrella`
- **Four outfit cards:** Top, Outerwear, Bottoms, and Umbrella, each with a one-sentence reason and an hourly rain strip on the umbrella card
- **Muggy Meter:** a dew point gauge showing how sticky the air feels
- **Controls:** °F/°C, and a personal tolerance toggle (Runs Cold / Normal / Runs Warm) that shifts every temperature threshold by 4°F
- **Location:** browser geolocation on load, with a debounced city search as the fallback. Your location and preferences are saved in `localStorage`
- **Data:** [Open-Meteo](https://open-meteo.com/) with no API key, refreshed automatically every 15 minutes

## Quick start

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dashboard at http://localhost:5173 |
| `npm run build` | Build static files into `dist/`. Asset paths are relative, so it also works from a subpath such as GitHub Pages |
| `npm test` | Run the decision matrix tests with Node's built-in test runner |
| `npm run alert:dry` | Print today's Telegram message without sending it |
| `npm run alert` | Send the Telegram alert, reading settings from `.env` |

## The decision matrix

Rules use the **feels-like (apparent) temperature**, rounded to a whole °F, so the number you see always matches the rule that fired. **Runs Cold** adds 4°F to every temperature threshold below and **Runs Warm** subtracts 4°F. The dew point, wind, and rain rules never shift.

| Item | Recommendation | When |
| --- | --- | --- |
| **Top** | T-Shirt / Tank | 70°F and up, or 66–69°F when the dew point is 62°F or higher |
| | Long-Sleeve / Henley | 60–69°F with a lower dew point |
| | Sweater / Fleece | 46–59°F |
| | Thermal + Heavy Knit | Below 46°F |
| **Outerwear** | None | 68°F and up |
| | Light Layer / Windbreaker | 56–67°F, or 68–73°F when the wind is above 18 mph |
| | Jacket / Coat | 40–55°F |
| | Heavy Winter Coat | Below 40°F |
| **Bottoms** | Shorts | 72°F and up, or 67–71°F when the dew point is 62°F or higher |
| | Pants | Anything cooler, or any time the rain chance is above 50% |
| **Umbrella** | Bring It | Precipitation is already falling, or the rain chance is 35% or higher |
| | Leave It | Otherwise |

**Rain chance** is the highest hourly precipitation probability for the current hour and the next three.

**Muggy Meter (dew point):** below 55°F Crisp & Dry · 55–64°F Comfortable · 65–69°F Sticky / Humid, time for breathable fabrics · 70°F and up Tropical / Oppressive.

To tune a rule, edit `THRESHOLDS` in `wardrobeLogic.js` and run `npm test`. The dashboard and the alert both pick up the change.

## Morning Telegram alert

[`scripts/daily-alert.js`](scripts/daily-alert.js) is a dependency-free Node script. It fetches the forecast, runs the same matrix, and sends a message like this:

```text
🌤️ Morning Outfit Check: New York
🌡️ Feels like 62°F • Dew Point: 58°F (Comfortable)

• Top: Long-Sleeve / Henley
• Layer: Light Layer / Windbreaker
• Bottoms: Pants
• Umbrella: Not needed (0% rain)
```

Windy or muggy mornings add a tip line at the end.

### 1. Create a Telegram bot (free, about 2 minutes)

1. In Telegram, start a chat with [@BotFather](https://t.me/BotFather). Check for the blue verified badge.
2. Send `/newbot`. Choose a display name, then a username that ends in `bot`, such as `my_outfit_bot`.
3. BotFather replies with an HTTP API token like `123456789:AAH…`. That's your `TELEGRAM_BOT_TOKEN`. Keep it private: anyone with it can control your bot.

### 2. Get your chat ID

1. Open your new bot from the link BotFather sends, then tap **Start** or send it any message. Bots can't message you until you do.
2. In a browser, open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`, replacing `<YOUR_TOKEN>` with your token.
3. Find `"chat":{"id":123456789` in the response. That number is your `TELEGRAM_CHAT_ID`.

If you only see `"result":[]`, send the bot another message and refresh. To post to a group instead, add the bot to the group, send `/start@your_bot_username` there, and refresh. Group IDs are negative, for example `-1001234567890`.

### 3. Find your coordinates

In Google Maps, right-click your neighborhood and click the coordinates at the top of the menu to copy them. You can also look up a city with `https://geocoding-api.open-meteo.com/v1/search?name=Chicago&count=1`. Use decimal degrees; latitudes south of the equator and longitudes west of Greenwich are negative.

### 4. Add your GitHub repository secrets

Push this project to GitHub, then open your repository's **Settings → Secrets and variables → Actions**.

On the **Secrets** tab, click **New repository secret** for each of these:

| Secret | Example |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | `123456789:AAH…` |
| `TELEGRAM_CHAT_ID` | `123456789` |
| `LATITUDE` | `40.7128` |
| `LONGITUDE` | `-74.0060` |

Optionally, add any of these on the **Variables** tab:

| Variable | Values | Default |
| --- | --- | --- |
| `TEMP_UNIT` | `F` or `C` | `F` |
| `LOCATION_NAME` | A name for the message title, like `New York` | No name in the title |
| `TOLERANCE` | `cold`, `normal`, or `warm` | `normal` |

Your coordinates go in secrets because Actions logs are public on public repositories. The script never prints your location.

### 5. Send a test alert

Open the **Actions** tab, choose **Morning Outfit Alert**, and click **Run workflow**. The message should arrive within a few seconds. If the run fails, its log explains what to fix, such as a mistyped token or a chat that hasn't messaged the bot yet.

### 6. Choose your alert time

The schedule lives in [`.github/workflows/morning-alert.yml`](.github/workflows/morning-alert.yml). GitHub cron times are in **UTC** and don't adjust for daylight saving time. The default `0 11 * * *` arrives at 7:00 AM EDT in summer and 6:00 AM EST in winter.

| For 7:00 AM in… | Daylight saving time | Standard time |
| --- | --- | --- |
| New York | `0 11 * * *` | `0 12 * * *` |
| Chicago | `0 12 * * *` | `0 13 * * *` |
| Denver | `0 13 * * *` | `0 14 * * *` |
| Los Angeles | `0 14 * * *` | `0 15 * * *` |
| London | `0 6 * * *` | `0 7 * * *` |
| Berlin or Paris | `0 5 * * *` | `0 6 * * *` |

Good to know:

- Scheduled runs can start late when GitHub is busy, especially on the hour. An off-peak minute such as `17 11 * * *` usually arrives closer to on time.
- Schedules only run from your default branch.
- On public repositories, GitHub disables scheduled workflows after 60 days without repository activity. If the alerts stop, re-enable the workflow from the Actions tab.

### Run the alert locally

Copy `.env.example` to `.env` and fill in your values (`.env` is git-ignored). Then:

```bash
npm run alert:dry
```

This prints the message without sending it and doesn't need the Telegram values. When you're ready, `npm run alert` sends it for real.

## Project structure

```text
.github/workflows/morning-alert.yml   Daily schedule plus a manual "Run workflow" button
scripts/daily-alert.js                Telegram alert (native fetch, no dependencies)
src/utils/wardrobeLogic.js            Decision matrix, shared by the dashboard and the alert
src/utils/openMeteo.js                Open-Meteo client, also shared
src/hooks/                            Weather refresh, geolocation, localStorage, debounce
src/components/                       Verdict banner, outfit cards, Muggy Meter, search, controls
tests/wardrobeLogic.test.js           Threshold edge cases
```

## Credits

Weather data by [Open-Meteo.com](https://open-meteo.com/), licensed under CC BY 4.0. The free API is intended for non-commercial use. Icons by [Lucide](https://lucide.dev/).
