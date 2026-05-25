import type { User } from '@/services/api';
import type { DashboardFilterFocusSection } from './FilterPanel';
import { SwipeDeck } from './SwipeDeck';

interface ProfileDisplayProps {
  currentProfile: User | null | undefined;
  profileQueue?: User[];
  viewerLatitude?: number;
  viewerLongitude?: number;
  forceMobileCardLayout?: boolean;
  onStartOver: () => void;
  onGoBack: () => void;
  onLike: () => void;
  onPass: () => void;
  noProfilesTitle?: string;
  noProfilesDescription?: string;
  noProfilesActionLabel?: string;
  onNoProfilesAction?: () => void;
  noProfilesActionLoading?: boolean;
  noProfilesSecondaryActionLabel?: string;
  onNoProfilesSecondaryAction?: () => void;
  onOpenFilterSection?: (section?: DashboardFilterFocusSection | null) => void;
}

export const ProfileDisplay = ({
  currentProfile,
  profileQueue,
  viewerLatitude,
  viewerLongitude,
  forceMobileCardLayout = false,
  onStartOver,
  onGoBack,
  onLike,
  onPass,
  noProfilesTitle,
  noProfilesDescription,
  noProfilesActionLabel,
  onNoProfilesAction,
  noProfilesActionLoading,
  noProfilesSecondaryActionLabel,
  onNoProfilesSecondaryAction,
  onOpenFilterSection,
}: ProfileDisplayProps) => {
  const resolvedQueue =
    Array.isArray(profileQueue) && profileQueue.length > 0
      ? profileQueue
      : currentProfile
      ? [currentProfile]
      : [];

  return (
    <div className="h-full w-full">
      <SwipeDeck
        profileQueue={resolvedQueue}
        viewerLatitude={viewerLatitude}
        viewerLongitude={viewerLongitude}
        forceMobileCardLayout={forceMobileCardLayout}
        onStartOver={onStartOver}
        onGoBack={onGoBack}
        onLike={onLike}
        onPass={onPass}
        noProfilesTitle={noProfilesTitle}
        noProfilesDescription={noProfilesDescription}
        noProfilesActionLabel={noProfilesActionLabel}
        onNoProfilesAction={onNoProfilesAction}
        noProfilesActionLoading={noProfilesActionLoading}
        noProfilesSecondaryActionLabel={noProfilesSecondaryActionLabel}
        onNoProfilesSecondaryAction={onNoProfilesSecondaryAction}
        onOpenFilterSection={onOpenFilterSection}
      />
    </div>
  );
};
