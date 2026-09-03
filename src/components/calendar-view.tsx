"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeftIcon, ChevronRightIcon, MoonStarIcon, SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DayStrip } from "@/components/day-strip";
import { EventCard } from "@/components/event-card";
import { EventSheet } from "@/components/event-sheet";
import { FilterSheet } from "@/components/filter-sheet";
import {
  activeFilterCount,
  addDaysKey,
  applyFilters,
  dayLabel,
  emptyFilters,
  Filters,
  groupByDay,
  todayKey,
  type EventRow,
} from "@/lib/events";

const MAX_DAYS = 120;

export function CalendarView({ events, demo }: { events: EventRow[]; demo: boolean }) {
  const [selectedKey, setSelectedKey] = useState(() => todayKey());
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = useMemo(() => applyFilters(events, filters), [events, filters]);
  const byDay = useMemo(() => groupByDay(filtered), [filtered]);

  const days = useMemo(() => {
    const start = todayKey();
    const last = [...byDay.keys()].sort().pop();
    const end = last && last > start ? last : addDaysKey(start, 7);
    const list: string[] = [];
    for (let k = start; k <= end && list.length < MAX_DAYS; k = addDaysKey(k, 1)) list.push(k);
    return list;
  }, [byDay]);

  const selectedDayEvents = byDay.get(selectedKey) ?? [];
  const filterCount = activeFilterCount(filters);

  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${selectedKey}T12:00:00Z`));

  const step = (delta: number) => {
    const idx = days.indexOf(selectedKey);
    const next = Math.min(Math.max(idx + delta, 0), days.length - 1);
    setSelectedKey(days[idx === -1 ? 0 : next]);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      {/* Sticky frosted header */}
      <header className="glass sticky top-0 z-40 border-b border-border/60">
        <div className="flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-9 rounded-xl" />
            <div className="min-w-0">
              <h1 className="text-neon-gradient truncate text-lg leading-tight font-semibold tracking-tight">
                Madrid Party Calendar
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {monthLabel}
                {demo && <span className="text-primary/80"> · demo data</span>}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFilterOpen(true)}
            aria-label="Open filters"
            className="relative h-9 gap-1.5 rounded-full"
          >
            <SlidersHorizontalIcon className="size-4" />
            <span className="hidden sm:inline">Filters</span>
            {filterCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
              >
                {filterCount}
              </motion.span>
            )}
          </Button>
        </div>
        <DayStrip
          days={days}
          byDay={byDay}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
        />
      </header>

      {/* Day agenda */}
      <main className="flex-1 px-4 pt-4 pb-safe">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{dayLabel(selectedKey)}</h2>
            <p className="text-xs text-muted-foreground">
              {selectedDayEvents.length === 0
                ? "No events"
                : `${selectedDayEvents.length} event${selectedDayEvents.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} aria-label="Previous day">
              <ChevronLeftIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => step(1)} aria-label="Next day">
              <ChevronRightIcon />
            </Button>
          </div>
        </div>

        {/* Swipe horizontally to change days; vertical scroll stays native. */}
        <motion.div
          key={selectedKey}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            if (info.offset.x < -70) step(1);
            else if (info.offset.x > 70) step(-1);
          }}
        >
          <AnimatePresence mode="popLayout">
            {selectedDayEvents.length > 0 ? (
              <motion.div
                key="list"
                className="grid gap-3 pb-10 sm:grid-cols-2"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.05 } },
                }}
              >
                {selectedDayEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    gender={filters.gender}
                    onOpen={() => setOpenEvent(event)}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/70 py-16 text-center"
              >
                <MoonStarIcon className="size-8 text-muted-foreground/60" />
                <div>
                  <p className="font-medium">Nothing on this night</p>
                  <p className="text-sm text-muted-foreground">
                    Try another day{filterCount > 0 ? " or clear the filters" : ""}
                  </p>
                </div>
                {filterCount > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setFilters(emptyFilters())}>
                    Clear filters
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      <EventSheet
        event={openEvent}
        gender={filters.gender}
        onClose={() => setOpenEvent(null)}
      />
      <FilterSheet
        events={events}
        filters={filters}
        onFiltersChange={setFilters}
        open={filterOpen}
        onOpenChange={setFilterOpen}
      />
    </div>
  );
}
