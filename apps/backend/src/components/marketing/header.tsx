"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { SmitheryNotice } from "./smithery-notice";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics/funnel";
import { attributedHref } from "@/components/analytics/attribution-links";
import type { Locale } from "@/lib/i18n/locales";
import { walletFacts } from "@/components/pricing/wallet-copy";

type NavLink = { href: Route; label: string };

const EN = walletFacts("en");
const FR = walletFacts("fr");

// The header CTA names the sign-up credit (spec §4.9), read from the wallet
// facts so it never drifts from what the ledger grants.
const T = {
  en: {
    pricing: "Pricing",
    servers: "Servers",
    solutions: "Solutions",
    docs: "Docs",
    security: "Security",
    blog: "Blog",
    signIn: "Sign in",
    cta: `Get ${EN.signupCredit} free`,
    home: "TwinMCP — home",
    nav: "Primary",
    menu: "Menu",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  fr: {
    pricing: "Tarifs",
    servers: "Serveurs",
    solutions: "Solutions",
    docs: "Docs",
    security: "Sécurité",
    blog: "Blog",
    signIn: "Se connecter",
    cta: `${FR.signupCredit} offerts`,
    home: "TwinMCP — accueil",
    nav: "Navigation principale",
    menu: "Menu",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },
} as const;

function buildNav(locale: Locale): NavLink[] {
  const t = T[locale];
  const fr = locale === "fr";
  // Spec §4.9 order. Every entry has a French twin.
  return [
    { href: (fr ? "/fr/tarifs" : "/plans") as Route, label: t.pricing },
    { href: (fr ? "/fr/serveurs" : "/servers") as Route, label: t.servers },
    { href: (fr ? "/fr/solutions" : "/solutions") as Route, label: t.solutions },
    { href: (fr ? "/fr/docs" : "/docs") as Route, label: t.docs },
    { href: (fr ? "/fr/securite" : "/security") as Route, label: t.security },
    { href: (fr ? "/fr/blog" : "/blog") as Route, label: t.blog },
  ];
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const HOME_PATHS = new Set(["/", "/fr"]);

// "One rose primary per viewport" (spec §1, §2.4). The header CTA is rose only
// when the page's own primary action is out of sight:
// - the home hero CTA (`#hero-cta` / `hero_primary`), the final CTA (`final`)
//   any element a page marks `data-page-primary`, and any other in-page rose
//   button (a link or button carrying the default Button's `bg-primary`, e.g.
//   the offer band or a closing CTA) demote the header CTA to outline while
//   they are on screen;
// - the sticky mobile bar (`sticky_mobile`) owns the phone's primary, so the
//   phone header CTA stays outline on pages that have it (or a hero CTA, which
//   the sticky bar takes over from).
const HERO_PRIMARY = '#hero-cta, [data-cta-location="hero_primary"]';
const IN_VIEW_PRIMARY = `${HERO_PRIMARY}, [data-cta-location="final"], [data-page-primary]`;
const MOBILE_PRIMARY = `${HERO_PRIMARY}, [data-cta-location="sticky_mobile"]`;
// In-page rose buttons. `class~=` matches the whole class token, so outline
// buttons (hover:bg-accent…) never match. The header's own CTAs and the sticky
// bar are excluded below: they are what this decision drives.
const ROSE_BUTTON = 'a[class~="bg-primary"], button[class~="bg-primary"]';
const SELF_LOCATIONS = new Set(["header", "header_mobile", "header_menu", "sticky_mobile"]);

// Paths whose page is expected to render one of the above, so the first paint
// already has the right button (no rose flash before the observer runs). The
// effect corrects it either way.
function expectsOwnPrimary(pathname: string): boolean {
  return (
    HOME_PATHS.has(pathname) ||
    pathname === "/plans" ||
    pathname === "/fr/tarifs" ||
    isActive(pathname, "/servers") ||
    isActive(pathname, "/fr/serveurs")
  );
}

function usePagePrimary(pathname: string, headerRef: RefObject<HTMLElement | null>) {
  const [state, setState] = useState(() => ({
    inView: HOME_PATHS.has(pathname),
    mobileOwned: expectsOwnPrimary(pathname),
  }));

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setState({ inView: false, mobileOwned: document.querySelector(MOBILE_PRIMARY) !== null });
      return;
    }
    const own = (el: Element) =>
      headerRef.current?.contains(el) ||
      SELF_LOCATIONS.has(el.getAttribute("data-cta-location") ?? "");
    let mobileOwned = false;
    const visible = new Set<Element>();
    // Only commit a change: an unchanged state never re-renders the header, so
    // the MutationObserver below cannot feed itself.
    const publish = () => {
      const inView = visible.size > 0;
      setState((prev) =>
        prev.inView === inView && prev.mobileOwned === mobileOwned ? prev : { inView, mobileOwned }
      );
    };
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      publish();
    });
    // Client components render rose buttons after mount (dialogs, estimator
    // states, hydrated pages): re-collect on DOM changes, once a frame, like
    // the dashboard sidebar (app/dashboard/nav.tsx).
    let observed = new Set<Element>();
    let frame = 0;
    const collect = () => {
      frame = 0;
      mobileOwned = document.querySelector(MOBILE_PRIMARY) !== null;
      const next = new Set<Element>([
        ...document.querySelectorAll(IN_VIEW_PRIMARY),
        ...Array.from(document.querySelectorAll(ROSE_BUTTON)).filter((el) => !own(el)),
      ]);
      for (const el of observed) {
        if (next.has(el)) continue;
        io.unobserve(el);
        visible.delete(el);
      }
      for (const el of next) if (!observed.has(el)) io.observe(el);
      observed = next;
      publish();
    };
    collect();
    const mo =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            if (!frame) frame = requestAnimationFrame(collect);
          });
    mo?.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      mo?.disconnect();
      io.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname, headerRef]);

  return state;
}

