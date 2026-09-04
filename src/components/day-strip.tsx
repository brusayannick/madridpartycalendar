"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";

type ByDay = Map<string, import("@/lib/events").EventRow[]>;

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const DAY_NUM = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" });

/** Sticky horizontal day picker — tacto-style outlined pills with an ink fill. */
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
    <div className="no-scrollbar overflow-x-auto scroll-smooth px-4 pb-3" ref={scroller}>
      <div className="flex w-max gap-1.5">
        {days.map((key) => {
          const date = new Date(`${key}T12:00:00Z`);
          const count = byDay.get(key)?.length ?? 0;
          const isSelected = key === selectedKey;
          const isToday = key === today;
          return (
            <motion.button
              key={key}
              data-day={key}
              onClick={() => onSelect(key)}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              aria-pressed={isSelected}
              aria-label={`${WEEKDAY.format(date)} ${date.getDate()}${count ? `, ${count} events` : ""}`}
              className="relative flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isSelected && (
                <motion.span
                  layoutId="day-pill"
                  className="hairline absolute inset-0 rounded-lg bg-primary"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                />
              )}
              <span
                className={`mono-label relative transition-colors duration-300 ${
                  isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}
              >
                {WEEKDAY.format(date)}
              </span>
              <span
                className={`relative text-[15px] leading-none font-light tabular-nums transition-colors duration-300 ${
                  isSelected ? "text-primary-foreground" : "text-foreground"
                }`}
              >
                {DAY_NUM.format(date)}
              </span>
              <span className="relative flex h-1.5 items-center gap-0.5" aria-hidden>
                {isToday ? (
                  <motion.span
                    key="today"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`size-1.5 rounded-full ${
                      isSelected ? "bg-sun" : "bg-flame"
                    }`}
                  />
                ) : count === 0 ? (
                  <span className="size-1 rounded-full bg-transparent" />
                ) : (
                  Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span
                      key={i}
                      className={`size-1 rounded-full ${
                        isSelected ? "bg-primary-foreground/60" : "bg-muted-foreground/40"
                      }`}
                    />
                  ))
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
