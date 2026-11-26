import { diff, DiffOption } from "./diff/diff_engine"
import { renderDiff } from "./diff/diff_renderer"
import "./index.scss"

const original_textarea__ref = document.getElementById("original_textarea") as HTMLTextAreaElement | null
const modified_textarea__ref = document.getElementById("modified_textarea") as HTMLTextAreaElement | null
const compare_button__ref = document.getElementById("compare_button") as HTMLButtonElement | null
const language_auto_detect_button__ref = document.getElementById("button__language_auto_detect") as HTMLButtonElement | null
const language_select__ref = document.getElementById("option__language_select") as HTMLSelectElement | null
const granularity_select__ref = document.getElementById("option__granularity_select") as HTMLSelectElement | null

function on_CompareButton_clicked()
{
    const original_text = original_textarea__ref?.value ?? ""
    const modified_text = modified_textarea__ref?.value ?? ""

    // // Collect diff options
    let diff_option: DiffOption = {}
    diff_option.locales = language_select__ref?.value || undefined
    diff_option.granularity = granularity_select__ref?.value as Intl.SegmenterOptions["granularity"]

    const diff_result = diff(original_text, modified_text, diff_option)
    renderDiff(diff_result)
}

async function on_LanguageAutoDetectButton_clicked()
{
    if (language_auto_detect_button__ref == null) { throw ReferenceError(`No language detect button on the page.`) }
    if (language_select__ref == null) { throw ReferenceError(`No language select on the page.`) }
    let text_to_detect = (original_textarea__ref?.value ?? "") + (modified_textarea__ref?.value ?? "")
    if (text_to_detect.length <= 0) { return }

    // Disable button until finished.
    language_auto_detect_button__ref.disabled = true

    // // Detect.
    const detector = await LanguageDetector.create()
    const locale = (await detector.detect(text_to_detect))[0].detectedLanguage
    if (locale == undefined) { return }

    // // Select.
    // Add as new option if not in.
    if (language_select__ref.namedItem(locale) == null)
    {
        language_select__ref.add(new Option(
            new Intl.DisplayNames(locale, { type: "language" }).of(locale) ?? locale,
            locale
        ))
    }
    // Select by changing selected index. `Array.findIndex` should return a valid index.
    language_select__ref.selectedIndex = Array.from(language_select__ref.options).findIndex(v => v.value == locale)

    // Restore button availability.
    language_auto_detect_button__ref.disabled = false
}

/**
 * Decide whether language auto detect function is available.
 * If so, connect `onclick` event to processor.
 */
async function setupLanguageAutoDetectButtonAsyncly()
{
    if (language_auto_detect_button__ref == null)
    {
        throw ReferenceError(`No language detect button on the page.`)
    }
    if (!("LanguageDetector" in self))
    {
        language_auto_detect_button__ref.title = "Your browser does not support this function."
        return
    }
    if (await LanguageDetector.availability() == "unavailable")
    {
        language_auto_detect_button__ref.title = "LanguageDetector is unavailable now."
        return
    }

    language_auto_detect_button__ref.disabled = false
    language_auto_detect_button__ref.addEventListener("click", on_LanguageAutoDetectButton_clicked)
}

function prepareLanguageSelectionList()
{
    if (language_select__ref == null)
    {
        throw ReferenceError(`No language select on the page.`)
    }

    // // Clean-up.
    language_select__ref.options.length = 0

    // // Add options.
    language_select__ref.add(new Option("(not specified)", ""))
    const possible_locale_code = Array.from({ length: 26 * 26 }, (_, i) => String.fromCharCode(97 + (i / 26 | 0), 97 + i % 26))
    Intl.Segmenter.supportedLocalesOf([...navigator.languages, ...possible_locale_code], { localeMatcher: "lookup" }).map(
        (locale) => language_select__ref.add(
            new Option(
                new Intl.DisplayNames(locale, { type: "language" }).of(locale) ?? locale,
                locale
            )
        )
    )
}

function init()
{
    compare_button__ref?.addEventListener("click", on_CompareButton_clicked)
    setupLanguageAutoDetectButtonAsyncly()
    prepareLanguageSelectionList()
}

init()