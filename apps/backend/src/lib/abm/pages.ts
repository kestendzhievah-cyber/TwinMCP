// Account-based marketing (ABM) pages: one private pitch page per prospect at
// /for/<slug>, written for THAT prospect and sent as a direct link in
// outreach. Pages are noindex, out of the sitemap and never linked from the
// site — the URL is the invitation. Page views are tracked cookielessly
// server-side (trackPageServed), so an open shows up in analytics without a
// consent banner. Add a prospect = add an entry here.

export type AbmUseCase = {
  title: string;
  body: string;
  /** Catalogue MCP names shown as chips under the card (plain labels). */
  mcps: string[];
};

export type AbmPage = {
  slug: string;
  /** Prospect name as rendered on the page ("Prepared for <prospect>"). */
  prospect: string;
  title: string;
  titleAccent: string;
  lead: string;
  useCases: AbmUseCase[];
  /** Example prompts, in the prospect's own vocabulary. */
  asks: string[];
  /** One line under the try-it steps saying where their credentials are. */
  sandboxNote: string;
};

export const ABM_PAGES: Record<string, AbmPage> = {
  iceweb: {
    slug: "iceweb",
    prospect: "IceWeb",
    title: "An AI workspace for every ",
    titleAccent: "IceWeb client",
    lead: "You already sell AI-driven growth and AI-engine visibility. TwinMCP is the layer underneath: hosted MCP servers that connect Claude, Cursor or any MCP client to each client's analytics, search data, CMS and store — one URL, one key per analyst, a full audit trail.",
    useCases: [
      {
        title: "SEO & reporting",
        body: "Pull a client's Search Console quick wins, run GA4 core and realtime reports, and check live SERPs — from inside the model, in one conversation.",
        mcps: ["Google Analytics", "Google Search Console", "DataForSEO"],
      },
      {
        title: "Content & CMS",
        body: "Read, draft and update posts and pages on client WordPress sites with an application password — metas, rewrites and publishing without touching the admin.",
        mcps: ["WordPress", "Fetch", "DuckDuckGo"],
      },
      {
        title: "E-commerce clients",
        body: "Products, variants, orders and customers of a client's Shopify store, plus their HubSpot CRM records, available to the model with scoped tokens.",
        mcps: ["Shopify", "HubSpot"],
      },
      {
        title: "Governance you can sell",
        body: "A dedicated, isolated server per client. Per-analyst API keys. Logs of every call. When a client asks what the AI can see, you have a precise answer.",
        mcps: ["Per-client servers", "API keys", "Audit logs"],
      },
    ],
    asks: [
      "Pull Search Console quick wins for acme.com — positions 4–20, over 100 impressions — and draft the action list.",
      "Compare GA4 sessions and conversions for the last two months. Where did paid traffic drop?",
      "Rewrite the meta descriptions of these twelve WordPress posts and update them.",
      "Which Shopify products had orders this week, and which of those customers are not in HubSpot yet?",
    ],
    sandboxNote:
      "Your sandbox credentials — a live server URL and an API key — are in the email that brought you here. Paste them in and ask away.",
  },
};
