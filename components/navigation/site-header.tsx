"use client";

import { ChevronRight, Equal, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useModalDialog } from "@/components/ui/use-modal-dialog";
import styles from "./site-header.module.css";

const mobileLinks = [
  {
    href: "/concerns",
    label: "Concerns",
    detail: "Start with what you notice",
  },
  { href: "/products", label: "Products", detail: "Find what fits" },
  {
    href: "/contribute",
    label: "Contribute",
    detail: "Tell us what you use",
  },
  { href: "/consult", label: "Ask JeloCare", detail: "Create a simple guide" },
  { href: "/me", label: "Me", detail: "Your care workspace" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const {
    dialogRef: menuDialogRef,
    triggerRef: menuTriggerRef,
    open: openMenu,
    close: closeMenu,
  } = useModalDialog();

  function openSearch() {
    if (pathname === "/search") {
      window.dispatchEvent(new Event("jelocare:focus-global-search"));
      document.getElementById("global-search-input")?.focus();
      return;
    }
    router.push("/search");
  }

  useEffect(() => {
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() =>
        setScrolled(window.scrollY > 48),
      );
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (
        (!isTyping && event.key === "/") ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
        if (pathname === "/search") {
          window.dispatchEvent(new Event("jelocare:focus-global-search"));
          document.getElementById("global-search-input")?.focus();
        } else {
          router.push("/search");
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, router]);

  return (
    <>
      <header
        className={`${styles.header} ${isHome && !scrolled ? styles.homeHeader : ""} ${scrolled ? styles.scrolled : ""}`}
      >
        <Link className={styles.logo} href="/">
          JELOCARE
        </Link>

        <nav className={styles.nav} aria-label="Primary navigation">
          <div className={styles.links}>
            <Link href="/concerns">Concerns</Link>
            <Link href="/products">Products</Link>
            <Link className={styles.utilityLink} href="/brands">
              Brands
            </Link>
            <Link className={styles.utilityLink} href="/share">
              Price watch
            </Link>
            <Link href="/contribute">Contribute</Link>
            <Link href="/consult">Consult</Link>
            <Link className={styles.memberLink} href="/me">
              Me
            </Link>
          </div>

          <button
            className={styles.searchTrigger}
            type="button"
            onClick={openSearch}
            aria-label="Open search"
          >
            <Search size={18} aria-hidden="true" />
            <span>Search</span>
          </button>

          <button
            className={styles.menuTrigger}
            type="button"
            ref={menuTriggerRef}
            onClick={openMenu}
            aria-haspopup="dialog"
            aria-controls="mobile-navigation"
          >
            <Equal size={19} aria-hidden="true" />
            <span className="sr-only">Open menu</span>
          </button>
        </nav>
      </header>

      <dialog
        className={styles.menuDialog}
        id="mobile-navigation"
        ref={menuDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-navigation-title"
        onClick={(event) => {
          if (event.target === menuDialogRef.current) closeMenu();
        }}
      >
        <div className={styles.menuSheet}>
          <header className={styles.menuHeading}>
            <div>
              <p>Explore</p>
              <h2 id="mobile-navigation-title">JeloCare</h2>
            </div>
            <button type="button" onClick={closeMenu} aria-label="Close menu">
              <X size={19} aria-hidden="true" />
            </button>
          </header>
          <nav className={styles.mobileLinks} aria-label="Mobile navigation">
            {mobileLinks.map((link) => (
              <Link
                href={link.href}
                onClick={closeMenu}
                aria-current={
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? "page"
                    : undefined
                }
                key={link.href}
              >
                <span>
                  <strong>{link.label}</strong>
                  <small>{link.detail}</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <div className={styles.mobileSecondary}>
            <Link href="/brands" onClick={closeMenu}>
              Brands
            </Link>
            <Link href="/share" onClick={closeMenu}>
              Price watch
            </Link>
            <Link href="/ingredients" onClick={closeMenu}>
              Ingredients
            </Link>
            <Link href="/retailers" onClick={closeMenu}>
              Retailers
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
