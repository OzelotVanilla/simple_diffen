/**
 * This file will affect both local/GitHub build process.
 */;

import { build } from "vite"
import { rmSync, renameSync } from "node:fs"
import { resolve } from "node:path"

/**
 * Adopt from ChatGPT.
 */
async function main(): Promise<void>
{
    const output_dir = resolve(import.meta.dirname, "../output")

    // Clean
    rmSync(output_dir, {
        recursive: true,
        force: true
    })

    // Build minified version
    await build({
        mode: "release_min"
    })

    renameSync(
        resolve(output_dir, "index.html"),
        resolve(output_dir, "index.min.html")
    )

    // Build normal version
    await build({
        mode: "release_normal"
    })
}

await main()