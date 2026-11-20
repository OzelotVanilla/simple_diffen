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
 * Align removed and added lines within each changed block.
 * Uses dynamic programming to find the best ordered matching.
 *
 * @author ChatGPT
 */
function alignChangedLines(lines: DiffLine[], diff_option?: DiffOption): DiffLine[]
{
    const result: DiffLine[] = []
    const segmenter = new Intl.Segmenter(diff_option?.locales, { granularity: "grapheme" })
    const SIMILARITY_THRESHOLD = 0.5
    const MAX_PAIR_COMPARISONS = 4096

    let i = 0

    while (i < lines.length)
    {
        if (lines[i].segments[0]?.type === DiffType.equal)
        {
            result.push(lines[i])
            i++
            continue
        }

        // Collect a changed block between two equal lines.
        const block: DiffLine[] = []

        while (i < lines.length && lines[i].segments[0]?.type !== DiffType.equal)
        {
            block.push(lines[i])
            i++
        }

        const removed: { line: DiffLine, text: string }[] = []
        const added: { line: DiffLine, text: string }[] = []

        for (const line of block)
        {
            const segment = line.segments[0]

            if (segment?.type === DiffType.remove)
            {
                removed.push({ line, text: segment.text })
            }
            else if (segment?.type === DiffType.add)
            {
                added.push({ line, text: segment.text })
            }
        }

        // No possible replacements.
        if (removed.length === 0 || added.length === 0)
        {
            result.push(...block)
            continue
        }

        // Avoid excessive pairwise comparisons.
        if (removed.length * added.length > MAX_PAIR_COMPARISONS)
        {
            result.push(...block)
            continue
        }

        const n = removed.length
        const m = added.length

        const original_lengths = removed.map(item => Array.from(segmenter.segment(item.text)).length)
        const modified_lengths = added.map(item => Array.from(segmenter.segment(item.text)).length)

        type Candidate = {
            similarity: number
            segments: DiffLineSegment[]
        }

        const candidates: (Candidate | null)[][] = Array.from(
            { length: n }, () => Array<Candidate | null>(m).fill(null)
        )

        // dp[r][a]: Maximum matching score from removed[r] and added[a] onward.
        const dp: number[][] = Array.from(
            { length: n + 1 }, () => Array<number>(m + 1).fill(0)
        )

        // Calculate the optimal ordered alignment.
        for (let r = n - 1; r >= 0; r--)
        {
            for (let a = m - 1; a >= 0; a--)
            {
                const segments = getInlineDiff(removed[r].text, added[a].text)

                const matched = segments.reduce((count, segment) =>
                    segment.type === DiffType.equal
                        ? count + Array.from(segmenter.segment(segment.text)).length
                        : count, 0
                )

                const total_length = original_lengths[r] + modified_lengths[a]
                const similarity = total_length === 0
                    ? 1
                    : 2 * matched / total_length

                if (similarity >= SIMILARITY_THRESHOLD)
                {
                    candidates[r][a] = { similarity, segments }
                }

                // Option 1: Leave the removed line unmatched.
                // Option 2: Leave the added line unmatched.
                dp[r][a] = Math.max(dp[r + 1][a], dp[r][a + 1])

                // Option 3: Match both lines.
                if (candidates[r][a] !== null)
                {
                    dp[r][a] = Math.max(
                        dp[r][a],
                        similarity + dp[r + 1][a + 1]
                    )
                }
            }
        }

        // Reconstruct the optimal alignment.
        let r = 0
        let a = 0

        while (r < n || a < m)
        {
            const candidate = r < n && a < m
                ? candidates[r][a]
                : null

            if (candidate !== null && candidate.similarity + dp[r + 1][a + 1] >= dp[r][a] - 1e-9)
            {
                result.push({
                    original_line: removed[r].line.original_line,
                    modified_line: added[a].line.modified_line,
                    segments: candidate.segments
                })
                r++
                a++
            }
            else if (r < n && (a >= m || dp[r + 1][a] >= dp[r][a + 1]))
            {
                result.push(removed[r].line)
                r++
            }
            else
            {
                result.push(added[a].line)
                a++
            }
        }
    }

    return result
}