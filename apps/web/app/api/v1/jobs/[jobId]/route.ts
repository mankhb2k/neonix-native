import { DELETE as deleteRender, GET as getRender } from "@/app/api/v1/renders/[id]/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: Context) {
  const { jobId } = await context.params;
  return getRender(request, { params: Promise.resolve({ id: jobId }) });
}

export async function DELETE(request: Request, context: Context) {
  const { jobId } = await context.params;
  return deleteRender(request, { params: Promise.resolve({ id: jobId }) });
}
