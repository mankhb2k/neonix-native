import { notFound } from "next/navigation";
import { BlockLabDetail } from "@/components/lab/BlockLabDetail";
import { getMotionBlock } from "@motionvideo/template-library";

type Props = {
  params: Promise<{ blockId: string }>;
};

export default async function BlockLabDetailPage({ params }: Props) {
  const { blockId } = await params;
  const id = decodeURIComponent(blockId);
  const block = getMotionBlock(id);
  if (!block) notFound();
  return <BlockLabDetail block={block} />;
}
