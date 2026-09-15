// Skeleton loaders. Every page renders a shape-matched placeholder while its data loads so
// the layout is stable and nothing jumps when the real content arrives. Colours come from the
// app's own theme via the `skeleton` class (defined in each app's CSS).

const cx = (...parts) => parts.filter(Boolean).join(' ');

/** A single shimmering block. Size it with width/height utilities. */
export const Skeleton = ({ className = '', style }) => <div aria-hidden="true" className={cx('skeleton', className)} style={style} />;

/** A few lines of text. `widths` are percentages for each line. */
export const SkeletonText = ({ lines = 3, widths = [90, 70, 50], className = '' }) => (
  <div className={cx('flex flex-col gap-2', className)} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className="h-3.5 rounded" style={{ width: `${widths[i % widths.length]}%` }} />
    ))}
  </div>
);

/** Stat cards row (back-office dashboard). */
export const SkeletonStats = ({ count = 4, className = '' }) => (
  <div className={cx('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)} aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card p-4">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="mt-3 h-6 w-28 rounded" />
        <Skeleton className="mt-2 h-3 w-16 rounded" />
      </div>
    ))}
  </div>
);

/**
 * Table rows with the real column count so the header and widths do not shift when data lands.
 * Renders cards on mobile like the real Table does.
 */
export const SkeletonTable = ({ columns = 5, rows = 6, className = '' }) => (
  <div className={cx('card overflow-hidden', className)} aria-hidden="true" aria-busy="true">
    <div className="hidden md:block">
      <div className="flex gap-6 border-b border-current/10 px-4 py-2.5">
        {Array.from({ length: columns }).map((_, i) => <Skeleton key={i} className="h-3 rounded" style={{ width: `${i === 0 ? 22 : 10 + ((i * 7) % 9)}%` }} />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-current/5 px-4 py-3 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            c === 0 ? (
              <div key={c} className="flex items-center gap-3" style={{ width: '22%' }}>
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="flex grow flex-col gap-1.5"><Skeleton className="h-3.5 w-3/4 rounded" /><Skeleton className="h-3 w-1/2 rounded" /></div>
              </div>
            ) : (
              <Skeleton key={c} className={cx('h-3.5 rounded', c % 3 === 2 ? 'w-14 rounded-md' : '')} style={{ width: c % 3 === 2 ? undefined : `${10 + ((c * 7 + r) % 9)}%` }} />
            )
          ))}
        </div>
      ))}
    </div>
    <div className="flex flex-col divide-y divide-current/5 md:hidden">
      {Array.from({ length: Math.min(rows, 4) }).map((_, r) => (
        <div key={r} className="flex flex-col gap-2.5 p-4">
          <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-lg" /><Skeleton className="h-4 w-1/2 rounded" /></div>
          <SkeletonText lines={2} widths={[60, 40]} />
        </div>
      ))}
    </div>
  </div>
);

/** A form block: heading + N fields. */
export const SkeletonForm = ({ fields = 4, className = '' }) => (
  <div className={cx('card flex flex-col gap-4 p-4', className)} aria-hidden="true">
    <Skeleton className="h-4 w-24 rounded" />
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} className="flex flex-col gap-1.5">
        <Skeleton className="h-2.5 w-20 rounded" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    ))}
  </div>
);

/** Detail page: a wide main column and a narrow side column of cards. */
export const SkeletonDetail = ({ className = '' }) => (
  <div className={cx('flex flex-col gap-6', className)} aria-hidden="true">
    <div className="flex flex-col gap-2">
      <Skeleton className="h-6 w-48 rounded" />
      <Skeleton className="h-3.5 w-72 rounded" />
    </div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <SkeletonTable columns={4} rows={3} />
        <div className="card flex flex-col gap-3 p-4"><Skeleton className="h-4 w-20 rounded" /><SkeletonText lines={3} /></div>
      </div>
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card flex flex-col gap-3 p-4"><Skeleton className="h-4 w-24 rounded" /><SkeletonText lines={2} widths={[80, 55]} /></div>)}
      </div>
    </div>
  </div>
);

/** Product card grid (storefront). */
export const SkeletonCards = ({ count = 8, className = '', aspect = 'aspect-[4/5]' }) => (
  <div className={cx('grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4', className)} aria-hidden="true" aria-busy="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex flex-col gap-3">
        <Skeleton className={cx('w-full rounded-2xl', aspect)} />
        <div className="flex flex-col gap-1.5 px-0.5"><Skeleton className="h-2.5 w-16 rounded" /><Skeleton className="h-4 w-3/4 rounded" /><Skeleton className="h-3.5 w-1/3 rounded" /></div>
      </div>
    ))}
  </div>
);

/** Media/thumbnail grid (square tiles). */
export const SkeletonTiles = ({ count = 12, className = '' }) => (
  <div className={cx('grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6', className)} aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => <div key={i} className="card overflow-hidden"><Skeleton className="aspect-square w-full rounded-none" /><div className="p-2.5"><Skeleton className="h-3 w-3/4 rounded" /></div></div>)}
  </div>
);

/** Line-item list (cart, order summary). */
export const SkeletonLines = ({ count = 3, className = '' }) => (
  <div className={cx('flex flex-col divide-y divide-current/5', className)} aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 py-3">
        <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="flex grow flex-col gap-1.5"><Skeleton className="h-3.5 w-2/3 rounded" /><Skeleton className="h-3 w-1/3 rounded" /></div>
        <Skeleton className="h-3.5 w-14 rounded" />
      </div>
    ))}
  </div>
);
