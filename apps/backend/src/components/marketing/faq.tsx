import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Section } from "./section";

export interface FaqItem {
  q: string;
  a: React.ReactNode;
}

const defaultItems: FaqItem[] = [
  {
    q: "What is MCP, exactly?",
    a: "Model Context Protocol — an open spec from Anthropic that lets AI agents talk to external tools and data through a standard interface. An MCP server exposes capabilities (filesystem access, GitHub queries, SQL, anything you can wrap in JSON-RPC); your IDE-side client (Cursor, Claude Code, Windsurf) calls them. TwinMCP is the runtime where those servers actually live.",
  },
  {
    q: "Do I need to know about Upstash Box?",
    a: "No. Upstash Box is the underlying micro-VM runtime — TwinMCP wraps it so you only see servers, MCPs, and config. We expose `runtime + install_cmd + start_cmd` because that's what the Box pre-installed runtimes (node, python, go, ruby, rust) need; you fill them once when publishing your own MCP, never when installing.",
  },
  {
    q: "Can I run my own custom MCP?",
    a: "Yes — if you're on Pro or Team. Publish a public package, point us at the install command, and pick the runtime. We start it in your isolated server, serve it on a per-key URL, and ship logs back to your dashboard. Private MCPs (publish-to-self only) are on the Pro tier.",
  },
  {
    q: "Can I self-host TwinMCP?",
    a: "Not yet. The control plane (Next.js + Postgres) is open-source-ready, but the orchestration layer is currently coupled to Upstash Box. Self-host is on the roadmap — drop your email at the bottom of /docs to vote on it.",
  },
  {
    q: "Will pricing change?",
    a: "Free tier and the public quotas (1 server free, 25 on Pro) are committed for 12 months minimum. We may add new tiers above Team. We will not retroactively reduce anyone's quota — if we ever do, your subscription is grandfathered.",
  },
  {
    q: "How do I cancel?",
    a: "Two clicks in /dashboard/billing → 'Manage subscription'. Your servers keep running until the end of the period, then move to read-only. No cancel-by-email, no retention call.",
  },
];

interface FaqProps {
  items?: FaqItem[];
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  id?: string;
}

export function Faq({
  items = defaultItems,
  eyebrow = "FAQ",
  title = "Questions that come up before signing up",
  description = "If something's missing, send it to hello@twinmcp.dev — answers feed back into this list.",
  id = "faq",
}: FaqProps = {}) {
  return (
    <Section id={id} eyebrow={eyebrow} title={title} description={description}>
      <div className="mx-auto max-w-3xl">
        <Accordion type="single" collapsible className="w-full">
          {items.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
