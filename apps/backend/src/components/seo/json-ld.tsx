// Server-rendered JSON-LD injector. Pass one or more schema.org objects;
// each is emitted as its own <script type="application/ld+json"> tag.

interface JsonLdProps {
  data: object | object[];
}

// Escape "<" so a "</script>" that ever appears in a value (today only static
// config, but community-published names could flow here later) can't break out
// of the tag — defense-in-depth against stored XSS.
function safeJson(item: object): string {
  return JSON.stringify(item).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: JsonLdProps) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJson(item) }}
        />
      ))}
    </>
  );
}
