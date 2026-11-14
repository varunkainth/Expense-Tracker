import { expect, test } from 'bun:test';
import { browserLabel } from '../src/features/connection/lib/browser-label';
test('browser labels distinguish overlapping browser and OS tokens', () => {
  expect(browserLabel('Windows NT 10.0 Chrome/130 Safari/537 Edg/130')).toBe('Edge · Windows');
  expect(browserLabel('X11; Linux x86_64 Chrome/130 Safari/537')).toBe('Chrome · Linux');
  expect(browserLabel('Macintosh Mac OS X Version/18 Safari/605')).toBe('Safari · macOS');
  expect(browserLabel('Android Linux Chrome/130 SamsungBrowser/27')).toBe('Samsung Internet · Android');
  expect(browserLabel('iPhone Mac OS X FxiOS/130 Safari/605')).toBe('Firefox · iOS / iPadOS');
  expect(browserLabel('')).toBe('Browser · Unknown OS');
});
