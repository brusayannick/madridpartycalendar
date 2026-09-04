"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightIcon, PartyPopperIcon } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import type { Gender } from "@/lib/events";

const STEPS = 3;
const MAX_PRICE_STOP = 50; // slider max; MAX = "no limit"

/**
 * First-visit onboarding: gender → max ticket price → have fun.
 * Answers become the initial filters; everything stays changeable later.
 */
export function Onboarding({
  open,
  onFinish,
}: {
  open: boolean;
  onFinish: (prefs: { gender: Gender; maxPrice: number } | null) => void;
}) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [gender, setGender] = useState<Gender>("any");
  const [maxPrice, setMaxPrice] = useState(0);

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const finish = () => onFinish({ gender, maxPrice });
  const skip = () => onFinish(null);

  const variants = {
    enter: (dir: number) => ({ x: dir * 80, opacity: 0, filter: "blur(4px)" }),
    center: { x: 0, opacity: 1, filter: "blur(0px)" },
    exit: (dir: number) => ({ x: dir * -80, opacity: 0, filter: "blur(4px)" }),
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="onboarding"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[60] flex flex-col bg-background"
        >
          {/* progress ticks — tacto numbered steps */}
          <div className="flex justify-center gap-1.5 pt-[max(env(safe-area-inset-top),1.75rem)]">
            {Array.from({ length: STEPS }).map((_, i) => (
              <motion.span
                key={i}
                initial={false}
                animate={{
                  backgroundColor:
                    i < step ? "var(--flame)" : i === step ? "var(--foreground)" : "var(--muted)",
                  width: i === step ? 28 : 12,
                }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="h-1.5 rounded-full"
              />
            ))}
          </div>

          <div className="relative flex flex-1 items-center overflow-hidden px-6">
            <AnimatePresence mode="popLayout" custom={direction} initial={false}>
              {step === 0 && (
                <motion.section
                  key="gender"
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full space-y-7 text-center"
                >
                  <p className="mono-label text-muted-foreground">01 — who&apos;s coming</p>
                  <div>
                    <h2 className="font-display text-3xl leading-[1.1] sm:text-4xl">
                      Welcome to
                      <br />
                      Madrid nights
                    </h2>
                    <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed font-light text-muted-foreground">
                      Guest-list prices often differ by gender. Who are you going out as?
                    </p>
                  </div>
                  <div className="mx-auto grid max-w-xs gap-2">
                    {(
                      [
                        { id: "female", label: "Woman", emoji: "💃" },
                        { id: "male", label: "Man", emoji: "🕺" },
                        { id: "any", label: "Prefer not to say", emoji: "✨" },
                      ] as const
                    ).map((option, i) => (
                      <motion.button
                        key={option.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setGender(option.id);
                          go(1);
                        }}
                        className={`hairline flex items-center justify-between rounded-lg px-5 py-4 text-left font-normal transition-colors duration-300 ${
                          gender === option.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-card hover:bg-primary hover:text-primary-foreground"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="text-xl">{option.emoji}</span> {option.label}
                        </span>
                        <ArrowRightIcon className="size-4" strokeWidth={1.5} />
                      </motion.button>
                    ))}
                  </div>
                </motion.section>
              )}

              {step === 1 && (
                <motion.section
                  key="price"
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full space-y-8 text-center"
                >
                  <p className="mono-label text-muted-foreground">02 — your budget</p>
                  <div>
                    <h2 className="font-display text-3xl leading-[1.1] sm:text-4xl">
                      Price per ticket
                    </h2>
                    <p className="mt-3 text-sm font-light text-muted-foreground">
                      Events above this get filtered out.
                    </p>
                  </div>
                  <div className="mx-auto max-w-xs space-y-5">
                    <motion.p
                      key={maxPrice}
                      initial={{ scale: 0.9, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 26 }}
                      className="font-display text-5xl tabular-nums"
                    >
                      {maxPrice === MAX_PRICE_STOP ? (
                        <span className="text-flame">No limit</span>
                      ) : (
                        <>≤ {maxPrice}€</>
                      )}
                    </motion.p>
                    <Slider
                      value={[maxPrice]}
                      min={0}
                      max={MAX_PRICE_STOP}
                      step={5}
                      onValueChange={([v]) => setMaxPrice(v)}
                      aria-label="Maximum ticket price"
                    />
                    <div className="mono-label flex justify-between text-muted-foreground">
                      <span>0€</span>
                      <span>25€</span>
                      <span>50€+</span>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 500, damping: 26 }}
                    onClick={() => go(2)}
                    className="mx-auto flex h-11 w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-primary text-sm font-normal text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    Continue <ArrowRightIcon className="size-4" strokeWidth={1.5} />
                  </motion.button>
                </motion.section>
              )}

              {step === 2 && (
                <motion.section
                  key="fun"
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full space-y-7 text-center"
                >
                  <p className="mono-label text-muted-foreground">03 — done</p>
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
                    className="hairline mx-auto flex size-20 items-center justify-center rounded-2xl bg-card"
                  >
                    <PartyPopperIcon className="text-flame size-9" strokeWidth={1.25} />
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="font-display text-4xl leading-[1.1]"
                  >
                    Have fun
                    <br />
                    out there 🌙
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mx-auto max-w-xs text-sm leading-relaxed font-light text-muted-foreground"
                  >
                    Madrid has a party for every night — it&apos;s all in your calendar now.
                    Change your gender and price settings anytime under{" "}
                    <span className="font-normal text-foreground">Filters</span>.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                  >
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 500, damping: 26 }}
                      onClick={finish}
                      className="mx-auto flex h-12 w-full max-w-xs items-center justify-center rounded-lg bg-flame text-[15px] font-normal text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      Let&apos;s go
                    </motion.button>
                  </motion.div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          <div className="pb-[max(env(safe-area-inset-bottom),1.25rem)] text-center">
            <button
              onClick={skip}
              className="link-sweep mono-label text-muted-foreground hover:text-foreground"
            >
              {step > 0 ? "skip setup" : "skip for now"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
