"use client";

import Image from "next/image";
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  HourglassIcon,
  MapPinIcon,
  TicketIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
  saleOpensLabel,
  sourceMeta,
  timeLabel,
  type EventRow,
  type Gender,
} from "@/lib/events";

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
          className="inset-x-0 mx-auto max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border-border/70 p-0 sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:max-w-lg sm:-translate-y-1/2 sm:rounded-3xl"
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

          <SheetHeader className="px-5 pt-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              <span className="size-2 rounded-full" style={{ background: source.dot }} />
              {source.label}
            </span>
            <SheetTitle className="text-xl leading-tight font-semibold sm:text-2xl">
              {event.title}
            </SheetTitle>
            <SheetDescription className="sr-only">{event.title} event details</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-5 py-4">
            {/* Meta rows */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <CalendarDaysIcon className="size-4.5 shrink-0 text-primary" />
                <span className="font-medium">{dayLabel(dateKey(event.starts_at))}</span>
              </div>
              <div className="flex items-center gap-3">
                <ClockIcon className="size-4.5 shrink-0 text-primary" />
                <span className="tabular-nums">
                  {timeLabel(event.starts_at)}
                  {event.ends_at ? ` – ${timeLabel(event.ends_at)}` : ""}
                </span>
              </div>
              {event.venue_name && (
                <div className="flex items-center gap-3">
                  <MapPinIcon className="size-4.5 shrink-0 text-primary" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{event.venue_name}</span>
                    {event.venue_address && (
                      <span className="text-xs text-muted-foreground">{event.venue_address}</span>
                    )}
                  </span>
                  {event.gmaps_url && (
                    <a
                      href={event.gmaps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/10"
                    >
                      Maps <ArrowUpRightIcon className="size-3.5" />
                    </a>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3">
                <TicketIcon className="size-4.5 shrink-0 text-primary" />
                {prices.early === 0 ? (
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="rounded-full bg-chart-5/15 px-2 py-0.5 text-sm font-semibold text-chart-5">
                      Free entry{gendered ? (gender === "female" ? " · women" : " · men") : ""}
                    </span>
                    {prices.normal != null && prices.normal > 0 && (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        later/up to {prices.normal}€
                      </span>
                    )}
                  </span>
                ) : prices.early == null && prices.normal == null ? (
                  <span className="text-muted-foreground">see ticket page</span>
                ) : (
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold tabular-nums">from {prices.early}€</span>
                    {prices.normal != null && prices.normal !== prices.early && (
                      <span className="text-muted-foreground tabular-nums">
                        up to {prices.normal}€
                      </span>
                    )}
                  </span>
                )}
              </div>
              {saleOpens && (
                <div className="flex items-center gap-3">
                  <HourglassIcon className="size-4.5 shrink-0 text-chart-3" />
                  <span className="text-muted-foreground">
                    Ticket sales open{saleOpens.includes(":") ? "" : ":"}{" "}
                    <span className="font-medium text-foreground tabular-nums">{saleOpens}</span>
                  </span>
                </div>
              )}
            </div>

            {event.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {event.genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary/90"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {event.description && (
              <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {event.description}
              </p>
            )}
          </div>

          <div className="pb-safe sticky bottom-0 border-t border-border/60 bg-popover/95 px-5 py-3 backdrop-blur">
            <Button asChild className="w-full gap-2 text-base sm:h-12">
              <a href={event.url} target="_blank" rel="noopener noreferrer">
                <TicketIcon className="size-4.5" />
                Get tickets
              </a>
            </Button>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
