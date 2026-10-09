# Expense Tracker

**Expense Tracker v1.5.0 (Beta)** is a local-first mobile app for personal spending, work expenses, and shared costs with friends. It is built with Expo, React Native, TypeScript, and Expo Router. Expense records are stored in an on-device SQLite database.

## Features

- **Personal expenses:** Add, edit, and review expenses by date, category, subcategory, and payment method. Create personal categories in Settings, filter expenses, and see totals for the active filters.
- **Spending insights:** Review 3, 6, or 12 months of spending, compare this month with the same days last month, and explore category, subcategory, and payment method breakdowns.
- **Split expenses:** Create groups, add people and shared expenses, edit group details, and see suggested settlements to balance what each person has paid.
- **Company expenses:** Manage employee details and record local conveyance, outstation travel, tour travel, phone, miscellaneous, hotel, and daily allowance expenses.
- **Receipts and reports:** Attach receipt images or PDFs to company expenses and export company expense spreadsheets and attendance or attachment PDFs.
- **Backup and restore:** Create a password-protected encrypted backup and restore it from Settings.
- **Security and appearance:** Optionally enable device authentication for app access and choose light, dark, or system appearance.

## Requirements

- [Bun](https://bun.sh/) (the project uses `bun.lock`)
- A Node.js version supported by the installed Expo SDK
- Android Studio for local Android builds or Xcode for local iOS builds. EAS Build can build in the cloud.

## Get started

Install dependencies and start Expo:

```bash
bun install
bun run start
```

This app includes native modules for SQLite, secure storage, cryptography, and file handling. Use a development build to run the complete app on a device or emulator; Expo Go does not include every native module used here.

```bash
bun run android
bun run ios
```

The native `android/` and `ios/` projects are generated with Expo Continuous Native Generation. Configure native behavior through `app.json` and config plugins.

## Signed beta builds with EAS

Sign in to an Expo account and configure EAS Build once:

```bash
bunx eas-cli login
bunx eas-cli build:configure
```

Build an installable Android beta build:

```bash
bunx eas-cli build --platform android --profile preview
```

On the first Android build, EAS can generate and securely manage the app keystore. Keep using the same keystore for future updates. iOS device and store builds require Apple signing credentials; App Store distribution also requires Apple Developer Program access.

## Useful commands

```bash
bun run start              # Start the Expo development server
bun run android            # Build and launch locally on Android
bun run ios                # Build and launch locally on iOS
bun run web                # Start the web target
bunx tsc --noEmit          # Type-check the project
bunx expo lint             # Run Expo lint
bun run test:regression    # Run backup and date-period regression checks
```

## Data and backups

App records are stored locally in SQLite. The encrypted backup flow creates a `.pab` file protected by a password you choose. Keep the password safe; it is required to restore the backup. Store backup files somewhere separate from the device so they remain available if the device is lost or replaced.

## Project structure

```text
src/
  app/            Expo Router screens and layouts
  components/     Reusable interface components
  constants/      Expense categories and app constants
  database/       SQLite setup, schema migrations, and seed data
  hooks/          Shared React hooks
  repositories/   Data access for personal, company, and split expenses
  services/       Backup, security, attachments, and report export logic
  theme/          Colors, spacing, and typography
  types/          Shared TypeScript types
  utils/          Formatting and validation helpers
modules/          Local Expo native modules
assets/           App icons and visual assets
docs/              Project notes and regression checklist
```

## Tech stack

- Expo SDK 57, React Native, TypeScript, and Expo Router
- Expo SQLite for on-device records
- Expo SecureStore and local authentication for security features
- Excel and PDF generation for reports

## Project status

This repository contains the **v1.5.0 beta**. The Expo slug is `expense_tracker`; the Android application ID and iOS bundle identifier are both `com.expensetracker.app`.
