"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";

type ByDay = Map<string, import("@/lib/events").EventRow[]>;

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const DAY_NUM = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

/** Sticky horizontal day picker with event-count dots; today outlined. */
export function DayStrip({
  days,
  byDay,
  selectedKey,
  onSelect,
}: {
  days: string[];
  byDay: ByDay;
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

  // Keep the selected day centered (mobile-native feel).
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-day="${selectedKey}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedKey]);

  return (
    <div className="no-scrollbar overflow-x-auto scroll-smooth px-3 pb-2" ref={scroller}>
      <div className="flex w-max gap-1.5">
        {days.map((key) => {
          const date = new Date(`${key}T12:00:00Z`);
          const count = byDay.get(key)?.length ?? 0;
          const isSelected = key === selectedKey;
          const isToday = key === today;
          return (
            <button
              key={key}
              data-day={key}
              onClick={() => onSelect(key)}
              aria-pressed={isSelected}
              aria-label={`${WEEKDAY.format(date)} ${DAY_NUM.format(date)} ${MONTH.format(date)}${count ? `, ${count} events` : ""}`}
              className="relative flex w-[3.4rem] shrink-0 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isSelected && (
                <motion.span
                  layoutId="day-pill"
                  className="absolute inset-0 rounded-2xl bg-primary/15 ring-1 ring-primary/45"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span
                className={`relative text-[10px] font-medium tracking-wider uppercase ${
                  isSelected ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {WEEKDAY.format(date)}
              </span>
              <span
                className={`relative text-base leading-none font-semibold tabular-nums ${
                  isSelected ? "text-foreground" : isToday ? "text-primary" : "text-foreground/80"
                }`}
              >
                {DAY_NUM.format(date)}
              </span>
              <span className="relative flex h-1.5 items-center gap-0.5" aria-hidden>
                {count === 0 ? (
                  <span className="size-1 rounded-full bg-transparent" />
                ) : (
                  Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span
                      key={i}
                      className={`size-1 rounded-full ${isSelected ? "bg-primary" : "bg-primary/50"}`}
                    />
                  ))
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
