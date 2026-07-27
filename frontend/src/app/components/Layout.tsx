import { useEffect } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router';
import { BottomNav } from './BottomNav';
import { FloatingAI } from './FloatingAI';
import { OnboardingGate } from './onboarding/OnboardingGate';
import { useSession } from '../hooks/useSession';
import { aiEntryEnabled, teamShowcaseMode } from '../lib/commercial-config';
import { WechatMiniProgramLoginBridge } from './WechatMiniProgramLoginBridge';

const scrollPositions = new Map<string, number>();
const scrollStoragePrefix = 'campus-growth:scroll:';
const scrollStateKey = '__campusScroll';
const maxStoredScrollAge = 6 * 60 * 60 * 1000;

interface StoredScrollPosition {
  id: string;
  top: number;
  ts: number;
}

function getScrollTop() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function setScrollTop(top: number) {
  window.scrollTo(0, top);
  document.documentElement.scrollTop = top;
  document.body.scrollTop = top;
}

function getLocationScrollId(pathname: string, search: string) {
  return `${pathname}${search}`;
}

function readScrollFromHistory(scrollId: string) {
  const state = window.history.state as Record<string, unknown> | null;
  const stored = state?.[scrollStateKey] as StoredScrollPosition | undefined;
  if (!stored || stored.id !== scrollId || typeof stored.top !== 'number') {
    return undefined;
  }
  return stored.top;
}

function writeScrollToHistory(scrollId: string, top: number) {
  const state = (window.history.state ?? {}) as Record<string, unknown>;
  window.history.replaceState(
    {
      ...state,
      [scrollStateKey]: { id: scrollId, top, ts: Date.now() } satisfies StoredScrollPosition,
    },
    '',
    window.location.href,
  );
}

