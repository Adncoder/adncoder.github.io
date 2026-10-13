import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { syncFavorites } from "./publish-favorites.mjs"

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "favorites-test-"))
  t.after(() => {
    if (
      path.dirname(root) !== path.resolve(os.tmpdir()) ||
      !path.basename(root).startsWith("favorites-test-")
    )
      throw new Error("Unsafe cleanup path")
    fs.rmSync(root, { recursive: true, force: true })
  })
  const source = path.join(root, "note.md")
  const repoRoot = path.join(root, "repo")
  const destination = path.join(repoRoot, "content", "favorites.md")
  const write = (properties, body = "## Books\n\nA favorite.") =>
    fs.writeFileSync(
      source,
      `---\ntitle: Favorites\ntype: collection\n${properties}\n---\n\n${body}`,
    )
  return { source, repoRoot, destination, write }
}

test("publishes only the selected note and strips private metadata and comments", (t) => {
  const f = fixture(t)
  f.write(
    "publish: true\norigin: secret\nprivate: hidden",
    "## Books\n\nPublic reflection.\n%% private draft %%\n<!-- private instructions -->",
  )
  assert.equal(syncFavorites(f).status, "updated")
  const output = fs.readFileSync(f.destination, "utf8")
  assert.match(output, /Public reflection/)
  assert.doesNotMatch(output, /secret|hidden|private draft|private instructions/)
  assert.equal(syncFavorites(f).status, "unchanged")
})
test("drafts never create a page and unpublishing removes only the owned page", (t) => {
  const f = fixture(t)
  f.write('publish: "true"')
  assert.equal(syncFavorites(f).status, "draft")
  assert.equal(fs.existsSync(f.destination), false)
  f.write("publish: true")
  syncFavorites(f)
  const unrelated = path.join(path.dirname(f.destination), "index.md")
  fs.writeFileSync(unrelated, "Keep this")
  f.write("publish: false")
  assert.equal(syncFavorites(f).status, "removed")
  assert.equal(fs.readFileSync(unrelated, "utf8"), "Keep this")
})
test("unmanaged website content is never overwritten or removed", (t) => {
  const f = fixture(t)
  fs.mkdirSync(path.dirname(f.destination), { recursive: true })
  fs.writeFileSync(f.destination, "---\ntitle: Existing\n---\nKeep this")
  for (const flag of [true, false]) {
    f.write(`publish: ${flag}`)
    assert.throws(() => syncFavorites(f), /unmanaged/)
    assert.match(fs.readFileSync(f.destination, "utf8"), /Keep this/)
  }
})
test("invalid source or unfinished comments fail before changing the public copy", (t) => {
  const f = fixture(t)
  f.write("publish: true")
  syncFavorites(f)
  const before = fs.readFileSync(f.destination, "utf8")
  f.write("publish: true", "Visible\n%% private unclosed")
  assert.throws(() => syncFavorites(f), /unfinished comment/)
  assert.equal(fs.readFileSync(f.destination, "utf8"), before)
  fs.unlinkSync(f.source)
  assert.throws(() => syncFavorites(f), /not found/)
  assert.equal(fs.readFileSync(f.destination, "utf8"), before)
})
test("media markup survives export and uncopied local embeds fail clearly", (t) => {
  const f = fixture(t)
  const embed =
    '<iframe title="Song" src="https://www.youtube-nocookie.com/embed/example" loading="lazy"></iframe>'
  f.write("publish: true", embed)
  syncFavorites(f)
  assert.ok(fs.readFileSync(f.destination, "utf8").includes(embed))
  f.write("publish: true", "![[private-image.png]]")
  assert.throws(() => syncFavorites(f), /attachments are not copied/)
})
