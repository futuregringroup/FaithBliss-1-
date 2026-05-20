import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Trash2, Heart, Send, Eye } from 'lucide-react';
import type { StoryGroup } from '@/hooks/useAPI';

interface StoryBarProps {
  stories: StoryGroup[];
  onCreateStory: (payload: FormData) => Promise<unknown>;
  onMarkStorySeen: (storyId: string) => Promise<void>;
  onLikeStory: (storyId: string) => Promise<{ liked: boolean; likesCount: number }>;
  onGetStoryLikes: (storyId: string) => Promise<{ users: Array<{ id: string; name: string; profilePhoto1?: string }>; count: number }>;
  onReplyToStory: (storyId: string, content: string) => Promise<{ success: boolean; matchId: string }>;
  onDeleteStory: (storyId: string) => Promise<void>;
  loading?: boolean;
}

const IMAGE_DURATION_MS = 5000;

export const StoryBar = ({
  stories,
  onCreateStory,
  onMarkStorySeen,
  onLikeStory,
  onGetStoryLikes,
  onReplyToStory,
  onDeleteStory,
  loading = false,
}: StoryBarProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const storyVideoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const [caption, setCaption] = useState('');
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [isPosting, setIsPosting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [durationMs, setDurationMs] = useState(IMAGE_DURATION_MS);
  const [progressMs, setProgressMs] = useState(0);
  const [localSeen, setLocalSeen] = useState<Record<string, true>>({});
  const [localLiked, setLocalLiked] = useState<Record<string, boolean>>({});
  const [localLikeCount, setLocalLikeCount] = useState<Record<string, number>>({});
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [showLikersModal, setShowLikersModal] = useState(false);
  const [isLoadingLikers, setIsLoadingLikers] = useState(false);
  const [likers, setLikers] = useState<Array<{ id: string; name: string; profilePhoto1?: string }>>([]);

  const clearTimers = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const handlePickMedia = () => {
    fileInputRef.current?.click();
  };

  const handleMediaSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const payload = new FormData();
    payload.append('media', file);
    if (caption.trim()) {
      payload.append('caption', caption.trim());
    }

    setIsPosting(true);
    try {
      await onCreateStory(payload);
      setCaption('');
    } finally {
      setIsPosting(false);
      event.target.value = '';
    }
  };

  const openStory = (storyIndex: number) => {
    setSelectedStoryIndex(storyIndex);
    setSelectedItemIndex(0);
    setProgressMs(0);
    setReplyText('');
    setShowLikersModal(false);
  };

  const closeStory = () => {
    clearTimers();
    setSelectedStoryIndex(null);
    setSelectedItemIndex(0);
    setProgressMs(0);
    setReplyText('');
    setShowLikersModal(false);
  };

  const nextItem = () => {
    if (!activeStory) return;
    if (selectedItemIndex < activeStory.items.length - 1) {
      setSelectedItemIndex((prev) => prev + 1);
      setProgressMs(0);
      setReplyText('');
      return;
    }

    const nextStoryIndex = (selectedStoryIndex || 0) + 1;
    if (nextStoryIndex < effectiveStories.length) {
      setSelectedStoryIndex(nextStoryIndex);
      setSelectedItemIndex(0);
      setProgressMs(0);
      setReplyText('');
      return;
    }

    closeStory();
  };

  const prevItem = () => {
    if (!activeStory) return;
    if (selectedItemIndex > 0) {
      setSelectedItemIndex((prev) => prev - 1);
      setProgressMs(0);
      setReplyText('');
      return;
    }

    const prevStoryIndex = (selectedStoryIndex || 0) - 1;
    if (prevStoryIndex >= 0) {
      const prevStory = effectiveStories[prevStoryIndex];
      setSelectedStoryIndex(prevStoryIndex);
      setSelectedItemIndex(Math.max(0, prevStory.items.length - 1));
      setProgressMs(0);
      setReplyText('');
    }
  };

  const handleDeleteCurrentStory = async () => {
    if (!selectedItem || !activeStory?.isCurrentUser) return;

    setIsDeleting(true);
    try {
      await onDeleteStory(selectedItem.id);
      const remainingInGroup = (activeStory.items.length || 1) - 1;

      if (remainingInGroup <= 0) {
        closeStory();
      } else {
        const nextIndex = Math.max(0, Math.min(selectedItemIndex, remainingInGroup - 1));
        setSelectedItemIndex(nextIndex);
      }
      setProgressMs(0);
    } finally {
      setIsDeleting(false);
    }
  };

  const effectiveStories = useMemo(() => {
    return stories.map((story) => {
      const unseen = story.items.reduce((count, item) => {
        const seen = item.hasSeen || !!localSeen[item.id];
        return seen ? count : count + 1;
      }, 0);
      return {
        ...story,
        unseenCount: story.isCurrentUser ? 0 : unseen,
      };
    });
  }, [stories, localSeen]);

  const activeStory = selectedStoryIndex !== null ? effectiveStories[selectedStoryIndex] : null;
  const selectedItem = activeStory?.items?.[selectedItemIndex] || null;

  const selectedItemLiked = selectedItem
    ? (localLiked[selectedItem.id] ?? selectedItem.likedByCurrentUser ?? false)
    : false;

  const selectedItemLikeCount = selectedItem
    ? (localLikeCount[selectedItem.id] ?? selectedItem.likesCount ?? 0)
    : 0;

  const handleToggleLike = async () => {
    if (!selectedItem) return;
    try {
      const result = await onLikeStory(selectedItem.id);
      setLocalLiked((prev) => ({ ...prev, [selectedItem.id]: result.liked }));
      setLocalLikeCount((prev) => ({ ...prev, [selectedItem.id]: result.likesCount }));
    } catch {
      // no-op
    }
  };

  const handleOpenLikers = async () => {
    if (!selectedItem || !activeStory?.isCurrentUser) return;

    setIsLoadingLikers(true);
    setShowLikersModal(true);
    try {
      const result = await onGetStoryLikes(selectedItem.id);
      setLikers(result.users || []);
      setLocalLikeCount((prev) => ({ ...prev, [selectedItem.id]: result.count || 0 }));
    } catch {
      setLikers([]);
    } finally {
      setIsLoadingLikers(false);
    }
  };

  const handleReply = async () => {
    if (!selectedItem || !activeStory || !replyText.trim() || activeStory.isCurrentUser) return;
    setIsReplying(true);
    try {
      await onReplyToStory(selectedItem.id, replyText.trim());
      setReplyText('');
    } finally {
      setIsReplying(false);
    }
  };

  const handleCancelReply = () => {
    setReplyText('');
  };

  useEffect(() => {
    if (!activeStory || !selectedItem) return;
    if (activeStory.isCurrentUser) return;

    const alreadySeen = selectedItem.hasSeen || localSeen[selectedItem.id];
    if (alreadySeen) return;

    setLocalSeen((prev) => ({ ...prev, [selectedItem.id]: true }));
    onMarkStorySeen(selectedItem.id).catch(() => null);
  }, [activeStory, selectedItem, localSeen, onMarkStorySeen]);

  useEffect(() => {
    setShowLikersModal(false);
    setLikers([]);
  }, [selectedItem?.id]);

  const isTypingReply = replyText.trim().length > 0 || isReplying;
  const shouldPauseStory = showLikersModal || (!activeStory?.isCurrentUser && isTypingReply);

  useEffect(() => {
    if (!selectedItem) return;

    clearTimers();

    if (shouldPauseStory) {
      return;
    }

    const remainingMs = Math.max(durationMs - progressMs, 0);
    if (remainingMs <= 0) {
      nextItem();
      return;
    }

    timerRef.current = window.setTimeout(() => {
      nextItem();
    }, remainingMs);

    const tickMs = 100;
    progressIntervalRef.current = window.setInterval(() => {
      setProgressMs((prev) => Math.min(prev + tickMs, durationMs));
    }, tickMs);

    return () => clearTimers();
  }, [selectedItem?.id, durationMs, shouldPauseStory]);

  useEffect(() => {
    const video = storyVideoRef.current;
    if (!video || selectedItem?.mediaType !== 'video') return;

    if (shouldPauseStory) {
      video.pause();
      return;
    }

    video.play().catch(() => null);
  }, [selectedItem?.id, selectedItem?.mediaType, shouldPauseStory]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  return (
    <>
      <div className="mx-3 mt-2 mb-2 rounded-2xl border border-white/10 bg-gray-900/70 p-2.5 backdrop-blur-xl sm:mx-2 sm:mb-3 sm:p-3">
        <div className="mb-2 flex flex-row items-center gap-2 sm:mb-3">
          <input
            type="text"
            placeholder="Add a caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={220}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-pink-500/40 focus:outline-none"
          />
          <button
            onClick={handlePickMedia}
            disabled={isPosting || loading}
            className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            aria-label="Post story"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{isPosting ? 'Posting...' : 'Post Story'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleMediaSelected}
          />
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1 sm:gap-3">
          {effectiveStories.length === 0 && (
            <p className="text-xs text-gray-400">No stories yet from your mutual friends.</p>
          )}

          {effectiveStories.map((story, index) => {
            const hasUnseen = !story.isCurrentUser && (story.unseenCount || 0) > 0;
            return (
              <button
                key={`${story.authorId}-${index}`}
                onClick={() => openStory(index)}
                className="flex min-w-[60px] flex-col items-center gap-1 sm:min-w-[68px]"
              >
                <div
                  className={`rounded-full p-[2px] ${
                    hasUnseen
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500'
                      : 'bg-gray-600'
                  }`}
                >
                  <img
                    src={story.authorPhoto || '/default-avatar.png'}
                    alt={story.authorName}
                    className="h-12 w-12 rounded-full border-2 border-gray-900 object-cover sm:h-14 sm:w-14"
                  />
                </div>
                <span className="max-w-[60px] truncate text-[11px] text-gray-200 sm:max-w-[68px]">
                  {story.isCurrentUser ? 'Your story' : story.authorName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeStory && selectedItem && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 flex items-stretch sm:items-center justify-center p-2 sm:p-4"
          style={{
            paddingTop: 'max(env(safe-area-inset-top), 8px)',
            paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
          }}
        >
          <button
            onClick={closeStory}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-2.5 rounded-full bg-black/50 sm:bg-white/10 text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <button
            onClick={prevItem}
            className="absolute left-2 sm:left-4 md:left-6 p-2.5 rounded-full bg-black/50 sm:bg-white/10 text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="relative w-full max-w-[460px] h-full sm:h-auto sm:max-h-[92dvh] bg-gray-950 rounded-2xl overflow-hidden border border-white/10 flex flex-col">
            <div className="px-3 pt-2">
              <div className="flex gap-1 mb-2">
                {activeStory.items.map((item, idx) => {
                  const filled = idx < selectedItemIndex;
                  const active = idx === selectedItemIndex;
                  const pct = active ? Math.min(100, (progressMs / Math.max(durationMs, 1)) * 100) : 0;
                  return (
                    <div key={item.id} className="h-1 flex-1 bg-white/20 rounded overflow-hidden">
                      <div
                        className="h-full bg-white transition-[width] duration-100"
                        style={{ width: filled ? '100%' : active ? `${pct}%` : '0%' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={activeStory.authorPhoto || '/default-avatar.png'}
                  className="w-8 h-8 rounded-full object-cover"
                  alt={activeStory.authorName}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {activeStory.isCurrentUser ? 'Your story' : activeStory.authorName}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(selectedItem.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {activeStory.isCurrentUser && (
                <button
                  onClick={handleDeleteCurrentStory}
                  disabled={isDeleting}
                  className="p-2 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-60"
                  title="Delete story"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="bg-black flex-1 min-h-0 flex items-center justify-center">
              {selectedItem.mediaType === 'video' ? (
                <video
                  ref={storyVideoRef}
                  src={selectedItem.mediaUrl}
                  className="w-full h-full object-contain"
                  autoPlay
                  muted
                  playsInline
                  onLoadedMetadata={(e) => {
                    const durationSec = e.currentTarget.duration;
                    if (Number.isFinite(durationSec) && durationSec > 0) {
                      setDurationMs(Math.min(Math.max(durationSec * 1000, 3000), 30000));
                    } else {
                      setDurationMs(IMAGE_DURATION_MS);
                    }
                  }}
                  onEnded={nextItem}
                />
              ) : (
                <img
                  src={selectedItem.mediaUrl}
                  className="w-full h-full object-contain"
                  alt="Story"
                  onLoad={() => setDurationMs(IMAGE_DURATION_MS)}
                />
              )}
            </div>

            {selectedItem.caption && (
              <p className="px-3 py-2 text-sm text-gray-100 max-h-20 overflow-y-auto">{selectedItem.caption}</p>
            )}

            <div className="px-3 pb-3 pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                {activeStory.isCurrentUser ? (
                  <button
                    onClick={handleOpenLikers}
                    className="inline-flex items-center gap-1 text-sm text-gray-200 hover:text-white"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{selectedItemLikeCount}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleToggleLike}
                    className={`inline-flex items-center gap-1 text-sm ${selectedItemLiked ? 'text-pink-400' : 'text-gray-300'}`}
                  >
                    <Heart className={`w-4 h-4 ${selectedItemLiked ? 'fill-pink-500 text-pink-500' : ''}`} />
                    <span>{selectedItemLikeCount}</span>
                  </button>
                )}
              </div>

              {!activeStory.isCurrentUser && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply to story"
                    className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-pink-500/40"
                    maxLength={400}
                  />
                  {replyText.trim().length > 0 && (
                    <button
                      onClick={handleCancelReply}
                      disabled={isReplying}
                      className="inline-flex items-center justify-center px-3 h-10 rounded-xl bg-white/10 text-gray-200 hover:bg-white/20 disabled:opacity-60 shrink-0 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || isReplying}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white disabled:opacity-60 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {showLikersModal && activeStory.isCurrentUser && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-3 sm:p-4">
                <div className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl p-4 max-h-[80dvh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-white">Liked By</p>
                    <button
                      onClick={() => setShowLikersModal(false)}
                      className="p-1 rounded-md hover:bg-white/10 text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {isLoadingLikers ? (
                    <p className="text-sm text-gray-400">Loading...</p>
                  ) : likers.length === 0 ? (
                    <p className="text-sm text-gray-400">No likes yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {likers.map((user) => (
                        <div key={user.id} className="flex items-center gap-2">
                          <img
                            src={user.profilePhoto1 || '/default-avatar.png'}
                            alt={user.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <span className="text-sm text-white">{user.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={nextItem}
            className="absolute right-2 sm:right-4 md:right-6 p-2.5 rounded-full bg-black/50 sm:bg-white/10 text-white"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      )}
    </>
  );
};
