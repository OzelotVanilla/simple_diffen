import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig({
    root: "src",
    plugins: [
        viteSingleFile()
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