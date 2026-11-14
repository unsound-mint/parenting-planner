"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { Bell, BellOff, CheckCheck, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";
import type { NotificationList } from "@/lib/api/types";
import { agoWords, notificationHref, notificationTarget } from "@/lib/notifications";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

const triggerClass =
  "relative flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:bg-muted data-[popup-open]:text-foreground md:size-9";

const wide = "(min-width: 768px)";
const subscribe = (cb: () => void) => {
  const q = window.matchMedia(wide);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};

/**
 * The bell in the family header. The list comes from the layout (server) and is
 * redrawn when a live update of kind notification refreshes it. Marking as read
 * answers with the new list, which stays on screen until the server's list
 * changes. Popover on desktop, bottom sheet on phones.
 */
export function NotificationBell({ memberId, role, initial }: { memberId: string; role: Role; initial: NotificationList }) {
  const [open, setOpen] = useState(false);
  const isWide = useSyncExternalStore(subscribe, () => window.matchMedia(wide).matches, () => true);
  // Server list changed (new notification, or the real read state): it wins over what this tab last saw.
  const signature = initial.items.map((i) => `${i.id}${i.readAt ?? ""}`).join();
  const [local, setLocal] = useState<{ signature: string; list: NotificationList } | null>(null);
  const list = local && local.signature === signature ? local.list : initial;

  async function markRead(ids?: string[]) {
    const now = new Date().toISOString();
    const unread = list.items.filter((i) => !i.readAt && (!ids || ids.includes(i.id)));
    if (unread.length === 0) return;
    const items = list.items.map((i) => (unread.includes(i) ? { ...i, readAt: now } : i));
    setLocal({ signature, list: { items, unreadCount: Math.max(0, list.unreadCount - unread.length) } });
    const { data } = await api.POST("/members/{memberId}/notifications/read", { params: { path: { memberId } }, body: ids ? { ids } : {} });
    if (data) setLocal({ signature, list: data });
  }

  const label = list.unreadCount > 0 ? `Notifications, ${list.unreadCount} unread` : "Notifications";
  const trigger = (
    <>
      <Bell aria-hidden className="size-4.5" />
      {list.unreadCount > 0 && (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-late px-1 font-mono text-[10px] leading-none font-semibold text-card md:top-0 md:right-0"
        >
          {list.unreadCount > 9 ? "9+" : list.unreadCount}
        </span>
      )}
    </>
  );
  const panel = (sheet: boolean) => (
    <Panel
      list={list}
      onClose={sheet ? () => setOpen(false) : undefined}
      memberId={memberId}
      role={role}
      onOpenItem={(id) => {
        void markRead([id]);
        setOpen(false);
      }}
      onMarkAll={() => void markRead()}
    />
  );

  if (isWide) {
    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger aria-label={label} title="Notifications" className={triggerClass}>
          {trigger}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
            <Popover.Popup className="flex max-h-[min(32rem,calc(100dvh-6rem))] w-96 flex-col rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg outline-none">
              {panel(false)}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger aria-label={label} className={triggerClass}>
        {trigger}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-border bg-popover pb-[env(safe-area-inset-bottom)] text-popover-foreground shadow-lg outline-none transition-transform duration-300 ease-out data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full">
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />
          {panel(true)}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Panel({
  list,
  memberId,
  role,
  onOpenItem,
  onMarkAll,
  onClose,
}: {
  list: NotificationList;
  memberId: string;
  role: Role;
  onOpenItem: (id: string) => void;
  onMarkAll: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <h2 className="flex-1 text-title">Notifications</h2>
        {list.unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAll}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-label text-primary outline-none transition-colors duration-150 hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-9"
          >
            <CheckCheck aria-hidden className="size-4" />
            Mark all read
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted"
          >
            <X aria-hidden className="size-4.5" />
          </button>
        )}
      </div>
      {list.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 pt-6 pb-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <BellOff aria-hidden className="size-6" />
          </span>
          <p className="text-title">You are all caught up</p>
          <p className="text-label text-muted-foreground">Offers, handoffs and reminders show up here.</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain px-2 pb-2">
          {list.items.map((n) => {
            const target = notificationTarget[n.kind];
            const Icon = target?.icon ?? Bell;
            const unread = !n.readAt;
            return (
              <li key={n.id}>
                <Link
                  href={notificationHref(n, memberId, role)}
                  onClick={() => onOpenItem(n.id)}
                  className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-3 outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span aria-hidden className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", target?.tint ?? "bg-muted text-muted-foreground")}>
                    <Icon className="size-4.5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn("text-label text-balance", unread ? "font-semibold" : "font-normal text-muted-foreground")}>{n.title}</span>
                    <time dateTime={n.createdAt} className="font-mono text-caption text-muted-foreground">
                      {agoWords(n.createdAt)}
                    </time>
                  </span>
                  {unread && <span className="size-2 shrink-0 rounded-full bg-status-late" aria-label="Unread" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
