# Privacy notice: bank SMS expense detection

Bank SMS expense detection is an optional Android feature and is off until enabled by the user. Enabling it asks Android for SMS inbox and incoming SMS permissions. The app reads matching messages only within the scan range selected in Settings, then watches for new incoming messages while enabled.

The app checks sender IDs and message text on the device to identify likely debit alerts. OTPs, credits, offers, refunds, reversals, and failed transactions are excluded. Original message text is processed in memory and is not stored by the app or uploaded. The device database stores extracted transaction details (amount, payment method, merchant when found, date, last four digits and reference number when present), a deduplication hash, confidence, category, and review status. WorkManager receives only these extracted fields, never the SMS body.

The user must confirm a suggestion before it becomes a personal expense. Imported expenses can be removed from Bank SMS Detection settings. Deleting pending suggestions does not remove personal expenses; deleting all SMS-imported data removes confirmed SMS-imported expenses and suggestions while retaining manually entered expenses. SMS permission can be revoked in Android Settings; the app turns detection off when it next checks permission state.

This local notice describes the SMS feature and should be incorporated into any public privacy policy before distribution. The app's encrypted backup/export feature may include the local database when the user explicitly creates a backup; the user controls where that file is saved or shared.
