// Brand mark for the back office: the store's logo (or icon) and name from Settings, with a
// generic mark until one is set.
import { useStoreBrand } from '@/admin/services/storeBrand';
import { smallImageUrl } from '@/shared/services/imageUrl';

export const BrandMark = ({ size, className }) => (
  <svg width={size} height={size} className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="posGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#22d3ee" />
        <stop offset="0.55" stopColor="#0ea5e9" />
        <stop offset="1" stopColor="#6366f1" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#posGrad)" />
    {/* Till glyph (screen, stand, cash drawer) spans y 13-35 so it centres on the tile (24). */}
    <rect x="14" y="13" width="20" height="12" rx="2.5" fill="#0c4a6e" fillOpacity="0.35" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.8" />
    <path d="M21.5 25v3h5v-3" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.8" strokeLinejoin="round" />
    <rect x="11" y="28" width="26" height="7" rx="2" fill="#0c4a6e" fillOpacity="0.35" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.8" />
    <path d="M20 31.5h8" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const Brand = ({ collapsed = false }) => {
  const brand = useStoreBrand();
  const image = brand?.logo || brand?.icon;
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-xl shadow-glow">
        {image ? <img src={smallImageUrl(image)} alt="" className="h-full w-full object-cover" /> : <BrandMark className="h-full w-full" />}
      </span>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-semibold tracking-wide text-mist">{brand?.name ?? 'POS'}</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-mist-dim">Back office</p>
        </div>
      )}
    </div>
  );
};
