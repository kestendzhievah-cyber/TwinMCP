// Usage events. twinmcp.fr has no /api/v2/cli/events endpoint yet, so posting
// one only added a failing network call (and latency) to every command. This
// stays a no-op until that route exists; callers keep their trackEvent() calls
// so wiring it back is a one-file change. src/__tests__/api-paths.test.ts
// fails if a path is added here that the backend does not serve.
export function trackEvent(_event: string, _data?: Record<string, unknown>): void {
  // Intentionally empty.
}
