import { NextRequest, NextResponse } from "next/server";

/** Stream a Google Drive MP4 through same-origin for future media preview checks. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const upstream = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download`;
  const res = await fetch(upstream, { redirect: "follow" });
  if (!res.ok || !res.body) {
    return NextResponse.json(
      { error: "upstream video unavailable" },
      { status: res.status || 502 },
    );
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "video/mp4",
      "Cache-Control": "public, max-age=300",
      "Accept-Ranges": "bytes",
    },
  });
}
