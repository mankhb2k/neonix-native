import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node: _node, children, ...props }) => (
    <h1
      className="mb-8 scroll-mt-24 text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-[var(--fg-primary)]"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ node: _node, children, ...props }) => (
    <h2
      className="mt-14 mb-5 scroll-mt-24 border-t border-[var(--border-subtle)] pt-5 text-[1.55rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[var(--fg-primary)] first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ node: _node, children, ...props }) => (
    <h3
      className="mt-9 mb-3 scroll-mt-24 text-[1.1rem] font-semibold leading-[1.25] tracking-[-0.015em] text-[var(--fg-primary)]"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ node: _node, children, ...props }) => (
    <h4 className="scroll-mt-20" {...props}>
      {children}
    </h4>
  ),
  p: ({ node: _node, children, ...props }) => (
    <p className="mb-5 leading-7 text-[var(--fg-secondary)]" {...props}>
      {children}
    </p>
  ),
  a: ({ node: _node, children, ...props }) => (
    <a
      className="text-[var(--accent-text)] no-underline hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  ul: ({ node: _node, children, ...props }) => (
    <ul className="mb-4 list-disc pl-[2em]" {...props}>
      {children}
    </ul>
  ),
  ol: ({ node: _node, children, ...props }) => (
    <ol className="mb-4 list-decimal pl-[2em]" {...props}>
      {children}
    </ol>
  ),
  li: ({ node: _node, children, ...props }) => (
    <li className="[&+li]:mt-1" {...props}>
      {children}
    </li>
  ),
  blockquote: ({ node: _node, children, ...props }) => (
    <blockquote
      className="mb-5 rounded-r-xl border-l-2 border-[#0d9488] bg-[#eefaf7] px-5 py-3 text-[var(--fg-secondary)] [&_p]:my-1"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: ({ node: _node, ...props }) => (
    <hr
      className="my-10 h-px border-0 bg-[var(--border-subtle)]"
      {...props}
    />
  ),
  table: ({ node: _node, children, ...props }) => (
    <div className="mb-4 w-full overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 overflow-hidden rounded-xl text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ node: _node, children, ...props }) => (
    <th
      className="border-b border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-left align-top font-semibold text-[var(--fg-primary)] first:border-l"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ node: _node, children, ...props }) => (
    <td
      className="border-b border-r border-[var(--border-subtle)] px-4 py-3 text-left align-top text-[var(--fg-secondary)] first:border-l"
      {...props}
    >
      {children}
    </td>
  ),
  code: ({ node: _node, children, className, ...props }) => (
    <code
      className={`rounded-md bg-[color-mix(in_srgb,var(--fg-primary)_8%,var(--bg-elevated))] px-[0.4em] py-[0.15em] font-mono text-[0.85em] ${className ?? ""}`}
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ node: _node, children, ...props }) => (
    <pre
      className="mb-6 overflow-x-auto rounded-2xl border border-[#1f2937] bg-[var(--code-block-bg)] p-5 text-[13px] leading-[1.7] text-[var(--code-block-fg)] shadow-[0_18px_40px_rgba(15,23,42,0.12)] [&>code]:rounded-none [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[inherit]"
      {...props}
    >
      {children}
    </pre>
  ),
  input: ({ node: _node, ...props }) => (
    <input className="mr-[0.4em]" {...props} />
  ),
};

export function DocsMarkdown({ markdown }: { markdown: string }) {
  return (
    <article className="mx-auto max-w-[56rem] pb-20 text-base leading-[1.7] text-[var(--fg-primary)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={MARKDOWN_COMPONENTS}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
