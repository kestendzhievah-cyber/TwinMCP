// k6 load test — run with: k6 run scripts/load-test.js
// Install k6: https://k6.io/docs/get-started/installation/
//
// Requires env vars:
//   K6_BASE_URL (default: http://localhost:3000)
//   K6_API_KEY  (a valid ctx7sk_... key)

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE = __ENV.K6_BASE_URL || "http://localhost:3000";
const API_KEY = __ENV.K6_API_KEY || "";

const errorRate = new Rate("errors");
const searchLatency = new Trend("search_latency", true);
const contextLatency = new Trend("context_latency", true);

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    errors: ["rate<0.05"],
  },
};

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

export default function () {
  // Health check
  const health = http.get(`${BASE}/api/health`);
  check(health, { "health 200": (r) => r.status === 200 });

  // Search
  const search = http.get(
    `${BASE}/api/v2/libs/search?query=react+hooks&libraryName=react`,
    { headers }
  );
  searchLatency.add(search.timings.duration);
  const searchOk = check(search, { "search ok": (r) => r.status === 200 || r.status === 401 });
  if (!searchOk) errorRate.add(1);
  else errorRate.add(0);

  sleep(0.5);

  // Context
  const ctx = http.get(
    `${BASE}/api/v2/context?query=useState+hook&libraryId=/facebook/react`,
    { headers }
  );
  contextLatency.add(ctx.timings.duration);
  const ctxOk = check(ctx, { "context ok": (r) => r.status === 200 || r.status === 404 || r.status === 401 });
  if (!ctxOk) errorRate.add(1);
  else errorRate.add(0);

  sleep(0.5);
}
