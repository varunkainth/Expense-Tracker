# Critical mobile flow checks

Run `bun run test:regression` for the automated backup-shape, attachment-integrity, reminder, and month-boundary checks. Use a development build and temporary data for the device flows below.

## Backup and restore

1. Create one personal expense, one company expense, one JPEG receipt, and one PDF receipt.
2. Create a password-protected backup and save it to a user-selected location. Confirm the success message reports the expected record and attachment counts.
3. Change or remove the test records, then restore the backup with the correct password. Confirm the restore summary matches and both attachments open from their expense entries.
4. Repeat with a wrong password. Confirm restore fails and the current records remain unchanged.
5. Return to Backup & Restore. Confirm the last-successful-backup date and counts are shown. A missing backup or one at least 30 days old should show the due reminder.

## Company exports

1. With no employee profile, open each export action. Confirm it offers a direct route to set up the employee profile.
2. Add test expenses in two different months, including complaint numbers and attachments. Export the first month as Excel and confirm its three claim sheets contain only the selected month's rows and the expected complaint numbers and totals.
3. Export the same month as an attendance form. Confirm the month, attendance selections, and expense totals match the saved data.
4. Export receipt attachments. Confirm the resulting PDF includes only the selected month's receipt images and PDF pages. Repeat for a month with no receipts and confirm the app explains that there is nothing to export.

## First-use company setup

1. Clear employee data in a test install. Open the Company tab and confirm the setup card explains profile setup, entering expenses, and exporting monthly reports.
2. Tap Set Up Employee Profile. Confirm it opens the employee form and returns to the Company tab with the profile displayed after saving.
