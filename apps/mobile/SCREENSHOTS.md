# App Store Screenshot Automation

Automated iOS App Store screenshot capture using [Maestro](https://maestro.mobile.dev/).

## Prerequisites

1. **Install Maestro CLI**:
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **Xcode with iOS Simulators** — install the devices you need:
   - iPhone 16 Pro Max (6.7" — required by Apple)
   - iPhone 14 Plus (6.5" — optional, auto-scaled from 6.7")
   - iPad Pro 13-inch M4 (if you support tablets)

3. **A development build** of the app installed on each simulator:
   ```bash
   npx expo run:ios --device "iPhone 16 Pro Max"
   ```

## Quick Start

### Single device (currently booted simulator)

```bash
npm run screenshots:single
```

### All required device sizes

```bash
npm run screenshots
```

### Custom test account

```bash
EMAIL=you@example.com PASSWORD=secret npm run screenshots
```

### Single specific device

```bash
./scripts/take-screenshots.sh "iPhone 16 Pro Max"
```

## What Gets Captured

The flow navigates through 7 key screens:

| # | Screenshot | Screen |
|---|-----------|--------|
| 1 | `01-login` | Login with gradient header |
| 2 | `02-dashboard` | Home dashboard with stats and apiaries |
| 3 | `03-apiary-detail` | Apiary with hive list |
| 4 | `04-hive-detail` | Full hive record |
| 5 | `05-new-inspection` | Inspection form |
| 6 | `06-tasks` | Task management |
| 7 | `07-settings` | User settings |

## Output

Screenshots are saved to `screenshots/<device-slug>/` (git-ignored):

```
screenshots/
  iphone-16-pro-max/
    01-login.png
    02-dashboard.png
    ...
  iphone-14-plus/
    ...
  ipad-pro-13-inch-m4/
    ...
```

## File Structure

```
.maestro/
  config.yaml                          # Shared Maestro configuration
  flows/
    01-appstore-screenshots.yaml       # Full screenshot flow (all 7 screens)
    02-login-only.yaml                 # Login screen only
scripts/
  take-screenshots.sh                  # Multi-device automation script
```

## Customizing Flows

Maestro uses YAML for flow definitions. Key commands:

- `tapOn:` — tap an element by text, id, or accessibility label
- `inputText:` — type text into the focused field
- `takeScreenshot:` — capture a screenshot with a filename
- `assertVisible:` — verify an element is on screen
- `scrollUntilVisible:` — scroll until an element appears
- `back` — press the back button / swipe back
- `waitForAnimationToEnd` — wait for animations to settle

Elements are targeted using `testID` props set on React Native components.
See the [Maestro docs](https://maestro.mobile.dev/api-reference) for the full API.

## Tips

- **Seed realistic data** before running — screenshots look best with 2-3 apiaries, a few hives, and some inspections.
- **Dark mode**: duplicate the flow and toggle the theme in Settings before capturing for a second set.
- **Landscape iPad**: add `- setDeviceOrientation: landscape` before `takeScreenshot` if needed.
