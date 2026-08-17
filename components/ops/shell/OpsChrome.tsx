"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BookOpen,
  ClipboardCheck,
  Eye,
  GitFork,
  HandCoins,
  History,
  Home,
  Inbox,
  Microscope,
  PackageCheck,
  RefreshCw,
  Store,
  UsersRound,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import type { ModerationOperator } from "@/lib/moderation/access";
import type { QueueCounts } from "@/lib/moderation/queues";
import type { OpsSidebarSummary } from "@/lib/moderation/sidebar-summary";
import { OpsSidebar, type OpsNavigationSection } from "./OpsSidebar";
import { ShellContext, type ContextFabConfig } from "./OpsShellContext";
import { useOpsOverlay } from "./use-ops-overlay";
import styles from "@/app/(ops)/ops.module.css";
import adaptive from "./ops-tablet.module.css";

const SIDEBAR_INERT_TARGETS = [
  "[data-ops-workspace]",
  "[data-ops-detail]",
  "[data-ops-menu-fab]",
] as const;

interface OpsChromeProps {
  operator: ModerationOperator;
  counts: QueueCounts;
  sidebarSummary: OpsSidebarSummary;
  children: React.ReactNode;
}

export function OpsChrome({
  operator,
  counts,
  sidebarSummary,
  children,
}: OpsChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidebarOpenPath, setSidebarOpenPath] = useState<string | null>(null);
  const sidebarOpen = sidebarOpenPath === pathname;
  const sidebarLayerRef = useRef<HTMLDivElement | null>(null);
  const sidebarTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closeSidebar = useCallback(() => setSidebarOpenPath(null), []);

  const toggleSidebar = useCallback(
    (trigger: HTMLButtonElement) => {
      if (sidebarOpen) {
        closeSidebar();
        return;
      }

      sidebarTriggerRef.current = trigger;
      setSidebarOpenPath(pathname);
    },
    [closeSidebar, pathname, sidebarOpen],
  );

  useOpsOverlay({
    open: sidebarOpen,
    onClose: closeSidebar,
    dialogRef: sidebarLayerRef,
    returnFocusRef: sidebarTriggerRef,
    inertTargetSelectors: SIDEBAR_INERT_TARGETS,
  });

  useEffect(() => {
    const activeTheme =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";
    const timer = setTimeout(() => setTheme(activeTheme), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const overlayViewport = window.matchMedia("(max-width: 819px)");
    const closePersistentSidebar = () => {
      if (!overlayViewport.matches) closeSidebar();
    };

    overlayViewport.addEventListener("change", closePersistentSidebar);
    return () =>
      overlayViewport.removeEventListener("change", closePersistentSidebar);
  }, [closeSidebar]);

  const toggleTheme = (targetTheme: "light" | "dark") => {
    document.documentElement.setAttribute("data-theme", targetTheme);
    document.documentElement.style.colorScheme = targetTheme;
    try {
      localStorage.setItem("jelo-theme", targetTheme);
    } catch {
      // The selected appearance remains active for the current visit.
    }
    setTheme(targetTheme);
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      window.location.assign("/sign-in");
    } catch (err) {
      console.error("Sign-out error:", err);
      window.location.assign("/sign-in");
    }
  };

  const initials =
    sidebarSummary.displayName
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "OP";

  function defaultContextFab(): ContextFabConfig {
    const label =
      pathname === "/ops/activity"
        ? "Refresh insights"
        : pathname === "/ops/signals"
          ? "Refresh signals"
          : pathname === "/ops/operators"
            ? "Refresh operators"
            : pathname === "/ops"
              ? "Refresh queue overview"
              : "Refresh this queue";

    return {
      icon: RefreshCw,
      label,
      onClick: () => router.refresh(),
    };
  }

  const [contextFabState, setContextFabState] = useState<{
    pathname: string;
    value: ContextFabConfig | null;
  }>(() => ({ pathname, value: defaultContextFab() }));
  const contextFab =
    contextFabState.pathname === pathname
      ? (contextFabState.value ?? defaultContextFab())
      : defaultContextFab();
  const setContextFab = useCallback(
    (value: ContextFabConfig | null) => {
      setContextFabState({ pathname, value });
    },
    [pathname],
  );

  const queueItems = [
    {
      href: "/ops/orders",
      label: "Orders",
      icon: PackageCheck,
      count: counts.orders,
    },
    {
      href: "/ops/contributions",
      label: "Contributions",
      icon: Inbox,
      count: counts.contributions,
    },
    {
      href: "/ops/edges",
      label: "Relationships",
      icon: GitFork,
      count: counts.edges,
    },
    {
      href: "/ops/observations",
      label: "Observations",
      icon: Eye,
      count: counts.observations,
    },
    {
      href: "/ops/vocabulary",
      label: "Vocabulary",
      icon: BookOpen,
      count: counts.values,
    },
    {
      href: "/ops/research",
      label: "Research",
      icon: Microscope,
      count: counts.research,
    },
    {
      href: "/ops/retailers",
      label: "Retailers",
      icon: Store,
      count: counts.retailers,
    },
  ];

  const monitorItems = [
    { href: "/ops", label: "Queue overview", icon: Home, count: null },
    { href: "/ops/activity", label: "Insights", icon: History, count: null },
    { href: "/ops/signals", label: "Signals", icon: Activity, count: null },
    {
      href: "/ops/care-evidence",
      label: "Care evidence",
      icon: ClipboardCheck,
      count: null,
    },
  ];

  const manageItems =
    operator.role === "admin"
      ? [
          {
            href: "/ops/service-fees",
            label: "Service fees",
            icon: HandCoins,
            count: null,
          },
          {
            href: "/ops/operators",
            label: "Operators",
            icon: UsersRound,
            count: null,
          },
        ]
      : [];

  const navSections: OpsNavigationSection[] = [
    { label: "Triage", items: queueItems },
    { label: "Monitor", items: monitorItems },
    ...(manageItems.length > 0
      ? [{ label: "Manage", items: manageItems }]
      : []),
  ];

  const tabletDestinations = [
    { href: "/ops", label: "Home" },
    { href: "/ops/contributions", label: "Queue" },
    { href: "/ops/observations", label: "Review" },
  ];

  const bottomBarItems = [
    { href: "/ops", label: "Home", icon: Home },
    { href: "/ops/contributions", label: "Queue", icon: Inbox },
    { href: "/ops/observations", label: "Review", icon: Eye },
    { href: "/ops/activity", label: "Insights", icon: History },
  ];

  return (
    <div className={styles.body}>
      <div
        className={`${styles.container} ${adaptive.shell}`}
        data-ops-shell
        data-sidebar-open={sidebarOpen ? "true" : "false"}
      >
        <div
          id="ops-navigation-panel"
          ref={sidebarLayerRef}
          className={adaptive.sidebarLayer}
          data-ops-sidebar-layer
          role={sidebarOpen ? "dialog" : undefined}
          aria-modal={sidebarOpen ? "true" : undefined}
          aria-labelledby={sidebarOpen ? "ops-navigation-heading" : undefined}
          tabIndex={sidebarOpen ? -1 : undefined}
        >
          <div className={adaptive.sheetHeader}>
            <h2 id="ops-navigation-heading" className={adaptive.sheetTitle}>
              Menu
            </h2>
            <button
              type="button"
              className={adaptive.sheetClose}
              onClick={closeSidebar}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
          <OpsSidebar
            operator={operator}
            summary={sidebarSummary}
            pathname={pathname}
            sections={navSections}
            theme={theme}
            onThemeChange={toggleTheme}
            onSignOut={handleSignOut}
          />
        </div>

        <button
          type="button"
          className={adaptive.sidebarScrim}
          onClick={closeSidebar}
          tabIndex={-1}
          aria-hidden="true"
        />

        <button
          type="button"
          data-ops-menu-fab
          className={adaptive.menuFab}
          onClick={(event) => toggleSidebar(event.currentTarget)}
          aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={sidebarOpen}
          aria-controls="ops-navigation-panel"
        >
          <span
            className={`${styles.operatorAvatar} ${adaptive.menuFabAvatar}`}
            aria-hidden="true"
          >
            {initials}
          </span>
        </button>

        <div
          data-ops-workspace
          className={`${styles.contentWrapper} ${adaptive.contentWrapper}`}
        >
          <nav
            className={adaptive.tabletIsland}
            aria-label="Primary operations navigation"
          >
            <button
              type="button"
              className={adaptive.islandMenu}
              onClick={(event) => toggleSidebar(event.currentTarget)}
              aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={sidebarOpen}
              aria-controls="ops-navigation-panel"
            >
              <span
                className={`${styles.operatorAvatar} ${adaptive.islandAvatar}`}
                aria-hidden="true"
              >
                {initials}
              </span>
            </button>
            {tabletDestinations.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${adaptive.islandLink} ${pathname === item.href ? adaptive.islandLinkActive : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <ShellContext.Provider value={{ contextFab, setContextFab }}>
            <main
              data-ops-main
              tabIndex={-1}
              className={`${styles.main} ${adaptive.main}`}
            >
              {children}
            </main>
          </ShellContext.Provider>

          <nav className={adaptive.bottomBar} aria-label="Primary navigation">
            {bottomBarItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className={`${adaptive.bottomBarItem} ${pathname === item.href ? adaptive.bottomBarItemActive : ""}`}
                >
                  <Icon size={24} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {contextFab &&
            (() => {
              const FabIcon = contextFab.icon;
              return (
                <button
                  type="button"
                  data-ops-context-fab
                  className={adaptive.bottomBarAction}
                  onClick={contextFab.onClick}
                  aria-label={contextFab.label}
                >
                  <FabIcon size={24} />
                </button>
              );
            })()}
        </div>
        <div
          data-ops-detail
          id="ops-detail-pane"
          className={`${styles.detailPane} ${adaptive.detailPane}`}
        />
      </div>
    </div>
  );
}
