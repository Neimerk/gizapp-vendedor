import { useCallback, useEffect, useState } from "react";

const ATTEMPT_KEY = "brasux-login-attempts";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type AttemptData = { count: number; since: number };

function readAttempts(): AttemptData | null {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    return raw ? (JSON.parse(raw) as AttemptData) : null;
  } catch {
    return null;
  }
}

export function useLoginThrottle() {
  const [blocked, setBlocked] = useState(false);
  const [remainingMin, setRemainingMin] = useState(0);

  const checkBlock = useCallback(() => {
    const data = readAttempts();
    if (!data || data.count < MAX_ATTEMPTS) {
      setBlocked(false);
      return false;
    }
    const elapsed = Date.now() - data.since;
    if (elapsed >= LOCKOUT_MS) {
      sessionStorage.removeItem(ATTEMPT_KEY);
      setBlocked(false);
      return false;
    }
    setBlocked(true);
    setRemainingMin(Math.ceil((LOCKOUT_MS - elapsed) / 60_000));
    return true;
  }, []);

  useEffect(() => {
    checkBlock();
  }, [checkBlock]);

  const registerAttempt = useCallback((success: boolean) => {
    if (success) {
      sessionStorage.removeItem(ATTEMPT_KEY);
      setBlocked(false);
      return;
    }
    const data = readAttempts();
    const next: AttemptData = {
      count: (data?.count ?? 0) + 1,
      since: data?.since ?? Date.now(),
    };
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(next));
    if (next.count >= MAX_ATTEMPTS) {
      setBlocked(true);
      setRemainingMin(15);
    }
  }, []);

  return { blocked, remainingMin, checkBlock, registerAttempt };
}
