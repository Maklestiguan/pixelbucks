import { HltvProxyService } from './hltv-proxy.service';

describe('HltvProxyService', () => {
  function createService(proxyList: string, enabled = 'true') {
    const config = {
      get: jest.fn((key: string, defaultVal?: string) => {
        if (key === 'HLTV_PROXY_LIST') return proxyList;
        if (key === 'HLTV_PROXY_ENABLED') return enabled;
        return defaultVal;
      }),
    };
    return new HltvProxyService(config as any);
  }

  it('should parse comma-separated proxy list', () => {
    const service = createService('1.2.3.4:8080,5.6.7.8:1080');
    expect(service.enabled).toBe(true);
    expect(service.getProxy()).toBe('http://1.2.3.4:8080');
    expect(service.getProxy()).toBe('http://5.6.7.8:1080');
    // Round-robin wraps
    expect(service.getProxy()).toBe('http://1.2.3.4:8080');
  });

  it('should return null when no proxies configured', () => {
    const service = createService('');
    expect(service.enabled).toBe(false);
    expect(service.getProxy()).toBeNull();
  });

  it('should skip bad proxies temporarily', () => {
    const service = createService('1.2.3.4:8080,5.6.7.8:1080');
    service.reportBad('http://1.2.3.4:8080');

    // Should skip the bad one
    const proxy1 = service.getProxy();
    expect(proxy1).toBe('http://5.6.7.8:1080');
  });

  it('should return disabled when HLTV_PROXY_ENABLED is false', () => {
    const service = createService('1.2.3.4:8080', 'false');
    expect(service.enabled).toBe(false);
  });
});
