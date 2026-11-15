"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveTopic } from "@/app/family/[memberId]/learn/questions/actions";
import type { LibraryItem } from "./catalogue";

/** Library items with an optimistic save toggle: the bookmark fills at once and springs back if the API says no. */
export function useSavable(memberId: string, initial: LibraryItem[]) {
  const [items, setItems] = useState(initial);
  async function save(item: LibraryItem) {
    if (!item.topicId) return;
    const next = !item.saved;
    const put = (v: boolean) => setItems((list) => list.map((i) => (i.id === item.id ? { ...i, saved: v } : i)));
    put(next);
    if ((await saveTopic(memberId, item.topicId, next)) === null) {
      put(!next);
      toast.error("Could not save that. Please try again.");
    }
  }
  return [items, save] as const;
}
