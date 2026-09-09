import { GET as downloadRender } from "@/app/api/v1/renders/[id]/download/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: Context) {
  const { jobId } = await context.params;
  return downloadRender(request, { params: Promise.resolve({ id: jobId }) });
}
