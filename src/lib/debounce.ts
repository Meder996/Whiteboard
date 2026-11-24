export type Debounced<Args extends unknown[]> = ((...args: Args) => void) & {
  cancel: () => void;
  flush: () => void;
};

export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, wait = 300): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;

  const debounced = (...args: Args) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
      lastArgs = null;
    }, wait);
  };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (lastArgs) fn(...lastArgs);
    lastArgs = null;
  };

  return debounced;
}
