import { Fragment, ReactNode } from "react";

/**
 * Lightweight, dependency-free renderer for the small subset of Markdown the
 * recipe chat returns: bold, italic, inline code, and bullet/numbered lists.
 * Builds React nodes directly (no dangerouslySetInnerHTML), so it is XSS-safe.
 */

const INLINE_PATTERN = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
const UNORDERED_ITEM = /^\s*[-*•]\s+(.*)$/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let token = 0;
    let match: RegExpExecArray | null;
    INLINE_PATTERN.lastIndex = 0;
    while ((match = INLINE_PATTERN.exec(text)) !== null) {
        if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
        const key = `${keyPrefix}-${token}`;
        if (match[2] !== undefined || match[3] !== undefined) {
            nodes.push(<strong key={key} className="font-semibold">{match[2] ?? match[3]}</strong>);
        } else if (match[4] !== undefined) {
            nodes.push(<code key={key} className="rounded bg-espresso/10 px-1 py-0.5 font-mono text-[0.85em]">{match[4]}</code>);
        } else {
            nodes.push(<em key={key}>{match[5] ?? match[6]}</em>);
        }
        lastIndex = INLINE_PATTERN.lastIndex;
        token += 1;
    }
    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
    return nodes;
}

export function FormattedMessage({ text }: { text: string }) {
    const lines = text.split("\n");
    const blocks: ReactNode[] = [];
    let paragraph: string[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;

    const flushParagraph = () => {
        if (paragraph.length === 0) return;
        const key = `p-${blocks.length}`;
        blocks.push(
            <p key={key} className={blocks.length > 0 ? "mt-2" : undefined}>
                {paragraph.map((line, index) => (
                    <Fragment key={`${key}-${index}`}>
                        {index > 0 && <br />}
                        {renderInline(line, `${key}-${index}`)}
                    </Fragment>
                ))}
            </p>,
        );
        paragraph = [];
    };

    const flushList = () => {
        if (!list || list.items.length === 0) return;
        const key = `l-${blocks.length}`;
        const items = list.items.map((item, index) => (
            <li key={`${key}-${index}`}>{renderInline(item, `${key}-${index}`)}</li>
        ));
        blocks.push(
            list.ordered
                ? <ol key={key} className={`list-decimal space-y-1 pl-5 ${blocks.length > 0 ? "mt-2" : ""}`}>{items}</ol>
                : <ul key={key} className={`list-disc space-y-1 pl-5 ${blocks.length > 0 ? "mt-2" : ""}`}>{items}</ul>,
        );
        list = null;
    };

    for (const line of lines) {
        const unordered = line.match(UNORDERED_ITEM);
        const ordered = line.match(ORDERED_ITEM);
        if (unordered || ordered) {
            flushParagraph();
            const isOrdered = Boolean(ordered);
            if (!list || list.ordered !== isOrdered) {
                flushList();
                list = { ordered: isOrdered, items: [] };
            }
            list.items.push((unordered ?? ordered)![1]);
            continue;
        }
        flushList();
        if (line.trim() === "") {
            flushParagraph();
            continue;
        }
        paragraph.push(line);
    }
    flushParagraph();
    flushList();

    return <>{blocks}</>;
}
