# Expense Tracker

**Expense Tracker 2.0.0** is a local-first mobile app for personal spending, work expenses, shared costs, scheduled payments, and investments. It is built with Expo SDK 57, React Native, TypeScript, and Expo Router. Records are stored in an on-device SQLite database.

## Features

- **Personal expenses:** Add and edit expenses with dates, categories, subcategories, and payment methods. Search and filter records on the Personal screen.
- **Category budgets and insights:** Set monthly budgets per category. Explore category transactions, charts, large expenses, and comparisons with previous months. Spending Insights shows 3, 6, or 12 months of trends and monthly outflow.
- **Subscriptions and recurring expenses:** Track subscription due dates, mark payments as paid, skip a month, or defer a reminder. Monthly recurring expenses can create expense records automatically.
- **Investments:** Track monthly SIP plans and one-time investments separately from spending budgets. Record, edit, or delete contributions using the actual payment date. The Personal screen and Insights show expenses, investments, and their combined outflow.
- **Upcoming payments and reminders:** See SIPs, subscriptions, and recurring expenses in one upcoming list. Local notifications remind you before SIP and subscription due dates; change the reminder time or toggle each type in Settings.
- **Split expenses:** Create groups, add people and shared expenses, edit group details, and review suggested settlements.
- **Company expenses:** Manage employee details and record local conveyance, outstation travel, tour travel, phone, miscellaneous, hotel, and daily allowance expenses.
- **Receipts and reports:** Attach receipt images or PDFs to company expenses and export spreadsheets and PDFs.
- **Backup, security, and appearance:** Create a password-protected encrypted backup, restore it from Settings, enable app lock with device authentication, and choose light, dark, or system appearance.

## Requirements

- [Bun](https://bun.sh/) (`bun.lock` is the project lockfile)
- A Node.js version supported by Expo SDK 57
- A development build for the complete native feature set. Expo Go does not include every native module used by this app.

## Get started

Install dependencies and start Expo:

```bash
bun install
bun run start
```

Build and launch locally on a configured Android or iOS development machine:

```bash
bun run android
bun run ios
```

The native `android/` and `ios/` projects are generated through Expo Continuous Native Generation. Configure native behavior in `app.json` and config plugins.

## Build with EAS

Sign in and configure EAS Build:

```bash
bunx eas-cli login
bunx eas-cli build:configure
```

Create an installable preview build:

```bash
bunx eas-cli build --platform android --profile preview
```

EAS can generate and securely manage the Android signing key on the first build. iOS device and store builds require Apple signing credentials.

## Useful commands

```bash
bun run start              # Start Expo
bun run android            # Build and launch locally on Android
bun run ios                # Build and launch locally on iOS
bun run web                # Start the web target
bunx tsc --noEmit          # Type-check
bunx expo lint             # Lint
bun run test:regression    # Run backup and date-period regression checks
```

## Data and backups

App records stay in local SQLite storage. The encrypted backup flow creates a password-protected `.pab` file. Keep the password and a copy of the backup somewhere safe; the password is required for restore. Notification delivery depends on the device granting notification permission.

## Branding

The 2.0.0 icon and transparent wordmark are in [`assets/branding/`](assets/branding/). `app.json` uses the new icon for iOS, Android, web, and the splash screen. A fresh native build is needed to update an already installed launcher icon.

## Project structure

```text
src/
  app/            Expo Router screens and layouts
  components/     Reusable interface components
  constants/      Expense categories and app constants
  database/       SQLite setup, schema migrations, and seed data
  hooks/          Shared React hooks
  repositories/   Local data access
  services/       Backup, notifications, security, attachments, and exports
  theme/          Colors, spacing, and typography
  types/          Shared TypeScript types
  utils/          Formatting and validation helpers
modules/          Local Expo native modules
assets/           Branding and visual assets
docs/             Project notes and regression checklist
```

## Version

This repository is **2.0.0**. The Expo slug is `expense_tracker`; the Android application ID and iOS bundle identifier are both `com.expensetracker.app`.
