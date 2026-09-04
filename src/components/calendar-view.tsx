"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ListIcon,
  MapIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
} from "lucide-react";

import { DayStrip } from "@/components/day-strip";
import { EventCard } from "@/components/event-card";
import { EventSheet } from "@/components/event-sheet";
import { FilterSheet } from "@/components/filter-sheet";
import { Onboarding } from "@/components/onboarding";
import { ThemeToggle } from "@/components/theme-provider";
import {
  activeFilterCount,
  addDaysKey,
  applyFilters,
  dayLabel,
  emptyFilters,
  Filters,
  groupByDay,
  priceLabel,
  sourceMeta,
  todayKey,
  type EventRow,
} from "@/lib/events";

// MapLibre is client-only and heavy — code-split it.
const MapView = dynamic(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-muted/60" />,
});

const PREFS_KEY = "mpc:prefs";
const ONBOARDED_KEY = "mpc:onboarded";

interface Prefs {
  gender: "any" | "female" | "male";
  maxPrice: number; // 0 = no limit
}

/** Map onboarding answers onto the filter model. */
function prefsToFilters(prefs: Partial<Prefs>, current: Filters): Filters {
  const next: Filters = { ...current, priceBuckets: new Set(current.priceBuckets) };
  if (prefs.gender) next.gender = prefs.gender;
  if (prefs.maxPrice !== undefined) {
    const buckets = new Set<string>();
    if (prefs.maxPrice > 0) {
      buckets.add("free");
      if (prefs.maxPrice >= 10) buckets.add("u10");
      if (prefs.maxPrice >= 20) buckets.add("10-20");
      if (prefs.maxPrice >= 30) buckets.add("20+");
    }
    next.priceBuckets = buckets as Filters["priceBuckets"];
  }
  return next;
}

const MAX_DAYS = 120;

