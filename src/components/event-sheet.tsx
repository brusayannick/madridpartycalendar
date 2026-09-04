"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { motion } from "motion/react";
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  HourglassIcon,
  MapPinIcon,
  TicketIcon,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  dayLabel,
  dateKey,
  effectivePrices,
  priceLabel,
  saleOpensLabel,
  sourceMeta,
  timeLabel,
  type EventRow,
  type Gender,
} from "@/lib/events";

// MapLibre is client-only and heavy — code-split it.
const MapView = dynamic(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => <div className="h-52 w-full animate-pulse rounded-lg bg-muted/60" />,
});

/** Full event details — bottom sheet on mobile, centered dialog on desktop. */
export function EventSheet({
  event,
  gender,
  onClose,
}: {
  event: EventRow | null;
  gender: Gender;
  onClose: () => void;
}) {
  const source = sourceMeta(event?.source ?? "");
  const saleOpens = event ? saleOpensLabel(event) : null;
  const prices = event ? effectivePrices(event, gender) : { early: null, normal: null };
  const gendered =
    event != null &&
    ((gender === "female" && event.price_early_female != null) ||
      (gender === "male" && event.price_early_male != null));

  return (
    <Sheet open={Boolean(event)} onOpenChange={(open) => !open && onClose()}>
      {event && (
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="inset-x-0 mx-auto max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl p-0 sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:max-w-lg sm:-translate-y-1/2 sm:rounded-2xl"
        >
          {/* Grabber */}
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />

          {event.image_url && (
            <div className="relative mt-2 h-44 w-full shrink-0 sm:h-52">
              <Image
                src={event.image_url}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 448px"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-popover via-transparent to-transparent" />
            </div>
          )}

          <SheetHeader className="px-5 pt-4">
            <span className="mono-label inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="size-1.5 rounded-full" style={{ background: source.dot }} />
              {source.label}
            </span>
            <SheetTitle className="font-display text-2xl leading-[1.15] tracking-[-0.02em] sm:text-[28px]">
              {event.title}
            </SheetTitle>
            <SheetDescription className="sr-only">{event.title} event details</SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-5 py-5">
            {/* Meta rows — tacto spec table: hairline dividers, mono labels */}
            <div className="hairline divide-y divide-border rounded-lg">
              <div className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                <CalendarDaysIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span className="font-normal">{dayLabel(dateKey(event.starts_at))}</span>
              </div>
              <div className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                <ClockIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span className="font-mono text-[13px] tabular-nums">
                  {timeLabel(event.starts_at)}
                  {event.ends_at ? ` – ${timeLabel(event.ends_at)}` : ""}
                </span>
              </div>
              {event.venue_name && (
                <div className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                  <MapPinIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-normal">{event.venue_name}</span>
                    {event.venue_address && (
                      <span className="text-xs font-light text-muted-foreground">
                        {event.venue_address}
                      </span>
                    )}
                  </span>
                  {event.gmaps_url && (
                    <a
                      href={event.gmaps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hairline inline-flex shrink-0 items-center gap-1 rounded-md bg-background px-2 py-1 text-xs font-light transition-colors duration-300 hover:bg-primary hover:text-primary-foreground"
                    >
                      Maps <ArrowUpRightIcon className="size-3.5" />
                    </a>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                <TicketIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                {prices.early === 0 ? (
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="mono-label rounded-[4px] bg-mint px-1.5 py-0.5 font-medium text-accent-foreground">
                      free entry{gendered ? (gender === "female" ? " · women" : " · men") : ""}
                    </span>
                    {prices.normal != null && prices.normal > 0 && (
                      <span className="text-xs font-light text-muted-foreground tabular-nums">
                        later/up to {prices.normal}€
                      </span>
                    )}
                  </span>
                ) : prices.early == null && prices.normal == null ? (
                  <span className="text-muted-foreground">see ticket page</span>
                ) : (
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[15px] font-normal tabular-nums">from {prices.early}€</span>
                    {prices.normal != null && prices.normal !== prices.early && (
                      <span className="text-xs font-light text-muted-foreground tabular-nums">
                        up to {prices.normal}€
                      </span>
                    )}
                  </span>
                )}
              </div>
              {saleOpens && (
                <div className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                  <HourglassIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  <span className="font-light text-muted-foreground">
                    Sales open{saleOpens.includes(":") ? "" : ":"}{" "}
                    <span className="font-mono text-[13px] font-normal text-foreground tabular-nums">
                      {saleOpens}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {event.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {event.genres.map((genre) => (
                  <span
                    key={genre}
                    className="hairline rounded-full px-2.5 py-0.5 text-xs font-light text-muted-foreground"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {event.description && (
              <p className="text-sm leading-relaxed font-light whitespace-pre-line text-muted-foreground">
                {event.description}
              </p>
            )}

            {event.latitude != null && event.longitude != null && (
              <div className="space-y-2">
                <MapView
                  points={[
                    {
                      id: event.id,
                      lat: event.latitude,
                      lng: event.longitude,
                      color: source.dot,
                      label: priceLabel(event, gender) === "Free" ? "0€" : undefined,
                      title: event.venue_name ?? event.title,
                    },
                  ]}
                  className="hairline h-52 w-full overflow-hidden rounded-lg"
                />
                <p className="mono-label text-center text-muted-foreground">
                  {event.venue_name}
                  {event.gmaps_url && (
                    <>
                      {" · "}
                      <a
                        href={event.gmaps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-sweep text-foreground"
                      >
                        open in google maps
                      </a>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="pb-safe sticky bottom-0 border-t border-border bg-popover/95 px-5 py-3 backdrop-blur">
            <motion.a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-flame text-[15px] font-normal text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <TicketIcon className="size-4.5" strokeWidth={1.5} />
              Get tickets
            </motion.a>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
