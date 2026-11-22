import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

export default defineConfig({
    root: "src",
    plugins: [
        viteSingleFile(),
        {
            name: "inline-favicon",
            transformIndexHtml: {
                order: "pre",
                handler(html)
                {
                    const svg = readFileSync(resolve("src/favicon.svg"))
                    const data_url = `data:image/svg+xml;base64,${svg.toString("base64")}`

                    return html.replace(
                        `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
                        `<link rel="icon" href="${data_url}" type="image/svg+xml">`
                    )
                }
            }
        },
    ],
    build: {
        outDir: "../output",
        emptyOutDir: true,
        minify: false
    },
    server: {
        port: 3000,
        strictPort: true,
    },
})