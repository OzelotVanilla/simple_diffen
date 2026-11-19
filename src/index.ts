import { diff, DiffOption } from "./diff/diff_engine"
import { renderDiff } from "./diff/diff_renderer"
import "./index.scss"

const original_textarea__ref = document.getElementById("original_textarea") as HTMLTextAreaElement | null
const modified_textarea__ref = document.getElementById("modified_textarea") as HTMLTextAreaElement | null
const compare_button__ref = document.getElementById("compare_button") as HTMLButtonElement | null

function on_CompareButton_clicked()
{
    const original_text = original_textarea__ref?.value ?? ""
    const modified_text = modified_textarea__ref?.value ?? ""

    let diff_option: DiffOption = {}

    const diff_result = diff(original_text, modified_text, diff_option)
    renderDiff(diff_result)
}

function init()
{
    compare_button__ref?.addEventListener("click", on_CompareButton_clicked)
}

init()