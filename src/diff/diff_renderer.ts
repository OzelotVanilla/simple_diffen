import { DiffResult, DiffType } from "./diff_engine";

const result_area__ref = document.getElementById("result_area") as HTMLDivElement | null
const original_result__ref = document.getElementById("original_result") as HTMLDivElement | null
const modified_result__ref = document.getElementById("modified_result") as HTMLDivElement | null

export function renderDiff(diff_result: DiffResult)
{
    let original_result_nodes: (Node | string)[] = []
    let modified_result_nodes: (Node | string)[] = []

    // Give line count info
    result_area__ref?.style.setProperty("--ts_var__line_count", `${Math.max(1, diff_result.lines.length)}`)

    for (const line of diff_result.lines)
    {
        let original_row = document.createElement("div"); original_row.className = "DiffRow"
        let modified_row = document.createElement("div"); modified_row.className = "DiffRow"

        if (line.original_line != null)
        {
            original_row.replaceChildren(...generateDiffRowFromSegments(line.segments, /* is_for_original_area: */ true))
        }
        else // Cannot both be `null`
        {
            original_row.replaceChildren("")
            original_row.classList.add("placeholder")
            modified_row.classList.add("add")
        }

        if (line.modified_line != null)
        {
            modified_row.replaceChildren(...generateDiffRowFromSegments(line.segments, /* is_for_original_area: */ false))
        }
        else // Cannot both be `null`
        {
            modified_row.replaceChildren("")
            modified_row.classList.add("placeholder")
            original_row.classList.add("remove")
        }

        original_result_nodes.push(original_row)
        modified_result_nodes.push(modified_row)
    }

    original_result__ref?.replaceChildren(...original_result_nodes)
    modified_result__ref?.replaceChildren(...modified_result_nodes)
}

function generateDiffRowFromSegments(segments: DiffResult["lines"][number]["segments"], is_for_original_area: boolean): (Node | string)[]
{
    return segments.map(s =>
    {
        switch (s.type)
        {
            case DiffType.equal: { return s.text }

            case DiffType.add: {
                let n = document.createElement("span")
                n.className = DiffType.add
                n.innerText = is_for_original_area ? "" : s.text
                return n
            }

            case DiffType.remove: {
                let n = document.createElement("span")
                n.className = DiffType.remove
                n.innerText = is_for_original_area ? s.text : ""
                return n
            }

            case DiffType.modify: {
                let n = document.createElement("span")
                n.className = DiffType.modify
                n.innerText = is_for_original_area ? s.original : s.modified
                return n
            }
        }
    })
}