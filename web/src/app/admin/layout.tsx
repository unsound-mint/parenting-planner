import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PRODUCT_NAME } from "@/lib/product";

// Frame for /admin. There is no sign-in: every visitor administers their own
// demo copy (see docs/product.md). A real product would put staff auth here.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-6 pb-16 md:px-8">
      <header className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold tracking-tight">{PRODUCT_NAME}</p>
        <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-label text-muted-foreground transition-colors duration-150 hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Back to the demo
        </Link>
      </header>
      {children}
    </div>
  );
}
