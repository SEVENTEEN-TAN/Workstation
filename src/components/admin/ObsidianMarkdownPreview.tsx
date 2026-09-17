import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "../../app/admin/admin.module.css";

const CALLOUT_LABELS: Record<string, string> = {
  abstract: "摘要",
  bug: "问题",
  danger: "危险",
  example: "示例",
  failure: "失败",
  info: "信息",
  note: "笔记",
  question: "问题",
  quote: "引用",
  success: "完成",
  tip: "提示",
  todo: "待办",
  warning: "警告",
};

export function normalizeObsidianMarkdown(content: string) {
  return content
    .replace(/^>\s*\[!([a-z]+)[+-]?\]\s*(.*)$/gim, (_match, type: string, title: string) => {
      const label = CALLOUT_LABELS[type.toLowerCase()] ?? type;
      return `> **${title ? `${label}: ${title}` : label}**`;
    })
    .replace(/^```(?:dataview|dataviewjs)\b[^\n]*$/gim, "> **Dataview 查询（未执行）**\n\n```text");
}

export function ObsidianMarkdownPreview({ content }: { content: string }) {
  return (
    <div className={styles.noteMarkdown}>
      <Markdown remarkPlugins={[remarkGfm]}>{normalizeObsidianMarkdown(content)}</Markdown>
    </div>
  );
}
