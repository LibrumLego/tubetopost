import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

export function renderMarkdown(markdown: string): string {
  const dirty = marked.parse(markdown, { breaks: true, gfm: true, async: false }) as string;
  return sanitizeHtml(dirty, {
    allowedTags: ["h2", "h3", "h4", "p", "a", "strong", "em", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "br"],
    allowedAttributes: { a: ["href", "title", "rel"] },
    allowedSchemes: ["https", "http"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
      h1: "h2",
    },
  });
}
