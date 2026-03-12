type RateLimitRequest = {
  maxRequests: number;
  windowEnd: number;
};

type RateLimitResponse = {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
};

export class RateLimiter {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/ping") {
      return Response.json({ ok: true });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const { maxRequests, windowEnd } =
      (await request.json()) as RateLimitRequest;
    const current = (await this.state.storage.get<number>("count")) ?? 0;
    const count = current + 1;
    const allowed = count <= maxRequests;

    await this.state.storage.put("count", count);
    await this.state.storage.setAlarm(windowEnd);

    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((windowEnd - Date.now()) / 1000)
    );

    return Response.json({
      allowed,
      count,
      remaining: Math.max(0, maxRequests - count),
      retryAfterSeconds,
    } satisfies RateLimitResponse);
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}
