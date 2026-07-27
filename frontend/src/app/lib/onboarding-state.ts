const replayPrefix = 'campus-growth:onboarding-replay:';
const resumeKey = 'campus-growth:onboarding-resume';
const resumeParam = 'mp_onboarding_resume';
const resumeTtlMs = 5 * 60 * 1000;

export type OnboardingResumeStep = 'school';

interface StoredOnboardingResume {
  step: OnboardingResumeStep;
  createdAt: number;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function shouldReplayOnboarding(userId: string) {
  if (!canUseStorage() || !userId) return false;
  return window.localStorage.getItem(`${replayPrefix}${userId}`) === 'pending';
}

export function markOnboardingForReplay(userId: string) {
  if (!canUseStorage() || !userId) return;
  window.localStorage.setItem(`${replayPrefix}${userId}`, 'pending');
}

export function clearOnboardingReplay(userId: string) {
  if (!canUseStorage() || !userId) return;
  window.localStorage.removeItem(`${replayPrefix}${userId}`);
}

function normalizeResumeStep(value?: string | null): OnboardingResumeStep | null {
  return value === 'school' ? value : null;
}

function readResumeStepFromUrl() {
  if (typeof window === 'undefined') return null;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);
  return normalizeResumeStep(hashParams.get(resumeParam) || searchParams.get(resumeParam));
}

export function storeOnboardingResumeStep(step: OnboardingResumeStep) {
  if (!canUseStorage()) return;
  const value: StoredOnboardingResume = { step, createdAt: Date.now() };
  window.localStorage.setItem(resumeKey, JSON.stringify(value));
}

export function getOnboardingResumeStep(): OnboardingResumeStep | null {
  const urlStep = readResumeStepFromUrl();
  if (urlStep) return urlStep;
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(resumeKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredOnboardingResume;
    if (!normalizeResumeStep(value.step) || Date.now() - value.createdAt > resumeTtlMs) {
      window.localStorage.removeItem(resumeKey);
      return null;
    }
    return value.step;
  } catch {
    window.localStorage.removeItem(resumeKey);
    return null;
  }
}

export function clearOnboardingResumeStep() {
  if (canUseStorage()) {
    window.localStorage.removeItem(resumeKey);
  }
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  let changed = false;
  if (hashParams.has(resumeParam)) {
    hashParams.delete(resumeParam);
    url.hash = hashParams.toString();
    changed = true;
  }
  if (url.searchParams.has(resumeParam)) {
    url.searchParams.delete(resumeParam);
    changed = true;
  }
  if (changed) {
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
}
