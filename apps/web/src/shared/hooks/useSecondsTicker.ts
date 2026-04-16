import { useEffect } from 'react';

export const useSecondsTicker = (callback: () => void, isActive: boolean) => {
  useEffect(() => {
    if (!isActive) return;

    const setIntervalFn =
      typeof globalThis.setInterval === 'function' ? globalThis.setInterval : window.setInterval.bind(window);
    const clearIntervalFn =
      typeof globalThis.clearInterval === 'function' ? globalThis.clearInterval : window.clearInterval.bind(window);

    const interval = setIntervalFn(callback, 1000);
    return () => clearIntervalFn(interval);
  }, [callback, isActive]);
};
