"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckIcon } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  applyFilters,
  emptyFilters,
  PRICE_BUCKETS,
  sourceMeta,
  type EventRow,
  type Filters,
  type Gender,
  type PriceBucketId,
} from "@/lib/events";

const GENDERS: Array<{ id: Gender; label: string }> = [
  { id: "any", label: "Everyone" },
  { id: "female", label: "Women" },
  { id: "male", label: "Men" },
];

/** tacto chip: outlined pill → ink fill with a spring + check pop. */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      layout
      whileTap={{ scale: 0.93 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      onClick={onClick}
      aria-pressed={active}
      className={`hairline relative rounded-full px-3.5 py-1.5 text-[13px] font-light transition-colors duration-300 ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        <AnimatePresence initial={false}>
          {active && (
            <motion.span
              key="check"
              initial={{ scale: 0, width: 0, opacity: 0 }}
              animate={{ scale: 1, width: "auto", opacity: 1 }}
              exit={{ scale: 0, width: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
              className="overflow-hidden"
            >
              <CheckIcon className="size-3" strokeWidth={2} />
            </motion.span>
          )}
        </AnimatePresence>
        {children}
      </span>
    </motion.button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mono-label mb-3 text-muted-foreground">{title}</h3>
      {children}
      {hint && <p className="mt-2.5 text-xs leading-relaxed font-light text-muted-foreground">{hint}</p>}
    </section>
  );
}

/** Bottom-sheet filter panel: price buckets, genres, sources. */
export function FilterSheet({
  events,
  filters,
  onFiltersChange,
  open,
  onOpenChange,
}: {
  events: EventRow[];
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) for (const g of e.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  }, [events]);

  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [events]);

  const resultCount = useMemo(() => applyFilters(events, filters).length, [events, filters]);

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const reset = () => onFiltersChange(emptyFilters());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="inset-x-0 mx-auto max-h-[85dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="px-5 pt-3">
          <SheetTitle className="font-display text-2xl tracking-[-0.02em]">Filters</SheetTitle>
          <SheetDescription className="sr-only">Filter events by price, genre and source</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-5 pt-3 pb-4">
          <Section
            title="Prices for"
            hint="Guest-list offers can differ by gender (e.g. “chicas gratis” nights)."
          >
            <div className="flex flex-wrap gap-2">
              {GENDERS.map((g) => (
                <Chip
                  key={g.id}
                  active={filters.gender === g.id}
                  onClick={() => onFiltersChange({ ...filters, gender: g.id })}
                >
                  {g.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Price">
            <div className="flex flex-wrap gap-2">
              {PRICE_BUCKETS.map((bucket) => (
                <Chip
                  key={bucket.id}
                  active={filters.priceBuckets.has(bucket.id)}
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      priceBuckets: toggle(filters.priceBuckets, bucket.id as PriceBucketId),
                    })
                  }
                >
                  {bucket.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Genres">
            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {genres.map((genre) => (
                <Chip
                  key={genre}
                  active={filters.genres.has(genre)}
                  onClick={() =>
                    onFiltersChange({ ...filters, genres: toggle(filters.genres, genre) })
                  }
                >
                  {genre}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Source">
            <div className="flex flex-wrap gap-2">
              {sources.map((source) => {
                const meta = sourceMeta(source);
                return (
                  <Chip
                    key={source}
                    active={filters.sources.has(source)}
                    onClick={() =>
                      onFiltersChange({ ...filters, sources: toggle(filters.sources, source) })
                    }
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: meta.dot }} />
                      {meta.label}
                    </span>
                  </Chip>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="pb-safe sticky bottom-0 flex gap-2 border-t border-border bg-popover/95 px-5 py-3 backdrop-blur">
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            onClick={reset}
            className="hairline flex-1 rounded-lg bg-background py-2.5 text-sm font-light transition-colors duration-300 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Reset
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            onClick={() => onOpenChange(false)}
            className="flex-[2] rounded-lg bg-primary py-2.5 text-sm font-normal text-primary-foreground transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Show {resultCount} event{resultCount === 1 ? "" : "s"}
          </motion.button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
