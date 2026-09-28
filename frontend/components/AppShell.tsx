import Link from "next/link";
import type { ReactNode } from "react";

import {
  PRODUCT_SUBTITLE_SHORT,
  PRODUCT_WORDMARK,
} from "@/lib/copy/product";

/**
 * Navigation — UX.md §3, adapted to the BurnInGuard AI product structure.
 *
 * The agent stages and the two validation gates remain first-class named
 * concepts. The agentic workflow is never collapsed behind a generic "AI
 * Analysis" entry, because the point of the product is that the investigation is
 * inspectable.
 *
 * Three availability states, deliberately distinct:
 *
 *   available   linked; the backend contract exists
 *   scoped      shown but not linked; the capability IS implemented but needs an
 *               open component or investigation to address (UX.md §4)
 *   not-built   shown but not linked, marked N/I; the backend contract does not
 *               exist (design.md §10.2)
 *
 * Conflating `scoped` with `not-built` would misrepresent working capability as
 * missing, and marking `not-built` as available would produce a dead end. Both
 * failures are worse than showing the distinction.
 */
type Availability = "available" | "scoped" | "not-built";

interface NavItem {
  readonly label: string;
  readonly href?: string;
  readonly availability: Availability;
  /** For `scoped`: what must be open first. */
  readonly scope?: "component" | "investigation";
  /** For `not-built`: why it is absent. Rendered as the tooltip. */
  readonly absence?: string;
}

interface NavGroup {
  readonly heading: string;
  readonly items: readonly NavItem[];
}

const NAV: readonly NavGroup[] = [
  {
    heading: "Screening",
    items: [
      { label: "Components", href: "/components", availability: "available" },
      { label: "Lots", href: "/lots", availability: "available" },
      {
        label: "Stress Runs",
        availability: "not-built",
        absence:
          "No run resource exists. test_id is an attribute on the component summary, not an addressable burn-in run.",
      },
      { label: "Telemetry", availability: "scoped", scope: "component" },
      { label: "Anomaly Detection", availability: "scoped", scope: "component" },
      {
        label: "Component Projection",
        availability: "scoped",
        scope: "component",
      },
    ],
  },
  {
    heading: "Investigation",
    items: [
      { label: "Start Investigation", href: "/investigations/new", availability: "available" },
      { label: "Investigation Pipeline", availability: "scoped", scope: "investigation" },
      { label: "Engineering Calculations", availability: "scoped", scope: "investigation" },
      { label: "Drift Analysis", availability: "scoped", scope: "investigation" },
      { label: "Evidence Explorer", availability: "scoped", scope: "investigation" },
      { label: "Hypothesis Comparison", availability: "scoped", scope: "investigation" },
      { label: "Validation", availability: "scoped", scope: "investigation" },
      { label: "Engineering Report", availability: "scoped", scope: "investigation" },
      { label: "Provenance", availability: "scoped", scope: "investigation" },
    ],
  },
  {
    heading: "Knowledge",
    items: [
      { label: "Engineering Knowledge Base", href: "/knowledge", availability: "available" },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "Investigation History", href: "/history", availability: "available" },
      { label: "Pipeline Status", href: "/system/readiness", availability: "available" },
      { label: "Architecture", href: "/architecture", availability: "available" },
      {
        label: "Configuration",
        availability: "not-built",
        absence: "No configuration endpoint exists. Configuration is environment-driven.",
      },
    ],
  },
];

function NavLink({ item }: { item: NavItem }) {
  if (item.availability === "available" && item.href) {
    return (
      <Link
        href={item.href}
        className="block px-[var(--ss-space-2)] py-[var(--ss-space-1)] text-[var(--ss-text-secondary)] hover:bg-[var(--ss-bg-raised)] hover:text-[var(--ss-text-primary)]"
        style={{ borderRadius: "var(--ss-radius-sm)" }}
      >
        {item.label}
      </Link>
    );
  }

  const isScoped = item.availability === "scoped";
  const marker = isScoped ? (item.scope === "component" ? "CMP" : "INV") : "N/I";
  const title = isScoped
    ? `Scoped to an open ${item.scope}. Open one to reach this view.`
    : item.absence;

  return (
    <span
      className="flex items-center justify-between gap-[var(--ss-space-2)] px-[var(--ss-space-2)] py-[var(--ss-space-1)] text-[var(--ss-text-muted)]"
      title={title}
    >
      <span>{item.label}</span>
      <span className="ss-field-label shrink-0">{marker}</span>
    </span>
  );
}

/**
 * AppShell — persistent application shell (UX.md §3).
 *
 * The context rail is NOT rendered here: per UX.md §4 it is visible "while an
 * investigation is open", so it is owned by
 * `app/investigations/[investigationId]/layout.tsx`. That nested layout does not
 * remount across the investigation sub-routes, which is what makes the rail
 * survive route changes and panel-level API errors (UX.md §4, §31).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <nav
        className="flex w-full shrink-0 flex-col gap-[var(--ss-space-5)] border-b border-[var(--ss-border-subtle)] bg-[var(--ss-bg-inset)] p-[var(--ss-space-4)] lg:h-full lg:w-[228px] lg:border-b-0 lg:border-r lg:overflow-y-auto"
        aria-label="Primary"
      >
        <Link href="/" className="flex flex-col gap-[var(--ss-space-1)]">
          <span
            className="ss-mono font-medium tracking-wide text-[var(--ss-text-primary)]"
            style={{ fontSize: "var(--ss-text-title-size)" }}
          >
            {PRODUCT_WORDMARK}
          </span>
          <span className="ss-field-label">{PRODUCT_SUBTITLE_SHORT}</span>
        </Link>

        <Link
          href="/"
          className="border border-[var(--ss-border-strong)] px-[var(--ss-space-2)] py-[var(--ss-space-1)] text-center text-[var(--ss-text-primary)] hover:border-[var(--ss-accent)]"
          style={{ borderRadius: "var(--ss-radius-sm)" }}
        >
          Screening Overview
        </Link>

        {NAV.map((group) => (
          <div key={group.heading} className="flex flex-col gap-[var(--ss-space-1)]">
            <span className="ss-field-label px-[var(--ss-space-2)]">{group.heading}</span>
            {group.items.map((item) => (
              <NavLink key={item.label} item={item} />
            ))}
          </div>
        ))}

        <div className="mt-auto flex flex-col gap-[var(--ss-space-2)]">
          <span className="ss-field-label">Legend</span>
          <p
            className="text-[var(--ss-text-muted)]"
            style={{ fontSize: "var(--ss-text-label-size)" }}
          >
            <span className="ss-mono">CMP</span> needs an open component.{" "}
            <span className="ss-mono">INV</span> needs an open investigation.{" "}
            <span className="ss-mono">N/I</span> not implemented in this backend.
          </p>
        </div>
      </nav>

      <main className="flex-1 lg:overflow-y-auto">
        <div className="flex flex-col gap-[var(--ss-space-4)] p-[var(--ss-space-4)] lg:p-[var(--ss-space-6)]">
          {children}
        </div>
      </main>
    </div>
  );
}
