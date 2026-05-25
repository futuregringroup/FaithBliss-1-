import { motion } from 'framer-motion';

interface NoProfilesStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  onStartOver?: () => void;
}

export const NoProfilesState = ({
  title = 'No new profiles right now',
  description = 'You are all caught up for the moment. New people will appear here as soon as they join or become available.',
  actionLabel = 'Reload Profiles',
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  onStartOver,
}: NoProfilesStateProps) => {
  const action = onAction || onStartOver;

  return (
    <div className="mx-auto max-w-xs px-4 py-16 text-center">
      {/* Animated illustration */}
      <motion.div
        className="mx-auto mb-6"
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 animate-[pulse_3s_ease-in-out_infinite] rounded-full border-2 border-pink-400/20" />
          <div className="absolute inset-2 animate-[pulse_3s_ease-in-out_infinite_0.5s] rounded-full border border-pink-400/15" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-pink-400/25 bg-gradient-to-br from-pink-500/15 via-fuchsia-500/10 to-purple-500/15 shadow-[0_10px_30px_rgba(236,72,153,0.12)]">
            <span className="animate-float text-4xl" role="img" aria-label="sparkles">✨</span>
          </div>
        </div>
      </motion.div>

      {/* Staggered text */}
      <motion.h2
        className="mb-3 text-xl font-bold text-white"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12, ease: 'easeOut' }}
      >
        {title}
      </motion.h2>

      <motion.p
        className="mb-2 text-sm leading-relaxed text-slate-300"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
      >
        {description}
      </motion.p>

      <motion.p
        className="mb-8 text-xs leading-relaxed text-slate-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.28 }}
      >
        Check back soon — God's timing is perfect.
      </motion.p>

      {/* Staggered buttons */}
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.32, ease: 'easeOut' }}
      >
        {action && (
          <button
            onClick={action}
            className="min-w-[13rem] rounded-full border border-pink-300/20 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 px-6 py-3.5 font-semibold text-white shadow-[0_14px_28px_rgba(217,70,239,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(217,70,239,0.3)]"
          >
            {actionLabel}
          </button>
        )}
        {onSecondaryAction && secondaryActionLabel && (
          <button
            onClick={onSecondaryAction}
            className="min-w-[13rem] rounded-full border border-white/12 bg-white/5 px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
          >
            {secondaryActionLabel}
          </button>
        )}
      </motion.div>
    </div>
  );
};
