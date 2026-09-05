import type { z } from 'zod';
import { safeProviderError } from '../errors';
import type { FetchTransport } from '../transport';
import { parseProvider, validateId, type OptionalResult } from '../types';
import { anizipSchema, type AnizipData } from './schemas';
import { normalizeAnizip } from './normalize';

export function createAnizipClient(options: { transport: FetchTransport; endpoint: (anilistId: string) => string; boundary: z.ZodType<unknown> }) {
  return { async enrich(anilistId: string): Promise<OptionalResult<AnizipData>> {
    try {
      validateId(anilistId, 'anizip');
      const raw = await options.transport.request({ provider: 'anizip', method: 'GET', url: options.endpoint(anilistId) });
      const decoded = parseProvider(options.boundary, raw, 'anizip');
      return { ok: true, data: normalizeAnizip(parseProvider(anizipSchema, decoded, 'anizip')) };
    } catch (error) { return { ok: false, error: safeProviderError(error, 'anizip') }; }
  } };
}
