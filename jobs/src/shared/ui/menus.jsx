// Dropdown menu and tooltip built on Radix primitives: keyboard navigation, focus management,
// collision-aware positioning and open/close animation come from the primitive; each app's
// CSS supplies the `.menu` / `.menu-item` / `.tooltip` looks.
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

/**
 * <Dropdown trigger={<button className="btn-ghost btn-sm">Actions</button>} items={[{ label, onSelect, danger?, disabled?, separator? }]} />
 */
export const Dropdown = ({ trigger, items, align = 'end', label }) => (
  <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align={align} sideOffset={6} className="ui-menu menu z-50 min-w-[11rem]" onCloseAutoFocus={(e) => e.preventDefault()}>
        {label ? <DropdownMenu.Label className="menu-label">{label}</DropdownMenu.Label> : null}
        {items.filter(Boolean).map((it, i) =>
          it.separator ? (
            <DropdownMenu.Separator key={`sep-${i}`} className="menu-sep" />
          ) : (
            <DropdownMenu.Item key={it.key ?? it.label} disabled={it.disabled} onSelect={(e) => { e.preventDefault(); it.onSelect?.(); }} className={`menu-item ${it.danger ? 'menu-item-danger' : ''}`}>
              {it.icon ? <span className="menu-icon">{it.icon}</span> : null}
              <span className="grow">{it.label}</span>
              {it.hint ? <span className="menu-hint">{it.hint}</span> : null}
            </DropdownMenu.Item>
          ),
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
);

export const TooltipProvider = ({ children }) => <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={200}>{children}</TooltipPrimitive.Provider>;

/** <Tooltip text="Delete"><button>…</button></Tooltip> */
export const Tooltip = ({ text, side = 'top', children }) =>
  text ? (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className="ui-menu tooltip z-50">
          {text}
          <TooltipPrimitive.Arrow className="tooltip-arrow" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  ) : (
    children
  );
