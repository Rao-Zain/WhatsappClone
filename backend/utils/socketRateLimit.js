/* A tiny per-connection limiter for socket events.
   const allow = createSocketLimiter({ max: 30, windowMs: 10_000 });
   if (!allow()) { ...refuse... } */
export function createSocketLimiter({ max, windowMs }) {
  let windowStart = 0;
  let count = 0;

  return function allow() {
    const now = Date.now();

    if (now - windowStart >= windowMs) {
      windowStart = now;
      count = 0;
    }

    count += 1;

    return count <= max;
  };
}