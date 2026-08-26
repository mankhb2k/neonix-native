import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

export function DocsMarkdown({ markdown }: { markdown: string }) {
  return (
    <article className="docs-md pb-20">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
