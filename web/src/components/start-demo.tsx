"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { DemoTemplate } from "@/lib/api/types";

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
      <button
        onClick={start}
        disabled={pending}
        className="rounded-full bg-foreground px-6 py-3 font-medium text-background disabled:opacity-60"
      >
        {pending ? "Setting up your family..." : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
