/**
 * This file will affect both local/GitHub build process.
 */;

import { build } from "vite"
import { rmSync, renameSync, readFileSync, writeFileSync } from "node:fs"
import * as path from "node:path"

const license_area_marker = `<div id="replace_marker__license_list"></div>`
const space_before_for_license_area = " ".repeat(4 * 4)

const modified_time_marker = `<meta name="dcterms.modified" content="replace_marker__modified_date" />`

const jsdiff_license_path = "third_party_license/jsdiff_license"

/**
 * Adopt from ChatGPT.
 */
async function main(): Promise<void>
{
    const output_dir = path.resolve(import.meta.dirname, "../output")

    // Clean
    rmSync(output_dir, {
        recursive: true,
        force: true
    })

    // Build minified version
    await build({
        mode: "release_min"
    })
    renameSync(path.resolve(output_dir, "index.html"), path.resolve(output_dir, "index.min.html"))
    replaceHTMLPlaceholder(path.resolve(output_dir, "index.min.html"))

    // Build normal version
    await build({
        mode: "release_normal"
    })
    replaceHTMLPlaceholder(path.resolve(output_dir, "index.html"))
}

function replaceHTMLPlaceholder(html_path: string)
{
    let license_area_html = `
<p>* jsdiff</p>
<details>
    <summary>See the full license for <code>jsdiff</code> (BSD 3-Clause License)</summary>
    <pre>
${readFileSync(path.resolve(import.meta.dirname, "../", jsdiff_license_path), "utf-8")}
    </pre>
</details>
`
        .trim()
        // Only indent tag starting line.
        .replace(/^(?=\s*\<\/?[\w-]*\>)/gm, space_before_for_license_area)
        // Because first line is already aligned in HTML.
        .trim()

    let modified_time_html = `
    <meta name="dcterms.modified" content="${new Date().toISOString().split("T")[0].replace(/\-/g, "/")}" />
`
        .trim()

    writeFileSync(
        html_path,
        readFileSync(html_path, "utf-8")
            .replace(license_area_marker, license_area_html)
            .replace(modified_time_marker, modified_time_html)
    )
}

await main()