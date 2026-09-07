import test from "node:test"
import assert from "node:assert/strict"
import { render } from "preact-render-to-string"
import WritingList from "./WritingList"
import type { QuartzComponentProps } from "./types"

function catalogue(slug: string, files: Record<string, unknown>[]) {
  const result = WritingList({
    fileData: { slug },
    allFiles: files,
  } as unknown as QuartzComponentProps)
  return result ? render(result) : ""
}
function work(title: string, date: string, extra: Record<string, unknown> = {}) {
  return {
    slug: `writing/poetry/${title}`,
    frontmatter: { title, date, type: "writing", publish: true, genre: "poetry", ...extra },
  }
}

test("lists only explicitly public writing and omits private and unlisted entries", () => {
  const html = catalogue("index", [
    work("Public", "2026-09-06"),
    work("Private", "2026-09-07", { publish: false }),
    work("Unlisted", "2026-09-08", { unlisted: true }),
    work("Notebook", "2026-09-09", { type: "notebook" }),
    { ...work("Hidden", "2026-09-10"), unlisted: true },
  ])
  assert.match(html, /Public/)
  for (const title of ["Private", "Unlisted", "Notebook", "Hidden"])
    assert.ok(!html.includes(title))
})
test("home lists five most recently published works; Writing lists all", () => {
  const files = Array.from({ length: 7 }, (_, i) => work(`Poem${i}`, `2026-09-0${i + 1}`))
  const home = catalogue("index", files)
  assert.equal((home.match(/<li>/g) ?? []).length, 5)
  assert.ok(home.indexOf("Poem6") < home.indexOf("Poem5"))
  assert.ok(!home.includes("Poem0"))
  assert.equal((catalogue("writing/index", files).match(/<li>/g) ?? []).length, 7)
})
test("does not render the catalogue inside an individual work or when empty", () => {
  assert.equal(catalogue("writing/poetry/Poem", [work("Poem", "2026-09-06")]), "")
  assert.equal(catalogue("index", []), "")
})
test("unpublishing removes a work from the list without editing the index", () => {
  assert.match(catalogue("writing/index", [work("Poem", "2026-09-06")]), /Poem/)
  assert.equal(catalogue("writing/index", [work("Poem", "2026-09-06", { publish: false })]), "")
})
