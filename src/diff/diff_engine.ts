import { diffArrays as jsdiff_diffArrays } from "diff/lib/diff/array.js"

/**
 * Explicitly mention the `jsdiff` module.
 * Also, since VSCode does not support semantic highlighting for `import * as x`,
 *  this namespace is intended made.
 */
namespace jsdiff
{
    export const diffArrays = jsdiff_diffArrays
}

/**
 * This file compares two strings for add/remove/modify.
 */;

export type DiffOption = {
    /**
     * Selected language for the diff.
     */
    locales?: Intl.LocalesArgument

    /**
     * Granularity of diff.
     */
    granularity?: Intl.SegmenterOptions["granularity"]

    /**
     * Whether case is ignored.
     */
    should_ignore_case?: boolean
}

/**
 * Result of diff.
 */
export type DiffResult = {
    lines: DiffLine[]
}

export type DiffLine = {
    /**
     * The line index for this line in original text.
     * `null` means does not exist.
     */
    original_line: number | null
    /**
     * The line index for this line in modified text.
     * `null` means does not exist.
     */
    modified_line: number | null
    segments: DiffLineSegment[]
}

export type DiffLineSegment = {
    type: DiffType.equal | DiffType.add | DiffType.remove
    /** Text itself */
    text: string
} | {
    type: DiffType.modify
    /** Text before change. */
    original: string
    /** Text that changes to. */
    modified: string
}

export enum DiffType
{
    equal = "equal",
    add = "add",
    remove = "remove",
    modify = "modify"
}

/**
 * Calculate the diff between given text,
 *  and return the diff result in `DiffResult` type.
 *
 * Uses jsdiff to compare text tokens before constructing display lines.
 * @author ChatGPT
 */
export function diff(original_text: string, modified_text: string, diff_option?: DiffOption): DiffResult
{
    const original = original_text.replace(/\r\n?/g, "\n")
    const modified = modified_text.replace(/\r\n?/g, "\n")
    const segmenter = new Intl.Segmenter(diff_option?.locales, { granularity: diff_option?.granularity ?? "word" })

    const changes = jsdiff.diffArrays(tokenizeText(original, segmenter), tokenizeText(modified, segmenter))

    const original_lines = original.split("\n")
    const modified_lines = modified.split("\n")
    const matches = new Map<number, Map<number, number>>()
    const newline_anchors: { original: number, modified: number }[] = []
    let original_index = 0
    let modified_index = 0

    // Retain the line positions of matched text.
    for (const change of changes)
    {
        for (const token of change.value)
        {
            const is_equal = !change.added && !change.removed

            if (token === "\n")
            {
                if (is_equal)
                {
                    newline_anchors.push({ original: original_index, modified: modified_index })
                }

                if (!change.added) original_index++
                if (!change.removed) modified_index++
            }
            else
            {
                if (is_equal)
                {
                    const weight = getMeaningfulLength(token)
                    if (weight > 0)
                    {
                        let row = matches.get(original_index)
                        if (!row)
                        {
                            row = new Map<number, number>()
                            matches.set(original_index, row)
                        }
                        row.set(modified_index, (row.get(modified_index) ?? 0) + weight)
                    }
                }
            }
        }
    }

    const result: DiffLine[] = []
    let original_start = 0
    let modified_start = 0

    // Only strong nonblank anchors are allowed to divide the line alignment.
    // Matching an empty line alone must not prevent nearby paragraphs from pairing.
    for (const anchor of newline_anchors)
    {
        const original_line = original_lines[anchor.original]
        const modified_line = modified_lines[anchor.modified]
        const overlap = matches.get(anchor.original)?.get(anchor.modified) ?? 0
        const total = getMeaningfulLength(original_line) + getMeaningfulLength(modified_line)

        if (original_line.trim() === "" || modified_line.trim() === "") continue
        if (original_line !== modified_line && (overlap < 4 || 2 * overlap < total)) continue

        result.push(...alignLines(
            original_lines, modified_lines, original_start, anchor.original,
            modified_start, anchor.modified, matches, segmenter
        ))

        result.push(createDiffLine(
            anchor.original, anchor.modified, original_line, modified_line, segmenter
        ))

        original_start = anchor.original + 1
        modified_start = anchor.modified + 1
    }

    result.push(...alignLines(
        original_lines, modified_lines, original_start, original_lines.length,
        modified_start, modified_lines.length, matches, segmenter
    ))

    return ({ lines: result }) satisfies DiffResult
}

/**
 * Tokenize an entire document.
 * Newlines are independent tokens,
 *  including newlines inserted inside a word or a paragraph.
 * 
 * @author ChatGPT
 */
function tokenizeText(text: string, segmenter: Intl.Segmenter): string[]
{
    const tokens: string[] = []

    for (const part of text.split(/(\n)/g))
    {
        if (part === "") continue
        if (part === "\n")
        {
            tokens.push(part)
            continue
        }

        for (const token of segmenter.segment(part)) tokens.push(token.segment)
    }

    return tokens
}

