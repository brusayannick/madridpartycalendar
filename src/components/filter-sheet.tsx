"use client";

import { useMemo } from "react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  applyFilters,
  PRICE_BUCKETS,
  sourceMeta,
  type EventRow,
  type Filters,
  type PriceBucketId,
} from "@/lib/events";

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
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {children}
    </motion.button>
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

  const reset = () =>
    onFiltersChange({ genres: new Set(), priceBuckets: new Set(), sources: new Set() });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="inset-x-0 mx-auto max-h-[85dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border-border/70"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="px-5 pt-3">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription className="sr-only">Filter events by price, genre and source</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-5 pt-2 pb-4">
          <section>
            <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Price
            </h3>
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
          </section>

          <section>
            <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Genres
            </h3>
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
          </section>

          <section>
            <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Source
            </h3>
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
          </section>
        </div>

        <div className="pb-safe sticky bottom-0 flex gap-2 border-t border-border/60 bg-popover/95 px-5 py-3 backdrop-blur">
          <Button variant="ghost" onClick={reset} className="flex-1">
            Reset
          </Button>
          <Button onClick={() => onOpenChange(false)} className="flex-[2]">
            Show {resultCount} event{resultCount === 1 ? "" : "s"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
