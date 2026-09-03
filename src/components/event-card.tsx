"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { ClockIcon, MapPinIcon } from "lucide-react";

import { priceLabel, sourceMeta, timeLabel, type EventRow, type Gender } from "@/lib/events";

/** Agenda card for one event; taps open the detail sheet. */
export function EventCard({
  event,
  gender,
  onOpen,
}: {
  event: EventRow;
  gender: Gender;
  onOpen: () => void;
}) {
  const source = sourceMeta(event.source);

  return (
    <motion.button
      layout
      variants={{
        hidden: { opacity: 0, y: 16, scale: 0.98 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
      }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className="group flex w-full gap-3 rounded-2xl border border-border/70 bg-card/80 p-3 text-left shadow-sm outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl sm:size-24">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt=""
            fill
            sizes="96px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/25 to-secondary">
            <span className="text-neon-gradient text-lg font-bold">
              {event.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <ClockIcon className="size-3.5 text-primary/80" />
            {event.starts_at ? timeLabel(event.starts_at) : ""}
            {event.ends_at ? ` – ${timeLabel(event.ends_at)}` : ""}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
              priceLabel(event) === "Free"
                ? "bg-chart-5/15 text-chart-5"
                : "bg-primary/15 text-primary"
            }`}
          >
            {priceLabel(event, gender)}
          </span>
        </div>

        <h3 className="mt-0.5 line-clamp-2 text-sm leading-snug font-semibold sm:text-base">
          {event.title}
        </h3>

        {event.venue_name && (
          <span className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPinIcon className="size-3.5 shrink-0 text-primary/60" />
            {event.venue_name}
          </span>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1.5">
          {event.genres.slice(0, 2).map((genre) => (
            <span
              key={genre}
              className="rounded-full border border-border/70 px-1.5 py-px text-[10px] font-medium text-muted-foreground"
            >
              {genre}
            </span>
          ))}
          {event.genres.length > 2 && (
            <span className="text-[10px] text-muted-foreground">+{event.genres.length - 2}</span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] tracking-wide text-muted-foreground/70 uppercase">
            <span className="size-1.5 rounded-full" style={{ background: source.dot }} />
            {source.label}
          </span>
        </div>
      </div>
    </motion.button>
  );
}
