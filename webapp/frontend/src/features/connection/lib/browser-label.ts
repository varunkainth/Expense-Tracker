/** Display hint supplied by the browser, never an authentication identity. */
export function browserLabel(userAgent: string): string {
  const browser = /Edg(?:A|iOS)?\//.test(userAgent) ? 'Edge'
    : /OPR\/|Opera\//.test(userAgent) ? 'Opera'
    : /Firefox\/|FxiOS\//.test(userAgent) ? 'Firefox'
    : /SamsungBrowser\//.test(userAgent) ? 'Samsung Internet'
    : /Chrome\/|CriOS\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari' : 'Browser';
  const os = /Android/.test(userAgent) ? 'Android'
    : /iPhone|iPad|iPod/.test(userAgent) ? 'iOS / iPadOS'
    : /Windows/.test(userAgent) ? 'Windows'
    : /CrOS/.test(userAgent) ? 'ChromeOS'
    : /Macintosh|Mac OS X/.test(userAgent) ? 'macOS'
    : /Linux/.test(userAgent) ? 'Linux' : 'Unknown OS';
  return `${browser} · ${os}`;
}
