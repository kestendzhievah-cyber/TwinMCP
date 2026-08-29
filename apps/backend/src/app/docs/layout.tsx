export default function DocsLayout({ children }: { children: React.ReactNode }) {
  // Supplies the <main> landmark + skip-link target these docs pages otherwise lack.
  return <main id="main-content">{children}</main>;
}
