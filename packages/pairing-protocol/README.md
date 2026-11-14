# Pairing protocol

Platform-neutral contracts, runtime response guards and the HTTP client used by Expo mobile and the web workspace. No React, Expo, Node-only code, storage or QR renderer dependencies. Import source through the current relative adapters; the repository root is not a Bun workspace. Web shared exports this module, and Vite/Bun bundle it. Keep this directory included in EAS uploads: the mobile scanner uses it. Never accept a backend URL from QR contents; clients must use a configured trusted origin. This is pairing/presence only, not encryption or expense sync.
