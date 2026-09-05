import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFetchTransport } from '../../src/server/providers/transport';
import { ProviderError } from '../../src/server/providers/errors';

const request = { provider: 'anilist' as const, url: 'https://provider.invalid/graphql' };
const json = () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });

afterEach(() => vi.useRealTimers());

describe('injected provider transport (contract 5, 14, 17)', () => {
  it('forwards the request through the injected fetch and returns parsed JSON', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json());
    const transport = createFetchTransport({ fetch, sleep: async () => {}, random: () => 0 });
    await expect(transport.request({ ...request, method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"query":"fixture"}' })).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(request.url, expect.objectContaining({ method: 'POST', body: '{"query":"fixture"}', signal: expect.any(AbortSignal) }));
  });

  it.each([429, 500, 502, 503, 504])('retries transient HTTP %s with full exponential jitter', async (status) => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response('ignored', { status }))
      .mockResolvedValueOnce(new Response('ignored', { status }))
      .mockResolvedValueOnce(json());
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const transport = createFetchTransport({ fetch, sleep, random: () => 0.5, baseDelayMs: 100, maxDelayMs: 1_000, maxRetries: 2 });
    await expect(transport.request(request)).resolves.toEqual({ ok: true });
    expect(sleep.mock.calls).toEqual([[50], [100]]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('retries network failures without retaining their sensitive messages', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(new Error('private upstream details')).mockResolvedValueOnce(json());
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const transport = createFetchTransport({ fetch, sleep, random: () => 0, maxRetries: 1 });
    await expect(transport.request(request)).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, 'INVALID_QUERY'], [401, 'UNAUTHORIZED'], [403, 'UNAUTHORIZED'], [404, 'UNKNOWN_PROVIDER_ID'],
  ])('does not retry permanent HTTP %s', async (status, code) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('private response', { status: Number(status) }));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const transport = createFetchTransport({ fetch, sleep, random: () => 0, maxRetries: 3 });
    await expect(transport.request(request)).rejects.toMatchObject({ code, provider: 'anilist', status, retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON as a permanent sanitized schema error', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('private invalid JSON'));
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const transport = createFetchTransport({ fetch, sleep, random: () => 0, maxRetries: 3 });
    await expect(transport.request(request)).rejects.toMatchObject({ code: 'PROVIDER_SCHEMA_CHANGED', retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([
    ['12', 12_000],
    ['Tue, 01 Sep 2026 00:00:09 GMT', 9_000],
    ['0', 0],
  ])('honors exact Retry-After %s ahead of jitter and maximum backoff', async (header, delay) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': header } })).mockResolvedValueOnce(json());
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const random = vi.fn(() => 0.5);
    const transport = createFetchTransport({ fetch, sleep, random, now: () => Date.parse('2026-09-01T00:00:00Z'), baseDelayMs: 100, maxDelayMs: 100, maxRetries: 1 });
    await transport.request(request);
    expect(sleep.mock.calls).toEqual([[delay]]);
    expect(random).not.toHaveBeenCalled();
  });

  it('falls back to capped full jitter when Retry-After is invalid', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': 'invalid' } })).mockResolvedValueOnce(json());
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const transport = createFetchTransport({ fetch, sleep, random: () => 0.5, baseDelayMs: 1_000, maxDelayMs: 100, maxRetries: 1 });
    await transport.request(request);
    expect(sleep.mock.calls).toEqual([[50]]);
  });

  it('captures the actual AniList budget headers without hardcoded quotas', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{}', { headers: { 'X-RateLimit-Limit': '17', 'X-RateLimit-Remaining': '2', 'X-RateLimit-Reset': '1788220830', 'Retry-After': '7' } }));
    const onRateLimit = vi.fn();
    const transport = createFetchTransport({ fetch, sleep: async () => {}, random: () => 0, onRateLimit });
    await transport.request(request);
    expect(onRateLimit).toHaveBeenCalledWith('anilist', { limit: 17, remaining: 2, resetAt: 1_788_220_830_000, retryAfterMs: 7_000 });
  });

  it('bounds retries and exposes only safe typed error details', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('private body', { status: 503, statusText: 'private status', headers: { 'retry-after': '2' } }));
    const transport = createFetchTransport({ fetch, sleep: async () => {}, random: () => 0, maxRetries: 1 });
    let error: unknown;
    try { await transport.request({ ...request, url: request.url + '?api_key=private-query', headers: { authorization: 'private-header' } }); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', provider: 'anilist', status: 503, retryable: true, retryAfterMs: 2_000 });
    expect(fetch).toHaveBeenCalledTimes(2);
    if (!(error instanceof ProviderError)) throw new Error('Expected typed error');
    expect(JSON.stringify(error.toJSON())).not.toMatch(/private|stack|cause|headers|body|url/i);
    expect(error.message).not.toContain('private');
  });

  it.each(['fetch', 'body'])('times out hanging %s and retries with a fresh abort signal', async (stage) => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementationOnce(async (_url, init) => {
      if (!init?.signal) throw new Error('Missing signal');
      signals.push(init.signal);
      if (stage === 'fetch') return new Promise<Response>(() => {});
      return new Response(new ReadableStream<Uint8Array>({ start() {} }));
    }).mockImplementationOnce(async (_url, init) => {
      if (!init?.signal) throw new Error('Missing signal');
      signals.push(init.signal);
      return json();
    });
    const transport = createFetchTransport({ fetch, sleep: async () => {}, random: () => 0, timeoutMs: 100, maxRetries: 1 });
    const result = transport.request(request);
    const assertion = expect(result).resolves.toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(101);
    await assertion;
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1]).not.toBe(signals[0]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
