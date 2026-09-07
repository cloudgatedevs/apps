// Brand mark for the back office: the store's logo (or icon) and name from Settings, with a
// generic mark until one is set.
import { useStoreBrand } from '@/admin/services/storeBrand';

export const BrandMark = ({ size, className }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="shopGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7c8bff" />
        <stop offset="0.5" stopColor="#6366f1" />
        <stop offset="1" stopColor="#8b5cf6" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#shopGrad)" />
    {/* Bag glyph spans y 13.5-34.5 so its visual centre sits on the tile centre (24). */}
    <path d="M14 20.5h20l-1.6 12.5a2 2 0 0 1-2 1.5H17.6a2 2 0 0 1-2-1.5L14 20.5z" fill="#1e1b4b" fillOpacity="0.35" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M19 20.5v-2a5 5 0 0 1 10 0v2" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const Brand = ({ collapsed = false }) => {
  const brand = useStoreBrand();
  const image = brand?.logo || brand?.icon;
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-xl shadow-glow">
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <BrandMark className="h-full w-full" />}
      </span>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-semibold tracking-wide text-mist">{brand?.name ?? 'Shop'}</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-mist-dim">Back office</p>
        </div>
      )}
    </div>
  );
};
