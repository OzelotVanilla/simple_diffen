/**
 * This file compares two strings for add/remove/modify.
 */;

export type DiffOption = {
    /**
     * Selected language for the diff.
     */
    locales?: Intl.LocalesArgument
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
 * Some algorithm-related code adopt from ChatGPT.
 */
export function diff(original_text: string, modified_text: string, diff_option?: DiffOption): DiffResult
{
    const original_text_lines = original_text.replace(/\r\n?/g, "\n").split("\n")
    const modified_text_lines = modified_text.replace(/\r\n?/g, "\n").split("\n")

    const lines = getMyersLineDiff(original_text_lines, modified_text_lines)

    return ({
        lines: alignChangedLines(lines, diff_option)
    }) satisfies DiffResult
}

/**
 * @author ChatGPT
 */
function getMyersLineDiff(original_lines: string[], modified_lines: string[]): DiffLine[]
{
    const n = original_lines.length
    const m = modified_lines.length

    const furthest = new Map<number, number>()
    furthest.set(1, 0)

    const trace: Map<number, number>[] = []

    for (let d = 0; d <= n + m; d++)
    {
        trace.push(new Map(furthest))

        for (let k = -d; k <= d; k += 2)
        {
            let x: number

            if (k === -d || (
                k !== d && (furthest.get(k - 1) ?? -Infinity) < (furthest.get(k + 1) ?? -Infinity)
            ))
            {
                x = furthest.get(k + 1) ?? 0
            }
            else
            {
                x = (furthest.get(k - 1) ?? 0) + 1
            }

            let y = x - k

            // Follow equal lines without increasing edit cost.
            while (x < n && y < m && original_lines[x] === modified_lines[y])
            {
                x++
                y++
            }

            furthest.set(k, x)

            if (x >= n && y >= m)
            {
                return getBacktrackMyers(original_lines, modified_lines, trace)
            }
        }
    }

    throw new Error("Myers diff failed")
}

/**
 * @author ChatGPT
 */
function getBacktrackMyers(
    original_lines: string[], modified_lines: string[], trace: Map<number, number>[]
): DiffLine[]
{
    let x = original_lines.length
    let y = modified_lines.length

    const lines: DiffLine[] = []

    for (let d = trace.length - 1; d >= 0; d--)
    {
        const previous = trace[d]
        const k = x - y

        const previous_k = k === -d || (
            k !== d &&
            (previous.get(k - 1) ?? -Infinity) <
            (previous.get(k + 1) ?? -Infinity)
        ) ? k + 1 : k - 1

        const previous_x = previous.get(previous_k) ?? 0
        const previous_y = previous_x - previous_k

        // Restore equal lines.
        while (x > previous_x && y > previous_y)
        {
            x--
            y--

            lines.push({
                original_line: x,
                modified_line: y,
                segments: [{
                    type: DiffType.equal,
                    text: original_lines[x]
                }]
            })
        }

        if (d === 0) break

        if (x === previous_x)
        {
            y--

            lines.push({
                original_line: null,
                modified_line: y,
                segments: [{
                    type: DiffType.add,
                    text: modified_lines[y]
                }]
            })
        }
        else
        {
            x--

            lines.push({
                original_line: x,
                modified_line: null,
                segments: [{
                    type: DiffType.remove,
                    text: original_lines[x]
                }]
            })
        }
    }

    return lines.reverse()
}

/**
 * @author ChatGPT
 */
function getInlineDiff(original: string, modified: string): DiffLineSegment[]
{
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
    const original_chars = Array.from(segmenter.segment(original), item => item.segment)
    const modified_chars = Array.from(segmenter.segment(modified), item => item.segment)

    const edits = getMyersLineDiff(original_chars, modified_chars)
    const result: DiffLineSegment[] = []

    let i = 0

    while (i < edits.length)
    {
        if (edits[i].segments[0].type === DiffType.equal)
        {
            let text = ""

            while (i < edits.length && edits[i].segments[0].type === DiffType.equal)
            {
                const segment = edits[i].segments[0]
                if (segment.type === DiffType.equal) text += segment.text
                i++
            }

            result.push({ type: DiffType.equal, text })
            continue
        }

        let removed = ""
        let added = ""

        while (i < edits.length && edits[i].segments[0].type !== DiffType.equal)
        {
            const segment = edits[i].segments[0]

            if (segment.type === DiffType.remove) removed += segment.text
            if (segment.type === DiffType.add) added += segment.text

            i++
        }

        if (removed && added)
        {
            result.push({ type: DiffType.modify, original: removed, modified: added })
        }
        else if (removed)
        {
            result.push({ type: DiffType.remove, text: removed })
        }
        else if (added)
        {
            result.push({ type: DiffType.add, text: added })
        }
    }

    return result
}

/**
 * @author ChatGPT
 */
function alignChangedLines(lines: DiffLine[], diff_option?: DiffOption): DiffLine[]
{
    const result: DiffLine[] = []
    const segmenter = new Intl.Segmenter(diff_option?.locales, { granularity: "grapheme" })
    let i = 0

    while (i < lines.length)
    {
        if (lines[i].segments[0].type === DiffType.equal)
        {
            result.push(lines[i])
            i++
            continue
        }

        const block: DiffLine[] = []

        while (i < lines.length && lines[i].segments[0].type !== DiffType.equal)
        {
            block.push(lines[i])
            i++
        }

        const removed = block.filter(line => line.segments[0].type === DiffType.remove)
        const added = block.filter(line => line.segments[0].type === DiffType.add)

        if (removed.length === 1 && added.length === 1)
        {
            const old_segment = removed[0].segments[0]
            const new_segment = added[0].segments[0]

            if (old_segment.type === DiffType.remove && new_segment.type === DiffType.add)
            {
                const segments = getInlineDiff(old_segment.text, new_segment.text)

                const matched = segments.reduce((count, segment) =>
                    segment.type === DiffType.equal
                        ? count + Array.from(segmenter.segment(segment.text)).length
                        : count, 0)

                const old_length = Array.from(segmenter.segment(old_segment.text)).length
                const new_length = Array.from(segmenter.segment(new_segment.text)).length

                const similarity = old_length + new_length === 0
                    ? 1
                    : 2 * matched / (old_length + new_length)

                if (similarity >= 0.5)
                {
                    result.push({
                        original_line: removed[0].original_line,
                        modified_line: added[0].modified_line,
                        segments
                    })

                    continue
                }
            }
        }

        result.push(...block)
    }

    return result
}
