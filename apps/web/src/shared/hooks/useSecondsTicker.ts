import { useEffect } from 'react';

export const useSecondsTicker = (callback: () => void, isActive: boolean) => {
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(callback, 1000);
    return () => clearInterval(interval);
  }, [callback, isActive]);
};