const DESKTOP_LINK =
  "rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function MarketingHeader({ locale = "en" }: { locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const t = T[locale];
  const navLinks = buildNav(locale);
  const homeHref = (locale === "fr" ? "/fr" : "/") as Route;
  // French visitors sign up and sign in on the French forms.
  const signUpHref = (locale === "fr" ? "/fr/inscription" : "/sign-up") as Route;
  const signInHref = (locale === "fr" ? "/fr/connexion" : "/sign-in") as Route;

  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const headerRef = useRef<HTMLElement>(null);
  const primary = usePagePrimary(pathname, headerRef);

  // A navigation closes the menu sheet, and so does widening the window past
  // the breakpoint where the sheet is hidden (its scroll lock would stay on).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (wide.matches) setOpen(false);
    };
    onChange();
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [open]);

  // Landing CTAs (hero, pricing, final block…) are server-rendered, so rather
  // than shipping a client island per button, this header — mounted once on
  // every marketing page — reports clicks on any element carrying
  // `data-cta-location` as `cta_clicked`. Capture phase, so it runs before the
  // link navigates and even if a handler stops propagation.
  //
  // It also forwards the campaign keys of the current URL (utm_*, gclid, ref)
  // to sign-up / pricing / onboarding links: a Next.js <Link> navigates with
  // its React `href` prop, not the DOM href that <AttributionLinks/> rewrote,
  // so a plain left click on such a link is re-routed with the keys attached.
  // Running at the document's capture phase, the preventDefault() reaches the
  // <Link> before it navigates (it skips default-prevented clicks).
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const el = event.target.closest<HTMLElement>("[data-cta-location]");
      if (el) {
        track({
          name: "cta_clicked",
          properties: {
            location: el.dataset.ctaLocation ?? "unknown",
            locale,
            target: el.getAttribute("href") ?? "",
          },
        });
      }

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const next = attributedHref(anchor);
      if (!next) return;
      event.preventDefault();
      router.push(next as Route);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [locale, router]);

  return (
    <>
      {/* Announcement bar, above the sticky header (spec §4.9), home pages only. */}
      {HOME_PATHS.has(pathname) && (
        <SmitheryNotice locale={locale} renderedAt={Date.now()} placement="top" />
      )}

      <header
        ref={headerRef}
        className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link
            href={homeHref}
            className="inline-flex min-h-10 shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={t.home}
          >
            <Logo />
          </Link>

          <nav className="ml-4 hidden items-center gap-6 lg:flex" aria-label={t.nav}>
            {navLinks.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    DESKTOP_LINK,
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher className="hidden md:inline-flex" />
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link href={signInHref}>{t.signIn}</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={primary.inView ? "outline" : "default"}
              className="hidden md:inline-flex"
            >
              <Link href={signUpHref} data-cta-location="header">
                {t.cta}
              </Link>
            </Button>

            {/* Phones keep one CTA in the bar, next to the menu toggle. */}
            <Button
              asChild
              size="sm"
              variant={primary.inView || primary.mobileOwned ? "outline" : "default"}
              className="md:hidden"
            >
              <Link href={signUpHref} data-cta-location="header_mobile">
                {t.cta}
              </Link>
            </Button>

            <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
              <DialogPrimitive.Trigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t.openMenu}
                  className="-mr-2 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DialogPrimitive.Trigger>
              <DialogPrimitive.Portal>
                <DialogPrimitive.Content
                  aria-describedby={undefined}
                  className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background focus:outline-none lg:hidden"
                >
                  <DialogPrimitive.Title className="sr-only">{t.menu}</DialogPrimitive.Title>
                  <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
                    <Link
                      href={homeHref}
                      aria-label={t.home}
                      className="inline-flex min-h-10 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setOpen(false)}
                    >
                      <Logo />
                    </Link>
                    <DialogPrimitive.Close asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t.closeMenu}
                        className="-mr-2"
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </DialogPrimitive.Close>
                  </div>

                  <nav aria-label={t.nav} className="flex flex-col gap-1 px-4 pb-4 pt-4 sm:px-6">
                    {navLinks.map((l) => {
                      const active = isActive(pathname, l.href);
                      return (
                        <Link
                          key={l.href}
                          href={l.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex min-h-12 items-center rounded-lg px-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active
                              ? "bg-brand/10 font-semibold text-brand"
                              : "text-foreground hover:bg-accent"
                          )}
                        >
                          {l.label}
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="mt-auto flex flex-col gap-3 border-t border-border px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6">
                    <Button asChild size="lg" className="w-full">
                      <Link
                        href={signUpHref}
                        data-cta-location="header_menu"
                        onClick={() => setOpen(false)}
                      >
                        {t.cta}
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="lg" className="w-full">
                      <Link href={signInHref} onClick={() => setOpen(false)}>
                        {t.signIn}
                      </Link>
                    </Button>
                    <div className="flex justify-center pt-1">
                      <LanguageSwitcher />
                    </div>
                  </div>
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          </div>
        </div>
      </header>
    </>
  );
}
