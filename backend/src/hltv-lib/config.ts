import { Impit } from 'impit';

export interface HLTVConfig {
  loadPage: (url: string) => Promise<string>;
}

const impit = new Impit({ browser: 'firefox144' });

export const defaultLoadPage = () => (url: string) =>
  impit.fetch(url).then((res) => res.text());

export const defaultConfig: HLTVConfig = {
  loadPage: defaultLoadPage(),
};

/**
 * Creates a loadPage function that routes requests through a rotating proxy.
 * Falls back to direct on failure after exhausting retries.
 */
export function createProxiedLoadPage(
  getProxy: () => string | null,
  reportBad: (proxy: string) => void,
  maxRetries = 3,
): (url: string) => Promise<string> {
  return async (url: string) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const proxyUrl = getProxy();
      if (!proxyUrl) break;

      try {
        const proxiedImpit = new Impit({ browser: 'firefox144', proxyUrl });
        const res = await proxiedImpit.fetch(url);
        return res.text();
      } catch {
        reportBad(proxyUrl);
      }
    }
    // Fallback to direct request
    return impit.fetch(url).then((res) => res.text());
  };
}
