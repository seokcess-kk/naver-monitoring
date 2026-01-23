import DOMPurify from "dompurify";

const ALLOWED_TAGS = ["b", "strong", "em", "i", "mark", "br"];
const ALLOWED_ATTR: string[] = [];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
