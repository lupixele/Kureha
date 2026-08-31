import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getLibrary } from '../server/library';
import { markWatchedFn } from '../server/mark-watched';
import { unmarkWatchedFn } from '../server/unmark-watched';
import type { TrackedMedia, WatchedEpisode, Progress, EffectiveState, ReleaseState, Intent } from '../core/types';

type MediaItem = {
  media: TrackedMedia;
  watchedEpisodes: WatchedEpisode[];
  progress: Progress;
  effectiveState: EffectiveState;
};

export const Route = createFileRoute('/test-library')({
  component: TestLibraryPage,
});

function TestLibraryPage() {
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<Set<string>>(new Set());

  const fetchLibrary = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getLibrary();
      if (result.ok) {
        setLibrary(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, []);

  const handleMarkWatched = async (mediaId: string, mediaType: 'movie' | 'series' | 'anime', totalEpisodes: number | null, releaseState: ReleaseState, seasonNumber: number, episodeNumber: number) => {
    const key = `${mediaId}-${seasonNumber}-${episodeNumber}`;
    setMutating(prev => new Set(prev).add(key));
    setError(null);
    try {
      const result = await markWatchedFn({
        data: {
          mediaId,
          mediaType,
          totalEpisodes,
          releaseState,
          seasonNumber,
          episodeNumber,
        }
      });
      if (!result.ok) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark watched');
    } finally {
      setMutating(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      fetchLibrary();
    }
  };

  const handleUnmarkWatched = async (mediaId: string, seasonNumber: number, episodeNumber: number) => {
    const key = `${mediaId}-${seasonNumber}-${episodeNumber}`;
    setMutating(prev => new Set(prev).add(key));
    setError(null);
    try {
      const result = await unmarkWatchedFn({
        data: {
          mediaId,
          seasonNumber,
          episodeNumber,
        }
      });
      if (!result.ok) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unmark watched');
    } finally {
      setMutating(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      fetchLibrary();
    }
  };

  const handleRewatchConfirm = async (mediaId: string, mediaType: 'movie' | 'series' | 'anime', totalEpisodes: number | null, releaseState: ReleaseState, seasonNumber: number, episodeNumber: number) => {
    setConfirming(prev => {
      const next = new Set(prev);
      next.delete(`${mediaId}-${seasonNumber}-${episodeNumber}`);
      return next;
    });
    await handleMarkWatched(mediaId, mediaType, totalEpisodes, releaseState, seasonNumber, episodeNumber);
  };

  const isWatched = (mediaId: string, seasonNumber: number, episodeNumber: number) => {
    const item = library.find(m => m.media.mediaId === mediaId);
    if (!item) return false;
    return item.watchedEpisodes.some(e => e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber);
  };

  const getRewatchCount = (mediaId: string, seasonNumber: number, episodeNumber: number) => {
    const item = library.find(m => m.media.mediaId === mediaId);
    if (!item) return 0;
    const ep = item.watchedEpisodes.find(e => e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber);
    return ep?.rewatchCount ?? 0;
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error} <button onClick={fetchLibrary}>Retry</button></div>;

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Test Library</h1>

      {library.length === 0 && (
        <div style={{ padding: '20px', border: '1px dashed #ccc', borderRadius: '8px', marginBottom: '20px' }}>
          <p><strong>Library is empty.</strong> Add test titles by marking episodes watched below:</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
            <button onClick={() => handleMarkWatched('test-movie-1', 'movie', null, 'released', 0, 0)}>
              Add & Mark Movie (Ep 0)
            </button>
            <button onClick={() => handleMarkWatched('test-series-1', 'series', 10, 'ongoing', 1, 1)}>
              Add & Mark Series S1E1 (10 eps)
            </button>
            <button onClick={() => handleMarkWatched('test-anime-1', 'anime', 24, 'ended', 1, 1)}>
              Add & Mark Anime S1E1 (24 eps)
            </button>
          </div>
        </div>
      )}

      {library.map(item => (
        <div key={item.media.mediaId} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0 }}>{item.media.mediaId}</h3>
              <small style={{ color: '#666' }}>
                {item.media.mediaType} • {item.media.totalEpisodes ? `${item.media.totalEpisodes} eps` : 'Movie'} • {item.progress}
              </small>
            </div>
            <span style={{ padding: '4px 8px', borderRadius: '4px', background: item.effectiveState.isNotifiable ? '#e8f5e9' : '#f5f5f5', fontSize: '12px' }}>
              {item.effectiveState.isNotifiable ? '🔔 Notifiable' : item.effectiveState.intent}
            </span>
          </div>

          {item.media.mediaType !== 'movie' && item.media.totalEpisodes && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Array.from({ length: item.media.totalEpisodes }, (_, i) => i + 1).map(epNum => {
                const watched = isWatched(item.media.mediaId, 1, epNum);
                const count = getRewatchCount(item.media.mediaId, 1, epNum);
                const isMutating = mutating.has(`${item.media.mediaId}-1-${epNum}`);
                const isConfirming = confirming.has(`${item.media.mediaId}-1-${epNum}`);

                if (!watched) {
                  return (
                    <button
                      key={epNum}
                      onClick={() => handleMarkWatched(item.media.mediaId, item.media.mediaType, item.media.totalEpisodes, item.media.releaseState, 1, epNum)}
                      disabled={isMutating}
                      style={{ padding: '6px 12px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: isMutating ? 'not-allowed' : 'pointer', opacity: isMutating ? 0.6 : 1 }}
                    >
                      {isMutating ? '...' : `Mark Ep ${epNum}`}
                    </button>
                  );
                }

                if (isConfirming) {
                  return (
                    <span key={epNum} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#fff3e0', borderRadius: '4px' }}>
                      <span>Ep {epNum} watched ×{count}</span>
                      <button
                        onClick={() => handleRewatchConfirm(item.media.mediaId, item.media.mediaType, item.media.totalEpisodes, item.media.releaseState, 1, epNum)}
                        style={{ padding: '4px 8px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Watch Again (+1)
                      </button>
                      <button
                        onClick={() => setConfirming(prev => {
                          const next = new Set(prev);
                          next.delete(`${item.media.mediaId}-1-${epNum}`);
                          return next;
                        })}
                        style={{ padding: '4px 8px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </span>
                  );
                }

                return (
                  <span key={epNum} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: '#e8f5e9', borderRadius: '4px' }}>
                    <span>✓ Ep {epNum}</span>
                    {count > 1 && <span style={{ fontSize: '12px', color: '#666' }}>×{count}</span>}
                    <button
                      onClick={() => setConfirming(prev => {
                        const next = new Set(prev);
                        next.add(`${item.media.mediaId}-1-${epNum}`);
                        return next;
                      })}
                      style={{ padding: '4px 8px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Watch Again
                    </button>
                    <button
                      onClick={() => handleUnmarkWatched(item.media.mediaId, 1, epNum)}
                      disabled={isMutating}
                      style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: isMutating ? 'not-allowed' : 'pointer', opacity: isMutating ? 0.6 : 1 }}
                    >
                      Remove
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {item.media.mediaType === 'movie' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isWatched(item.media.mediaId, 0, 0) ? (
                <>
                  <span style={{ padding: '6px 12px', background: '#e8f5e9', borderRadius: '4px' }}>✓ Watched</span>
                  <button
                    onClick={() => handleUnmarkWatched(item.media.mediaId, 0, 0)}
                    disabled={mutating.has(`${item.media.mediaId}-0-0`)}
                    style={{ padding: '6px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleMarkWatched(item.media.mediaId, 'movie', null, 'released', 0, 0)}
                  disabled={mutating.has(`${item.media.mediaId}-0-0`)}
                  style={{ padding: '6px 12px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Mark Watched
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}