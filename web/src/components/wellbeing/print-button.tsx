"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" size="lg" onClick={() => window.print()} className="h-11 px-5">
      <Printer data-icon="inline-start" aria-hidden />
      Print or save as PDF
    </Button>
  );
}
