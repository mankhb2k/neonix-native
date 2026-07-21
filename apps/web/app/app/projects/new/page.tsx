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
    <div className="mv-hub">
      <main className="mv-hub-main">
        <p className="mv-hub-lead">Đang chuyển về workspace…</p>
      </main>
    </div>
  );
}
