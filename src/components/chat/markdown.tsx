'use client'

// Ported from solar (src/components/MarkdownContent.tsx); pax2 colors arrive through the --txt/--muted/--border/--inp-bg variables the chat root sets.

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'
import { childText } from '@/components/chat/child-text'

interface Props {
  content: string
  isStreaming?: boolean // kept for API compatibility, no visual indicator used
}

export function MarkdownContent({ content, isStreaming }: Props) {
  const mdComponents: Parameters<typeof ReactMarkdown>[0]['components'] = {
    p: ({ children }) => (
      <p className="mb-3 last:mb-0 text-[17px] text-[var(--txt)] leading-relaxed">{children}</p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-[var(--txt)]">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-[var(--muted)]">{children}</em>
    ),
    h1: ({ children }) => (
      <h1 className="text-[22px] font-bold text-[var(--txt)] mt-5 mb-2 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-[19px] font-bold text-[var(--txt)] mt-4 mb-2 first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <div className="flex items-center gap-2 mt-6 mb-2">
        <span className="text-xs text-[var(--muted)] shrink-0">{childText(children).replace(/^\d+\.\s*/, '')}</span>
        <div className="flex-1 border-t border-[var(--border)]" />
      </div>
    ),
    h4: ({ children }) => (
      <div className="flex items-center gap-2 mt-5 mb-1">
        <span className="text-xs text-[var(--muted)] shrink-0">{childText(children).replace(/^\d+\.\s*/, '')}</span>
        <div className="flex-1 border-t border-[var(--border)]" />
      </div>
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-5 mb-3 space-y-1 text-[var(--txt)]">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-6 mb-3 space-y-1 text-[var(--txt)]">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-[17px] text-[var(--txt)] leading-relaxed">{children}</li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-pax2-plum pl-3 my-3 text-[var(--muted)] italic">{children}</blockquote>
    ),
    hr: () => (
      <div className="my-4 border-t border-[var(--border)]" />
    ),
    code: ({ children, className }) => {
      const isBlock = className?.includes('language-')
      if (isBlock) {
        return (
          <code className="block bg-[var(--inp-bg)] rounded-xl px-4 py-3 text-xs font-mono text-[var(--txt)] overflow-x-auto mb-3">
            {children}
          </code>
        )
      }
      return (
        <code className="bg-[var(--inp-bg)] text-pax2-plum rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
      )
    },
    pre: ({ children }) => (
      <pre className="bg-[var(--inp-bg)] rounded-xl px-4 py-3 overflow-x-auto mb-3 text-xs font-mono text-[var(--txt)]">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto mb-3 rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm text-left">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-[var(--inp-bg)] border-b border-[var(--border)]">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 border-b border-[var(--border)] text-[var(--txt)]">{children}</td>
    ),
    tr: ({ children }) => (
      <tr className="border-b border-[var(--border)] last:border-0">{children}</tr>
    ),
    a: ({ href, children }) => {
      if (href?.startsWith('/')) {
        return <Link href={href} className="text-pax2-plum hover:underline">{children}</Link>
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-pax2-plum hover:underline">{children}</a>
    },
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {content}
    </ReactMarkdown>
  )
}
