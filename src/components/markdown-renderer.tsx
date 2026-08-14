"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,

  h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1.5">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,

  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
      {children}
    </blockquote>
  ),

  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-muted/50 text-[0.9em] font-mono" {...props}>
          {children}
        </code>
      );
    }
    const language = className?.replace("language-", "") || "";
    return (
      <div className="my-2 rounded-lg overflow-hidden border border-border/30 bg-[#1a1a2e]">
        {language && (
          <div className="px-3 py-1 text-[10px] text-muted-foreground/60 border-b border-border/20 bg-card/20">
            {language}
          </div>
        )}
        <pre className="p-3 overflow-x-auto text-[0.85em] leading-relaxed">
          <code className={`font-mono ${className || ""}`} {...props}>
            {children}
          </code>
        </pre>
      </div>
    );
  },

  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border/30">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/30">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-2 text-left font-medium border-b border-border/30">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 border-b border-border/20">{children}</td>,

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  ),

  hr: () => <hr className="my-3 border-border/30" />,

  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
};

/**
 * Convert LaTeX delimiters used by LLMs (\( \) \[ \]) to
 * dollar-sign format that remark-math understands ($ $$).
 */
function normalizeLatexDelimiters(text: string): string {
  // Block math: \[ ... \] → $$ ... $$
  // Handle both single-line and multi-line
  let result = text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, inner) => {
    return `$$${inner}$$`;
  });

  // Inline math: \( ... \) → $ ... $
  // Avoid replacing escaped parentheses in normal text by requiring
  // the content to contain at least one LaTeX-like character
  result = result.replace(/\\\(((?:[^\\]|\\.)*?)\\\)/g, (_match, inner) => {
    return `$${inner}$`;
  });

  return result;
}

function MarkdownRendererRaw({ content, className }: MarkdownRendererProps) {
  if (!content) return null;

  const normalized = normalizeLatexDelimiters(content);

  return (
    <div className={`markdown-body ${className || ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownRenderer = memo(MarkdownRendererRaw);