function readScrollFromStorage(scrollId: string) {
  try {
    const raw = window.sessionStorage.getItem(`${scrollStoragePrefix}${scrollId}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredScrollPosition;
    if (parsed.id !== scrollId || typeof parsed.top !== 'number') return undefined;
    if (Date.now() - parsed.ts > maxStoredScrollAge) return undefined;
    return parsed.top;
  } catch {
    return undefined;
  }
}

function writeScrollToStorage(scrollId: string, top: number) {
  try {
    window.sessionStorage.setItem(
      `${scrollStoragePrefix}${scrollId}`,
      JSON.stringify({ id: scrollId, top, ts: Date.now() } satisfies StoredScrollPosition),
    );
  } catch {
    // Some embedded webviews can disable storage. The in-memory map still covers normal route changes.
  }
}

function shouldShowPrimaryChrome(pathname: string) {
  return ['/', '/competitions', '/resources', '/teams', '/community', '/profile'].includes(pathname);
}

function shouldSuspendOnboardingGate(pathname: string) {
  if (teamShowcaseMode && (pathname === '/teams' || pathname.startsWith('/teams/'))) {
    return true;
  }
  return ['/login', '/schools', '/school-verify', '/profile/edit', '/history', '/account-settings'].includes(pathname);
}

export function Layout() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const { session, user, loggedIn, refresh } = useSession();
  const showPrimaryChrome = shouldShowPrimaryChrome(location.pathname);
  const showOnboardingGate = loggedIn && user && !shouldSuspendOnboardingGate(location.pathname);
  const contentBottomPadding = showPrimaryChrome ? 'pb-24' : location.pathname === '/login' ? 'pb-0' : 'pb-6';

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    void refresh().catch(() => undefined);
  }, [refresh, session?.token]);

  useEffect(() => {
    const scrollKey = location.key;
    const scrollId = getLocationScrollId(location.pathname, location.search);
    const targetTop =
      navigationType === 'POP'
        ? readScrollFromHistory(scrollId) ??
          scrollPositions.get(scrollKey) ??
          scrollPositions.get(scrollId) ??
          readScrollFromStorage(scrollId) ??
          0
        : 0;
    let isLeaving = false;
    let isRestoring = targetTop > 0;
    const restoreDeadline = Date.now() + 3200;
    let saveFrame = 0;
    const restoreTimers: number[] = [];
    const cancelRestoreTimers = () => {
      restoreTimers.splice(0).forEach((timer) => window.clearTimeout(timer));
    };
    const saveScroll = () => {
      const top = getScrollTop();
      const existingTop = Math.max(
        scrollPositions.get(scrollKey) ?? 0,
        scrollPositions.get(scrollId) ?? 0,
        readScrollFromHistory(scrollId) ?? 0,
        readScrollFromStorage(scrollId) ?? 0,
      );
      if (targetTop > 0 && top > targetTop + 24) {
        isRestoring = false;
        cancelRestoreTimers();
      }
      if (isRestoring && Date.now() < restoreDeadline && top + 4 < Math.min(targetTop, existingTop)) {
        return;
      }
      if (isLeaving && existingTop > 0 && top + 24 < existingTop) {
        return;
      }
      scrollPositions.set(scrollKey, top);
      scrollPositions.set(scrollId, top);
      writeScrollToHistory(scrollId, top);
      writeScrollToStorage(scrollId, top);
    };
    const scheduleSaveScroll = () => {
      if (saveFrame) return;
      saveFrame = window.requestAnimationFrame(() => {
        saveFrame = 0;
        saveScroll();
      });
    };
    const markLeaving = () => {
      if (saveFrame) {
        window.cancelAnimationFrame(saveFrame);
        saveFrame = 0;
      }
      saveScroll();
      isLeaving = true;
    };
    const markLeavingOnLinkClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('a[href]')) {
        markLeaving();
      }
    };
    const markLeavingOnHidden = () => {
      if (document.visibilityState === 'hidden') {
        markLeaving();
      }
    };
    const markUserScrollIntent = () => {
      isRestoring = false;
      cancelRestoreTimers();
    };
    const restoreScroll = () => {
      setScrollTop(targetTop);
      if (targetTop === 0 || getScrollTop() + 4 >= targetTop || Date.now() >= restoreDeadline) {
        isRestoring = false;
      }
    };

    restoreScroll();
    const frame = window.requestAnimationFrame(restoreScroll);
    if (targetTop > 0) {
      [80, 180, 360, 700, 1200, 1800, 2600].forEach((delay) => {
        restoreTimers.push(window.setTimeout(restoreScroll, delay));
      });
    }
    const resizeObserver =
      targetTop > 0 && 'ResizeObserver' in window
        ? new ResizeObserver(() => {
            restoreScroll();
          })
        : null;
    resizeObserver?.observe(document.body);
    window.addEventListener('scroll', scheduleSaveScroll, { passive: true });
    window.addEventListener('popstate', markLeaving, { capture: true });
    window.addEventListener('pagehide', markLeaving, { capture: true });
    window.addEventListener('wheel', markUserScrollIntent, { passive: true });
    window.addEventListener('touchstart', markUserScrollIntent, { passive: true });
    window.addEventListener('pointerdown', markUserScrollIntent, { passive: true });
    window.addEventListener('keydown', markUserScrollIntent);
    document.addEventListener('visibilitychange', markLeavingOnHidden);
    document.addEventListener('click', markLeavingOnLinkClick, { capture: true });

    return () => {
      saveScroll();
      if (saveFrame) {
        window.cancelAnimationFrame(saveFrame);
      }
      window.removeEventListener('scroll', scheduleSaveScroll);
      window.removeEventListener('popstate', markLeaving, { capture: true });
      window.removeEventListener('pagehide', markLeaving, { capture: true });
      window.removeEventListener('wheel', markUserScrollIntent);
      window.removeEventListener('touchstart', markUserScrollIntent);
      window.removeEventListener('pointerdown', markUserScrollIntent);
      window.removeEventListener('keydown', markUserScrollIntent);
      document.removeEventListener('visibilitychange', markLeavingOnHidden);
      document.removeEventListener('click', markLeavingOnLinkClick, { capture: true });
      window.cancelAnimationFrame(frame);
      cancelRestoreTimers();
      resizeObserver?.disconnect();
    };
  }, [location.key, location.pathname, location.search, navigationType]);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#e9eef5] font-sans sm:p-4 md:p-8">
      <div className="relative mx-auto min-h-[100dvh] w-full max-w-[430px] overflow-x-hidden bg-[#edf1f7] sm:min-h-[calc(100dvh-2rem)] sm:rounded-lg sm:border sm:border-[#d7e0ec] sm:shadow-[0_18px_60px_rgba(29,45,72,0.14)] md:min-h-[calc(100dvh-4rem)]">
        <main className={`min-h-[100dvh] w-full max-w-full overflow-x-hidden ${contentBottomPadding}`}>
          <Outlet />
        </main>
        {showPrimaryChrome ? <BottomNav /> : null}
        {showPrimaryChrome && aiEntryEnabled ? <FloatingAI /> : null}
        {showOnboardingGate ? <OnboardingGate user={user} /> : null}
        <WechatMiniProgramLoginBridge />
      </div>
    </div>
  );
}
