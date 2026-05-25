/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import { FilterPanel } from './FilterPanel';
import { type DashboardFiltersPayload } from './FilterPanel';
import { type DashboardFilterFocusSection } from './FilterPanel';
import { SidePanel } from './SidePanel';

interface OverlayPanelsProps {
  showFilters: boolean;
  showSidePanel: boolean;
  userName: string;
  userImage?: string;
  user?: any;
  onCloseFilters: () => void;
  onCloseSidePanel: () => void;
  onApplyFilters: (filters: DashboardFiltersPayload) => void;
  filterFocusSection?: DashboardFilterFocusSection | null;
  isPremiumUser?: boolean;
  passportModeEnabled?: boolean;
  initialPassportCountry?: string | null;
}

export const OverlayPanels = ({
  showFilters,
  showSidePanel,
  userName,
  userImage,
  user,
  onCloseFilters,
  onCloseSidePanel,
  onApplyFilters,
  filterFocusSection = null,
  isPremiumUser = false,
  passportModeEnabled = false,
  initialPassportCountry = null,
}: OverlayPanelsProps) => {
  // Lock body scroll while side panel is open
  useEffect(() => {
    if (showSidePanel) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showSidePanel]);

  return (
    <>
      {/* Filter Panel Backdrop */}
      {showFilters && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onCloseFilters}
        />
      )}

      {/* Filter Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full overflow-hidden bg-gray-900/98 shadow-2xl backdrop-blur-xl transform transition-transform duration-300 ease-in-out sm:max-w-md sm:border-l sm:border-gray-700/50 md:max-w-lg xl:max-w-xl ${showFilters ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <FilterPanel
          onClose={onCloseFilters}
          onApplyFilters={onApplyFilters}
          isOpen={showFilters}
          initialFocusSection={filterFocusSection}
          isPremiumUser={isPremiumUser}
          passportModeEnabled={passportModeEnabled}
          initialPassportCountry={initialPassportCountry}
        />
      </div>

      {/* Mobile Side Navigation Backdrop — always rendered, fades in/out */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden
          transition-opacity duration-300
          ${showSidePanel ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onCloseSidePanel}
      />

      {/* Mobile Side Navigation Drawer — always rendered, slides in/out */}
      <div
        className={`fixed inset-y-0 left-0 w-80 bg-gray-900/98 backdrop-blur-xl
          border-r border-gray-700/50 shadow-2xl z-50 lg:hidden
          transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${showSidePanel ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidePanel userName={userName} userImage={userImage} user={user} onClose={onCloseSidePanel} />
      </div>
    </>
  );
};
