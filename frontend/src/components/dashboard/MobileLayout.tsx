/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';

interface MobileLayoutProps {
  userName: string;
  userImage?: string;
  user?: any;
  showFilters: boolean;
  showSidePanel: boolean;
  onToggleFilters: () => void;
  onToggleSidePanel: () => void;
  showBottomNav?: boolean;
  topContent?: ReactNode;
  children: ReactNode;
}

export const MobileLayout = ({
  userName,
  userImage,
  user,
  showFilters,
  showSidePanel,
  onToggleFilters,
  onToggleSidePanel,
  showBottomNav = true,
  children
}: MobileLayoutProps) => {
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let frameId = 0;

    const measure = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const topBarHeight = topBarRef.current?.offsetHeight ?? (window.innerWidth >= 640 ? 74 : 62);
      const bottomNavHeight = showBottomNav ? 88 : 0;
      const nextHeight = Math.max(320, Math.round(viewportHeight - topBarHeight - bottomNavHeight));
      setContentHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        measure();
      });
    };

    scheduleMeasure();
    window.setTimeout(scheduleMeasure, 0);
    window.setTimeout(scheduleMeasure, 120);
    window.setTimeout(scheduleMeasure, 320);

    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);
    window.addEventListener('pageshow', scheduleMeasure);
    document.addEventListener('visibilitychange', scheduleMeasure);
    window.visualViewport?.addEventListener('resize', scheduleMeasure);
    window.visualViewport?.addEventListener('scroll', scheduleMeasure);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
      window.removeEventListener('pageshow', scheduleMeasure);
      document.removeEventListener('visibilitychange', scheduleMeasure);
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('scroll', scheduleMeasure);
    };
  }, [showBottomNav]);

  return (
    <div className="dashboard-main min-h-dvh bg-[radial-gradient(circle_at_10%_10%,rgba(236,72,153,0.15),transparent_35%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.14),transparent_35%)] no-horizontal-scroll lg:hidden">
      {/* Mobile Top Bar */}
      <div ref={topBarRef}>
        <TopBar
          userName={userName}
          userImage={userImage}
          user={user}
          showFilterButton={true}
          showFilters={showFilters}
          showSidePanel={showSidePanel}
          onToggleFilters={onToggleFilters}
          onToggleSidePanel={onToggleSidePanel}
        />
      </div>

      {/* Mobile Profile Display */}
      <div
        className={`flex flex-col px-0 pt-0 overflow-hidden ${showBottomNav ? 'pb-[calc(88px+env(safe-area-inset-bottom,0px))]' : 'pb-[env(safe-area-inset-bottom,0px)]'}`}
        style={
          contentHeight
            ? { height: `${contentHeight}px` }
            : { minHeight: 'calc(100svh - 62px)' }
        }
      >
        <div className="relative mx-auto h-full min-h-0 w-full flex-1">
          {children}
        </div>
      </div>

      {showBottomNav ? <MobileBottomNav userImage={userImage} userName={userName} /> : null}
    </div>
  );
};
