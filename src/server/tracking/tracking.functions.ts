import { createServerFn } from '@tanstack/react-start';
import { authMiddleware } from '../../auth/middleware';
import * as trackingLogic from './tracking';

export const markEpisodeWatched = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: { operationId: string, episodeId: string, mode: trackingLogic.MarkMode }) => data)
  .handler(async ({ data, context }) => {
    return trackingLogic.markEpisodeWatched({
      userId: context.userId as string,
      operationId: data.operationId,
      episodeId: data.episodeId,
      mode: data.mode
    });
  });

export const unmarkEpisodeWatched = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: { operationId: string, episodeId: string, scope: trackingLogic.UnmarkScope, removal: trackingLogic.RemovalChoice }) => data)
  .handler(async ({ data, context }) => {
    return trackingLogic.unmarkEpisodeWatched({
      userId: context.userId as string,
      operationId: data.operationId,
      episodeId: data.episodeId,
      scope: data.scope,
      removal: data.removal
    });
  });

export const deleteTracking = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: { operationId: string, mediaGroupId: string }) => data)
  .handler(async ({ data, context }) => {
    return trackingLogic.deleteTracking({
      userId: context.userId as string,
      operationId: data.operationId,
      mediaGroupId: data.mediaGroupId
    });
  });

export const markMovieWatched = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: { operationId: string, mediaGroupId: string }) => data)
  .handler(async ({ data, context }) => {
    return trackingLogic.markMovieWatched({
      userId: context.userId as string,
      operationId: data.operationId,
      mediaGroupId: data.mediaGroupId
    });
  });

export const unmarkMovieWatched = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: { operationId: string, mediaGroupId: string, removal: trackingLogic.RemovalChoice }) => data)
  .handler(async ({ data, context }) => {
    return trackingLogic.unmarkMovieWatched({
      userId: context.userId as string,
      operationId: data.operationId,
      mediaGroupId: data.mediaGroupId,
      removal: data.removal
    });
  });

export const addToLibrary = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: { operationId: string, mediaGroupId: string }) => data)
  .handler(async ({ data, context }) => {
    return trackingLogic.addToLibrary({
      userId: context.userId as string,
      operationId: data.operationId,
      mediaGroupId: data.mediaGroupId
    });
  });

export const removeFromLibrary = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: { operationId: string, mediaGroupId: string }) => data)
  .handler(async ({ data, context }) => {
    return trackingLogic.removeFromLibrary({
      userId: context.userId as string,
      operationId: data.operationId,
      mediaGroupId: data.mediaGroupId
    });
  });

export const setMediaIntent = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: { operationId: string, mediaGroupId: string, intent: 'active' | 'paused' | 'watch_later' | 'dropped' }) => data)
  .handler(async ({ data, context }) => {
    return trackingLogic.setMediaIntent({
      userId: context.userId as string,
      operationId: data.operationId,
      mediaGroupId: data.mediaGroupId,
      intent: data.intent
    });
  });
