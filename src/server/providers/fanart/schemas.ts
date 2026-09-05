import { z } from 'zod';
import { providerIdSchema } from '../types';

const logoSchema = z.object({ id: providerIdSchema, url: z.string().url(), lang: z.string(), likes: z.string().regex(/^\d+$/).transform(Number).refine(Number.isFinite) });
export const fanartSchema = z.object({ hdmovielogo: z.array(logoSchema).optional(), movielogo: z.array(logoSchema).optional(), hdtvlogo: z.array(logoSchema).optional(), clearlogo: z.array(logoSchema).optional() });
export type FanartData = z.infer<typeof fanartSchema>;
