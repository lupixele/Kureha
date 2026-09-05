import { ProviderError } from '../providers/errors';
import { validateId } from '../providers/types';

export interface PreviewOptions {
  provider: 'anilist' | 'tmdb';
  providerId: string;
}

export async function previewProviderTitle(
  options: PreviewOptions,
  ctx: {
    aniListClient?: any;
    tmdbClient?: any;
  } = {}
) {
  const { provider, providerId } = options;
  const validatedId = validateId(providerId, provider);

  if (provider === 'anilist') {
    if (!ctx.aniListClient) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'anilist');
    }
    const details = await ctx.aniListClient.details(validatedId);
    return {
      provider: 'anilist' as const,
      providerId: validatedId,
      installment: details.installment,
      relations: details.relations,
      artwork: details.artwork,
      schemaDrift: details.drift,
    };
  } else if (provider === 'tmdb') {
    if (!ctx.tmdbClient) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'tmdb');
    }
    const details = await ctx.tmdbClient.details('movie', validatedId);
    return {
      provider: 'tmdb' as const,
      providerId: validatedId,
      installment: details.installment,
      relations: details.relations,
      artwork: details.artwork,
      schemaDrift: details.drift,
    };
  }

  throw new ProviderError('UNKNOWN_PROVIDER_ID', provider);
}
