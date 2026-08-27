"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { bootstrapDevSession } from "@/lib/api/dev-auth";

export function DevDemoAuth() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    void bootstrapDevSession()
      .then((signedIn) => {
        if (signedIn) {
          window.dispatchEvent(new Event("neonix:dev-demo-authenticated"));
          router.refresh();
        }
      })
      .catch(() => undefined);
  }, [router]);

  return null;
}
