type TraceLabel = "policy.create" | "policy.edit";

export function createPerformanceFetch(label: TraceLabel): typeof fetch {
  const traceId = crypto.randomUUID();
  return async (input, init) => {
    const started = performance.now();
    let status: number | null = null;
    let completed = false;
    // Deliberately omit URL query strings, headers, bodies, and error messages.
    const rawUrl = input instanceof Request ? input.url : String(input);
    const path = new URL(rawUrl).pathname;
    const resource = path.startsWith("/rest/v1/")
      ? path.split("/")[3] || "database"
      : path.startsWith("/auth/v1/") ? "auth" : "other";
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    try {
      const response = await fetch(input, init);
      status = response.status;
      completed = true;
      return response;
    } finally {
      console.info(JSON.stringify({
        event: "kover.database_request",
        label, traceId, resource, method, status, completed,
        durationMs: Math.round(performance.now() - started),
      }));
    }
  };
}
