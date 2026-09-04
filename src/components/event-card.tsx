"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { ClockIcon, MapPinIcon } from "lucide-react";

import { priceLabel, sourceMeta, timeLabel, type EventRow, type Gender } from "@/lib/events";

/** Agenda card for one event; taps open the detail sheet. tacto-style hairline card. */
export function EventCard({
  event,
  gender,
  index,
  onOpen,
}: {
  event: EventRow;
  gender: Gender;
  index: number;
  onOpen: () => void;
}) {
  const source = sourceMeta(event.source);
  const free = priceLabel(event) === "Free";

  return (
    <motion.button
      initial={{ opacity: 0, y: 22, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 32,
        delay: Math.min(index * 0.05, 0.35),
      }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onOpen}
      className="group hairline shadow-card flex w-full min-w-0 gap-3 overflow-hidden rounded-xl bg-card p-3 text-left transition-[border-color,box-shadow] duration-300 outline-none hover:border-foreground/35 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg sm:size-24">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt=""
            fill
            sizes="96px"
            loading={index < 2 ? "eager" : undefined}
            // RA flyers sit behind Cloudflare bot protection, which rejects
            // Next's server-side image optimization — load them straight
            // from the browser instead (real browser UAs pass).
            unoptimized={event.source === "ra"}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted">
            <span className="mono-label text-muted-foreground">
              {event.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <span className="mono-label mt-0.5 inline-flex items-center gap-1 text-muted-foreground">
            <ClockIcon className="size-3" strokeWidth={1.5} />
            {event.starts_at ? timeLabel(event.starts_at) : ""}
            {event.ends_at ? ` – ${timeLabel(event.ends_at)}` : ""}
          </span>
          <span className="mono-label flex items-center gap-2 tabular-nums">
            <span className="text-muted-foreground/50">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className={`rounded-[4px] px-1.5 py-0.5 font-medium text-accent-foreground ${
                free ? "bg-mint" : "bg-flame"
              }`}
            >
              {priceLabel(event, gender)}
            </span>
          </span>
        </div>

        <h3 className="mt-1 line-clamp-2 text-[15px] leading-snug font-normal break-words">
          {event.title}
        </h3>

        {event.venue_name && (
          <span className="mt-0.5 inline-flex min-w-0 items-center gap-1 truncate text-xs font-light text-muted-foreground">
            <MapPinIcon className="size-3 shrink-0" strokeWidth={1.5} />
            {event.venue_name}
          </span>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1.5">
          {event.genres.slice(0, 2).map((genre) => (
            <span
              key={genre}
              className="hairline rounded-full px-2 py-px text-[10px] font-light text-muted-foreground"
            >
              {genre}
            </span>
          ))}
          {event.genres.length > 2 && (
            <span className="text-[10px] font-light text-muted-foreground/70">
              +{event.genres.length - 2}
            </span>
          )}
          <span className="mono-label ml-auto inline-flex shrink-0 items-center gap-1.5 text-muted-foreground/80">
            <span className="size-1.5 rounded-full" style={{ background: source.dot }} />
            {source.label}
          </span>
        </div>
      </div>
    </motion.button>
  );
}
