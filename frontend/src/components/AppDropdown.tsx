import React from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface AppDropdownOption {
  value: string;
  label: string;
}

interface AppDropdownProps {
  id?: string;
  value?: string;
  options: AppDropdownOption[];
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  ariaLabel?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  selectedOptionClassName?: string;
  maxMenuHeightClassName?: string;
  invalid?: boolean;
  mobileSheetOnSmallScreens?: boolean;
}

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

export const AppDropdown: React.FC<AppDropdownProps> = ({
  id,
  value = '',
  options,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search options...',
  emptyText = 'No options found.',
  ariaLabel,
  className,
  triggerClassName,
  menuClassName,
  optionClassName,
  selectedOptionClassName,
  maxMenuHeightClassName,
  invalid = false,
  mobileSheetOnSmallScreens = false,
}) => {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isMobileSheet, setIsMobileSheet] = React.useState(false);
  const [localValue, setLocalValue] = React.useState(value);
  const [draftValue, setDraftValue] = React.useState(value);
  const [menuPosition, setMenuPosition] = React.useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 320,
    openAbove: false,
  });
  const useMobileSheetOnSmallScreens = searchable || mobileSheetOnSmallScreens;

  const updateMenuPosition = React.useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    // Use visualViewport when available — it accounts for the on-screen keyboard
    // shrinking the visible area on iOS/Android.
    const vv = window.visualViewport;
    // visualViewport.height already excludes the on-screen keyboard.
    // rect.getBoundingClientRect() is relative to the layout viewport origin,
    // so subtract offsetTop to convert to visualViewport coordinates.
    const viewportHeight = vv ? vv.height : window.innerHeight;
    const viewportWidth = vv ? vv.width : window.innerWidth;
    const viewportOffsetTop = vv ? vv.offsetTop : 0;
    const rectTopInVV = rect.top - viewportOffsetTop;
    const rectBottomInVV = rect.bottom - viewportOffsetTop;
    const availableBelow = viewportHeight - rectBottomInVV - viewportPadding;
    const availableAbove = rectTopInVV - viewportPadding;
    const preferredWidth = Math.max(rect.width, Math.min(viewportWidth - viewportPadding * 2, 420));
    const width = Math.min(preferredWidth, viewportWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, viewportWidth - width - viewportPadding)
    );
    const shouldOpenAbove = availableBelow < 220 && availableAbove > availableBelow;
    const maxHeight = Math.max(160, Math.min(420, shouldOpenAbove ? availableAbove - 8 : availableBelow));

    setMenuPosition({
      top: shouldOpenAbove
        ? Math.max(viewportPadding, rectTopInVV + viewportOffsetTop - maxHeight - 8)
        : rectBottomInVV + viewportOffsetTop + 8,
      left,
      width,
      maxHeight,
      openAbove: shouldOpenAbove,
    });
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateResponsiveMode = () => {
      // Use screen.width instead of window.innerWidth so the keyboard opening
      // (which shrinks visualViewport but not innerWidth on some browsers) does
      // not accidentally flip the mobile sheet back to the desktop menu.
      const screenW = typeof screen !== 'undefined' ? screen.width : window.innerWidth;
      setIsMobileSheet(screenW < 640 && useMobileSheetOnSmallScreens);
    };

    updateResponsiveMode();
    window.addEventListener('resize', updateResponsiveMode);

    return () => {
      window.removeEventListener('resize', updateResponsiveMode);
    };
  }, [useMobileSheetOnSmallScreens]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleViewportChange = () => {
      if (isOpen) {
        updateMenuPosition();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    // visualViewport fires when the on-screen keyboard opens/closes on mobile
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, [isOpen, updateMenuPosition]);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  React.useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      return;
    }
    if (isMobileSheet) {
      setDraftValue(localValue);
    }
    if (!isMobileSheet) {
      updateMenuPosition();
    }
    if (searchable) {
      searchInputRef.current?.focus();
    }
  }, [isMobileSheet, isOpen, localValue, searchable, updateMenuPosition]);

  React.useEffect(() => {
    if (!isOpen || !isMobileSheet || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSheet, isOpen]);

  const selectedOption = React.useMemo(() => options.find((option) => option.value === localValue), [localValue, options]);
  const draftSelectedOption = React.useMemo(
    () => options.find((option) => option.value === draftValue),
    [draftValue, options]
  );

  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchTerm.trim()) return options;
    const lowered = searchTerm.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(lowered));
  }, [options, searchTerm, searchable]);

  const desktopMenuNode = isOpen && !isMobileSheet ? (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: menuPosition.top,
        left: menuPosition.left,
        width: menuPosition.width,
        zIndex: 1200,
      }}
      className={cx(
        'overflow-hidden rounded-2xl border border-slate-600 bg-slate-950 shadow-2xl',
        menuClassName
      )}
    >
      {searchable && (
        <div className="border-b border-slate-700/70 p-3 sm:p-3.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/90 py-2.5 pl-9 pr-3 text-base text-white placeholder-slate-400 outline-none focus:border-pink-500 sm:py-2 sm:text-sm"
            />
          </div>
        </div>
      )}

      <div
        className={cx('overflow-y-auto py-1', maxMenuHeightClassName)}
        style={!maxMenuHeightClassName ? { maxHeight: menuPosition.maxHeight } : undefined}
      >
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setLocalValue(option.value);
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cx(
                  'w-full px-4 py-3 text-left text-base leading-snug transition sm:px-4 sm:py-2.5 sm:text-sm',
                  isSelected ? 'bg-pink-500/20 text-pink-100' : 'text-slate-200 hover:bg-slate-800',
                  optionClassName,
                  isSelected && selectedOptionClassName
                )}
              >
                <span className="block whitespace-normal break-words">{option.label}</span>
              </button>
            );
          })
        ) : (
          <p className="px-4 py-3 text-sm text-slate-400">{emptyText}</p>
        )}
      </div>
    </div>
  ) : null;

  const mobileSheetNode = isOpen && isMobileSheet ? (
    <div className="fixed inset-0 z-[1300] sm:hidden">
      <button
        type="button"
        aria-label="Close dropdown"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      <div
        ref={menuRef}
        className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-[28px] border-t border-white/10 bg-slate-950 shadow-[0_-20px_60px_rgba(0,0,0,0.45)]"
      >
        <div className="flex items-center justify-center px-4 pb-2 pt-3">
          <div className="h-1.5 w-12 rounded-full bg-white/15" />
        </div>

        <div className="border-b border-slate-800 px-4 pb-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{ariaLabel || placeholder}</p>
                {draftSelectedOption?.label ? (
                  <p className="mt-1 text-xs text-slate-400">Selected: {draftSelectedOption.label}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80"
              >
                Done
            </button>
          </div>

          {searchable ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 py-3 pl-10 pr-4 text-base text-white placeholder-slate-400 outline-none focus:border-pink-500"
              />
            </div>
          ) : null}
        </div>

        <div className="max-h-[calc(82dvh-132px)] overflow-y-auto overscroll-contain px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = option.value === draftValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setDraftValue(option.value);
                    setLocalValue(option.value);
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cx(
                    'mb-1 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left text-base leading-snug transition',
                    isSelected ? 'bg-pink-500/20 text-pink-100' : 'text-slate-200 hover:bg-slate-900'
                  )}
                >
                  <span className="min-w-0 flex-1 whitespace-normal break-words">{option.label}</span>
                  {isSelected ? <span className="shrink-0 text-sm font-semibold text-pink-200">Selected</span> : null}
                </button>
              );
            })
          ) : (
            <p className="px-4 py-4 text-sm text-slate-400">{emptyText}</p>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div ref={wrapperRef} className={cx('relative', className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cx(
          'flex w-full items-center justify-between gap-3 rounded-xl border border-white/20 bg-slate-950/75 px-3 py-2.5 text-left text-base text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/40 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5 sm:text-sm',
          invalid && 'border-red-400/70 focus-visible:ring-red-400/30',
          triggerClassName
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className={cx('min-w-0 flex-1 truncate', selectedOption ? 'text-white' : 'text-slate-400')}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={cx('h-4 w-4 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {typeof document !== 'undefined' && desktopMenuNode ? createPortal(desktopMenuNode, document.body) : null}
      {typeof document !== 'undefined' && mobileSheetNode ? createPortal(mobileSheetNode, document.body) : null}
    </div>
  );
};

export default AppDropdown;