/** tacto-style wordmark: lowercase + terminal dot in flame orange. */
function Wordmark() {
  return (
    <h1 className="text-[17px] leading-none font-normal tracking-[-0.02em] whitespace-nowrap select-none">
      madrid parties
      <motion.span
        aria-hidden
        className="text-flame inline-block"
        animate={{ opacity: [1, 0.35, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        .
      </motion.span>
    </h1>
  );
}

export function CalendarView({ events, demo }: { events: EventRow[]; demo: boolean }) {
  const [selectedKey, setSelectedKey] = useState(() => todayKey());
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [openEvent, setOpenEvent] = useState<EventRow | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  // Direction of the last day change — drives the slide transition.
  const [direction, setDirection] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const directionRef = useRef(0);
  void directionRef;

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 6));

  // First visit: run the onboarding; otherwise restore saved preferences.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (localStorage.getItem(ONBOARDED_KEY)) {
        try {
          const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Prefs;
          setFilters((f) => ({ ...f, ...prefsToFilters(prefs, f) }));
        } catch {
          /* fresh start */
        }
      } else {
        setOnboardingOpen(true);
      }
      setPrefsLoaded(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const finishOnboarding = (prefs: Prefs | null) => {
    localStorage.setItem(ONBOARDED_KEY, "1");
    if (prefs) {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      setFilters((f) => prefsToFilters(prefs, f));
    }
    setOnboardingOpen(false);
  };

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

  /** Switch day with a directional slide animation. */
  const goDay = (key: string) => {
    setDirection(key > selectedKey ? 1 : key < selectedKey ? -1 : 0);
    setSelectedKey(key);
  };

  const step = (delta: number) => {
    const idx = days.indexOf(selectedKey);
    const next = Math.min(Math.max(idx + delta, 0), days.length - 1);
    goDay(days[idx === -1 ? 0 : next]);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      {/* Sticky frosted header — hairline border fades in on scroll */}
      <header
        className={`glass sticky top-0 z-40 transition-[border-color,box-shadow] duration-500 ${
          scrolled ? "border-b border-border shadow-[0_1px_0_oklch(0_0_0/4%)]" : "border-b border-transparent"
        }`}
      >
        <div className="flex items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Wordmark />
            {demo && (
              <span className="mono-label bg-flame rounded-md px-1.5 py-0.5 text-accent-foreground">
                demo
              </span>
            )}
          </div>
          <ThemeToggle />
          <motion.button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-label="Open filters"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className="hairline relative flex h-9 items-center gap-1.5 rounded-lg bg-card px-3 text-[13px] font-light text-foreground transition-colors duration-300 hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <SlidersHorizontalIcon className="size-3.5" />
            <span className="hidden sm:inline">Filters</span>
            <AnimatePresence>
              {filterCount > 0 && (
                <motion.span
                  key={filterCount}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 24 }}
                  className="bg-flame mono-label flex min-w-4.5 items-center justify-center rounded-[4px] px-1 py-px font-medium text-accent-foreground"
                >
                  {filterCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
        <DayStrip days={days} byDay={byDay} selectedKey={selectedKey} onSelect={goDay} />
      </header>

      {/* Day agenda */}
      <main className="flex flex-1 flex-col px-4 pt-6 pb-safe">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="mono-label text-muted-foreground">
              {monthLabel} · {selectedDayEvents.length} event
              {selectedDayEvents.length === 1 ? "" : "s"}
            </p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={selectedKey}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="font-display mt-1 truncate text-[26px] leading-tight sm:text-3xl"
              >
                {dayLabel(selectedKey)}
              </motion.h2>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-1.5 pb-0.5">
            {selectedDayEvents.length > 0 && (
              <div className="hairline mr-1 flex rounded-lg bg-card p-0.5">
                {(
                  [
                    { id: "list", icon: ListIcon, label: "List view" },
                    { id: "map", icon: MapIcon, label: "Map view" },
                  ] as const
                ).map(({ id, icon: Icon, label }) => (
                  <motion.button
                    key={id}
                    onClick={() => setView(id)}
                    aria-label={label}
                    aria-pressed={view === id}
                    whileTap={{ scale: 0.85 }}
                    className="relative flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {view === id && (
                      <motion.span
                        layoutId="view-pill"
                        className="absolute inset-0 rounded-md bg-primary"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                    <Icon
                      className={`relative size-4 transition-colors duration-200 ${
                        view === id ? "text-primary-foreground" : "text-muted-foreground"
                      }`}
                    />
                  </motion.button>
                ))}
              </div>
            )}
            {[
              { icon: ArrowLeftIcon, delta: -1, label: "Previous day" },
              { icon: ArrowRightIcon, delta: 1, label: "Next day" },
            ].map(({ icon: Icon, delta, label }) => (
              <motion.button
                key={label}
                onClick={() => step(delta)}
                aria-label={label}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 500, damping: 26 }}
                className="hairline flex size-9 items-center justify-center rounded-lg bg-card text-foreground transition-colors duration-300 hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Icon className="size-4" />
              </motion.button>
            ))}
          </div>
        </div>

        {view === "map" && selectedDayEvents.length > 0 ? (
          <motion.div
            key="day-map"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-[60dvh] flex-1"
          >
              <MapView
                points={selectedDayEvents
                  .filter((e) => e.latitude != null && e.longitude != null)
                  .map((e) => ({
                    id: e.id,
                    lat: e.latitude!,
                    lng: e.longitude!,
                    color: sourceMeta(e.source).dot,
                    label: priceLabel(e, filters.gender).replace("–", "-"),
                    title: `${e.title} · ${e.venue_name ?? ""}`,
                  }))}
                onSelect={(id) => {
                  const event = selectedDayEvents.find((e) => e.id === id);
                  if (event) setOpenEvent(event);
                }}
                className="hairline shadow-card h-[60dvh] w-full overflow-hidden rounded-xl sm:h-[65dvh]"
              />
              <p className="mono-label pt-3 pb-6 text-center text-muted-foreground">
                Tap a pin to open the event
              </p>
          </motion.div>
        ) : (
          /* Swipe horizontally to change days; vertical scroll stays native. */
          <motion.div
            key={`list-${selectedKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70) step(1);
              else if (info.offset.x > 70) step(-1);
            }}
          >
            <AnimatePresence mode="popLayout" custom={direction} initial={false}>
              {selectedDayEvents.length > 0 ? (
                <motion.div
                  key="list"
                  custom={direction}
                  variants={{
                    enter: (dir: number) => ({ x: dir >= 0 ? 44 : -44, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit: (dir: number) => ({ x: dir >= 0 ? -44 : 44, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="grid gap-3 pb-10 sm:grid-cols-2"
                >
                  {selectedDayEvents.map((event, i) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      gender={filters.gender}
                      index={i}
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
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="hairline flex flex-col items-center gap-3 rounded-xl bg-card/50 px-6 py-16 text-center"
                >
                    <SparklesIcon className="size-7 text-muted-foreground/70" strokeWidth={1.25} />
                    <div>
                      <p className="font-normal">Nothing on this night</p>
                      <p className="mt-1 text-sm font-light text-muted-foreground">
                        Try another day{filterCount > 0 ? " or clear the filters" : ""}
                      </p>
                    </div>
                    {filterCount > 0 && (
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.94 }}
                        transition={{ type: "spring", stiffness: 500, damping: 26 }}
                        onClick={() => setFilters(emptyFilters())}
                        className="link-sweep mt-1 text-sm text-foreground underline-offset-4"
                      >
                        Clear filters
                      </motion.button>
                    )}
                  </motion.div>
                )}
            </AnimatePresence>
          </motion.div>
        )}
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
      {prefsLoaded && <Onboarding open={onboardingOpen} onFinish={finishOnboarding} />}
    </div>
  );
}
