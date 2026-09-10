/**
 * Base skeleton-loading primitive — a pulsing placeholder box, sized
 * entirely via the caller's className (width/height/rounding). Use this
 * directly for one-off shapes, or reach for the composed helpers below
 * (SkeletonText, SkeletonAvatar, SkeletonCard, SkeletonRow) for the shapes
 * that repeat most across the app's list/card/form loading states.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-3 ${className}`} />;
}

/** A single line of placeholder text. `width` accepts any Tailwind width
 * utility value (e.g. "w-1/2", "w-24", "w-full"). */
export function SkeletonText({ className = "", width = "w-full" }: { className?: string; width?: string }) {
  return <Skeleton className={`h-3.5 ${width} ${className}`} />;
}

/** A circular avatar/icon-badge placeholder — matches the `h-11 w-11
 * rounded-full` icon badges used throughout list rows and cards. */
export function SkeletonAvatar({ className = "h-11 w-11" }: { className?: string }) {
  return <Skeleton className={`shrink-0 rounded-full ${className}`} />;
}

/** One placeholder list row: avatar + two lines of text, matching the
 * `rounded-card border border-border bg-surface-2 p-4` row shape used by
 * Job Alerts, Career Events, Applications, Practice History, etc. */
export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4 ${className}`}>
      <SkeletonAvatar />
      <div className="flex flex-1 flex-col gap-2">
        <SkeletonText width="w-1/3" />
        <SkeletonText width="w-1/2" className="h-3" />
      </div>
    </div>
  );
}

/** A stack of `count` placeholder rows — the common case for list pages. */
export function SkeletonRows({ count = 4, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** One placeholder card: matches the `rounded-card border border-border
 * bg-surface-2 p-4/p-5/p-6` card shape used for stat tiles, dashboard
 * cards, and grid items. */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4 ${className}`}>
      <SkeletonText width="w-2/3" />
      <SkeletonText width="w-full" className="h-3" />
      <SkeletonText width="w-1/3" className="h-3" />
    </div>
  );
}

/** A grid of `count` placeholder cards. */
export function SkeletonCards({ count = 4, className = "" }: { count?: number; className?: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className={className} />
      ))}
    </>
  );
}

/** One placeholder form-input bar: a label-sized line plus an input-sized
 * bar, matching TextField/SelectField's rendered height. */
export function SkeletonInput({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <SkeletonText width="w-24" className="h-3" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

/** A chat-bubble placeholder — for AI Coach's message-history load. Set
 * `align="end"` for a right-aligned (user-side) bubble. */
export function SkeletonBubble({ align = "start", width = "w-2/3" }: { align?: "start" | "end"; width?: string }) {
  return (
    <div className={`flex ${align === "end" ? "justify-end" : "justify-start"}`}>
      <Skeleton className={`h-10 ${width} max-w-[85%] rounded-card`} />
    </div>
  );
}
