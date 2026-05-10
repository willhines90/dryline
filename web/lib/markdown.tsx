/**
 * Minimal markdown renderer for the synthesis + artifact bodies.
 *
 * Handles: ATX headings (# ## ###), paragraphs, blank-line separators,
 * inline `**bold**`, inline `[label](url)` links, ordered + unordered
 * lists, and inline `code`. Block code fences are rendered as <pre>.
 *
 * We deliberately avoid pulling in react-markdown / remark — the
 * synthesis is structured by the SKILL.md prompt and we only need a few
 * features rendered tastefully.
 */

import * as React from "react";

interface RenderInlineOpts {
  onLinkHover?: (url: string) => void;
}

function renderInline(text: string, opts: RenderInlineOpts = {}): React.ReactNode[] {
  // Tokenize: link [label](url), bold **x**, code `x`. Process serially.
  const tokens: React.ReactNode[] = [];
  let i = 0;
  let buffer = "";
  const flush = () => {
    if (buffer) {
      tokens.push(buffer);
      buffer = "";
    }
  };
  while (i < text.length) {
    const rest = text.slice(i);
    // Link
    const link = /^\[([^\]]+)\]\(([^)]+)\)/.exec(rest);
    if (link) {
      flush();
      tokens.push(
        <a
          key={tokens.length}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-reservoir-700 underline decoration-reservoir-300 underline-offset-2 hover:bg-reservoir-50 rounded px-0.5"
          onMouseEnter={() => opts.onLinkHover?.(link[2]!)}
          title={link[2]}
        >
          {link[1]}
        </a>,
      );
      i += link[0].length;
      continue;
    }
    // Bold **x**
    const bold = /^\*\*([^*]+)\*\*/.exec(rest);
    if (bold) {
      flush();
      tokens.push(
        <strong key={tokens.length} className="font-semibold">
          {bold[1]}
        </strong>,
      );
      i += bold[0].length;
      continue;
    }
    // Inline code `x`
    const code = /^`([^`]+)`/.exec(rest);
    if (code) {
      flush();
      tokens.push(
        <code key={tokens.length} className="font-mono text-[0.85em] bg-arid-100 rounded px-1 py-0.5">
          {code[1]}
        </code>,
      );
      i += code[0].length;
      continue;
    }
    buffer += text[i];
    i += 1;
  }
  flush();
  return tokens;
}

interface MarkdownProps {
  text: string;
  onLinkHover?: (url: string) => void;
}

export function Markdown({ text, onLinkHover }: MarkdownProps) {
  // Split on blank lines to get blocks; recognize lists, headings, code.
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-4 text-[0.95rem] leading-relaxed">
      {blocks.map((block, i) => {
        // Heading
        const heading = /^(#{1,3})\s+(.+)$/.exec(block);
        if (heading) {
          const level = heading[1]!.length;
          const content = heading[2]!;
          if (level === 1) {
            return (
              <h2 key={i} className="font-serif text-xl tracking-tight">
                {renderInline(content, { onLinkHover })}
              </h2>
            );
          }
          if (level === 2) {
            return (
              <h3 key={i} className="font-serif text-lg tracking-tight">
                {renderInline(content, { onLinkHover })}
              </h3>
            );
          }
          return (
            <h4 key={i} className="font-medium text-base">
              {renderInline(content, { onLinkHover })}
            </h4>
          );
        }
        // Code fence
        if (block.startsWith("```") && block.endsWith("```")) {
          const inner = block.replace(/^```[^\n]*\n/, "").replace(/\n```$/, "");
          return (
            <pre key={i} className="font-mono text-xs bg-arid-100 rounded p-3 overflow-x-auto">
              {inner}
            </pre>
          );
        }
        // Unordered list
        if (block.split("\n").every((line) => /^[-*]\s+/.test(line))) {
          const items = block.split("\n").map((l) => l.replace(/^[-*]\s+/, ""));
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {items.map((it, j) => (
                <li key={j}>{renderInline(it, { onLinkHover })}</li>
              ))}
            </ul>
          );
        }
        // Ordered list
        if (block.split("\n").every((line) => /^\d+\.\s+/.test(line))) {
          const items = block.split("\n").map((l) => l.replace(/^\d+\.\s+/, ""));
          return (
            <ol key={i} className="list-decimal pl-5 space-y-1">
              {items.map((it, j) => (
                <li key={j}>{renderInline(it, { onLinkHover })}</li>
              ))}
            </ol>
          );
        }
        // Horizontal rule
        if (/^-{3,}$/.test(block)) {
          return <hr key={i} className="border-border" />;
        }
        // Blockquote (single-block)
        if (block.split("\n").every((l) => l.startsWith(">"))) {
          const inner = block
            .split("\n")
            .map((l) => l.replace(/^>\s?/, ""))
            .join(" ");
          return (
            <blockquote
              key={i}
              className="border-l-2 border-reservoir-300 pl-3 italic text-foreground/80"
            >
              {renderInline(inner, { onLinkHover })}
            </blockquote>
          );
        }
        // Default: paragraph (preserve hard line-breaks within)
        return (
          <p key={i} className="text-foreground/90">
            {block.split("\n").map((line, k, arr) => (
              <React.Fragment key={k}>
                {renderInline(line, { onLinkHover })}
                {k < arr.length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
