"use client";

import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

// App-wide client providers. reducedMotion="user" makes every Motion
// animation respect the OS reduced-motion setting (see docs/design.md).
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", bounce: 0, duration: 0.32 }}>
      {children}
      <Toaster
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: "!bg-card !text-card-foreground !border-border !rounded-xl !font-sans",
            description: "!text-muted-foreground",
          },
        }}
      />
    </MotionConfig>
  );
}
