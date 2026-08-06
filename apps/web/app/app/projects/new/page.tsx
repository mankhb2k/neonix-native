"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { appHref } from "@/components/AppLink";

/** Legacy route — gửi về workspace; tạo mới dùng modal. */
export default function NewProjectRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(appHref("/"));
  }, [router]);

  return (
    <div className="min-h-screen text-[var(--fg-primary)] [background:radial-gradient(ellipse_70%_45%_at_12%_-8%,rgba(13,148,136,0.1)_0%,transparent_55%),radial-gradient(ellipse_55%_40%_at_92%_8%,rgba(2,132,199,0.08)_0%,transparent_50%),var(--bg-app)]">
      <main className="mx-auto max-w-[920px] px-6 pt-11 pb-16">
        <p className="m-0 max-w-[36rem] text-[1.05rem] leading-[1.65] text-[var(--fg-muted)]">
          Đang chuyển về workspace…
        </p>
      </main>
    </div>
  );
}
