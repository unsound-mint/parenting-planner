"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { DemoTemplate } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

export function StartDemo({ template, label }: { template: DemoTemplate; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    const { error } = await api.POST("/demo/sessions", { body: { template } });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    router.push("/family");
  }

  return (
    <div>
      <Button onClick={start} disabled={pending} size="lg" className="h-11 rounded-full px-6 text-base">
        {pending ? "Setting up your family..." : label}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