/**
 * @author ChatGPT
 */
function getMeaningfulLength(text: string): number
{
    return Array.from(text.replace(/[\s\p{P}]/gu, "")).length
}

/**
 * Align the actual lines within one text-diff region.
 * Shared text tokens provide the matching score, not raw line equality.
 * 
 * @author ChatGPT
 */
function alignLines(
    original_lines: string[], modified_lines: string[],
    original_start: number, original_end: number,
    modified_start: number, modified_end: number,
    matches: Map<number, Map<number, number>>,
    segmenter: Intl.Segmenter
): DiffLine[]
{
    const result: DiffLine[] = []
    const n = original_end - original_start
    const m = modified_end - modified_start

    // Do not create an unbounded dynamic-programming table for huge rewrites.
    if (n * m > 4096)
    {
        for (let i = original_start; i < original_end; i++)
        {
            result.push(createDiffLine(i, null, original_lines[i], null, segmenter))
        }
        for (let j = modified_start; j < modified_end; j++)
        {
            result.push(createDiffLine(null, j, null, modified_lines[j], segmenter))
        }
        return result
    }

    const original_lengths = original_lines.slice(original_start, original_end).map(getMeaningfulLength)
    const modified_lengths = modified_lines.slice(modified_start, modified_end).map(getMeaningfulLength)

    const dp: number[][] = Array.from(
        { length: n + 1 }, () => Array<number>(m + 1).fill(0)
    )
    const scores: number[][] = Array.from(
        { length: n }, () => Array<number>(m).fill(0)
    )

    for (let i = n - 1; i >= 0; i--)
    {
        for (let j = m - 1; j >= 0; j--)
        {
            const original_index = original_start + i
            const modified_index = modified_start + j
            const old_text = original_lines[original_index]
            const new_text = modified_lines[modified_index]
            const overlap = matches.get(original_index)?.get(modified_index) ?? 0
            const total = original_lengths[i] + modified_lengths[j]
            const ratio = total === 0 ? 0 : 2 * overlap / total

            if (old_text === new_text)
            {
                scores[i][j] = Math.max(1, 2 * overlap + 1)
            }
            else if (overlap >= 2 && (ratio >= 0.25 || overlap >= 8))
            {
                scores[i][j] = overlap * (1 + ratio)
            }

            dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
            if (scores[i][j] > 0)
            {
                dp[i][j] = Math.max(dp[i][j], scores[i][j] + dp[i + 1][j + 1])
            }
        }
    }

    let i = 0
    let j = 0

    while (i < n || j < m)
    {
        if (i < n && j < m && scores[i][j] > 0 &&
            scores[i][j] + dp[i + 1][j + 1] >= dp[i][j] - 1e-9)
        {
            const original_index = original_start + i
            const modified_index = modified_start + j
            result.push(createDiffLine(
                original_index, modified_index,
                original_lines[original_index], modified_lines[modified_index], segmenter
            ))
            i++
            j++
        }
        else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1]))
        {
            const original_index = original_start + i
            result.push(createDiffLine(original_index, null, original_lines[original_index], null, segmenter))
            i++
        }
        else
        {
            const modified_index = modified_start + j
            result.push(createDiffLine(null, modified_index, null, modified_lines[modified_index], segmenter))
            j++
        }
    }

    return result
}

/**
 * @author ChatGPT
 */
function createDiffLine(
    original_line: number | null, modified_line: number | null,
    original: string | null, modified: string | null,
    segmenter: Intl.Segmenter
): DiffLine
{
    let segments: DiffLineSegment[]

    if (original === null)
    {
        segments = [{ type: DiffType.add, text: modified ?? "" }]
    }
    else if (modified === null)
    {
        segments = [{ type: DiffType.remove, text: original }]
    }
    else
    {
        segments = getInlineDiff(original, modified, segmenter)
    }

    return { original_line, modified_line, segments }
}

/**
 * Merge adjacent token insertions and removals into the existing segment format.
 * 
 * @author ChatGPT
 */
function getInlineDiff(original: string, modified: string, segmenter: Intl.Segmenter): DiffLineSegment[]
{
    if (original === modified) return [{ type: DiffType.equal, text: original }]

    const changes = jsdiff.diffArrays(tokenizeText(original, segmenter), tokenizeText(modified, segmenter))
    const result: DiffLineSegment[] = []
    let removed = ""
    let added = ""

    const flush = (): void =>
    {
        if (removed !== "" && added !== "")
        {
            result.push({ type: DiffType.modify, original: removed, modified: added })
        }
        else if (removed !== "")
        {
            result.push({ type: DiffType.remove, text: removed })
        }
        else if (added !== "")
        {
            result.push({ type: DiffType.add, text: added })
        }
        removed = ""
        added = ""
    }

    for (const change of changes)
    {
        const text = change.value.join("")
        if (change.removed) removed += text
        else if (change.added) added += text
        else
        {
            flush()
            result.push({ type: DiffType.equal, text })
        }
    }

    flush()
    return result
}