/**
 * Math/LaTeX rendering component
 * Uses react-markdown with remark-math and rehype-katex
 */

"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

export interface MathRendererProps {
  /** Markdown/LaTeX content to render */
  content: string;
  /** Whether to use inline display (vs block) */
  inline?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders markdown with LaTeX math support
 * Supports both inline ($...$) and display ($$...$$) math
 */
export function MathRenderer({
  content,
  inline = false,
  className = "",
}: MathRendererProps) {
  if (!content) return null;

  return (
    <div
      className={`math-renderer prose prose-invert prose-sm max-w-none ${
        inline ? "inline" : ""
      } ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Customize paragraph rendering for inline mode
          p: ({ children }) =>
            inline ? <span>{children}</span> : <p>{children}</p>,
          // Style code blocks
          code: ({ children, className: codeClassName }) => {
            const isInline = !codeClassName;
            return isInline ? (
              <code className="rounded bg-gray-800 px-1.5 py-0.5 text-sm font-mono text-emerald-400">
                {children}
              </code>
            ) : (
              <code className={codeClassName}>{children}</code>
            );
          },
          // Style links
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      />
    </div>
  );
}
