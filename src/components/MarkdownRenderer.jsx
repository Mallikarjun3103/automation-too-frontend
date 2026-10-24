import React, { useMemo } from "react";
import { marked } from "marked";

// Configure marked with GitHub Flavored Markdown and line breaks
marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function MarkdownRenderer({ content, isStreaming }) {
  const html = useMemo(() => {
    if (!content) return "";
    try {
      let parsed = marked.parse(content);
      // Ensure all tables are wrapped in a responsive container for smooth horizontal scroll
      parsed = parsed
        .replace(/<table>/g, '<div class="table-responsive"><table>')
        .replace(/<\/table>/g, "</table></div>");
      return parsed;
    } catch (err) {
      console.error("Markdown parse error:", err);
      return content;
    }
  }, [content]);

  if (!content && isStreaming) {
    return (
      <span className="streaming-thinking">
        Thinking
        <span className="streaming-dots">...</span>
      </span>
    );
  }

  return (
    <div className="markdown-wrapper">
      <div
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {isStreaming && <span className="streaming-cursor">●</span>}
    </div>
  );
}
