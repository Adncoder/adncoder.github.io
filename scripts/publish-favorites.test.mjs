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
  assert.throws(() => syncFavorites(f), /Only local audio attachments/)
})

function audioFixture(t) {
  const f = fixture(t)
  const root = path.dirname(f.source)
  fs.mkdirSync(path.join(root, ".obsidian"))
  fs.writeFileSync(
    path.join(root, ".obsidian", "app.json"),
    JSON.stringify({ attachmentFolderPath: "Attachments" }),
  )
  const attachments = path.join(root, "Attachments")
  fs.mkdirSync(attachments)
  return {
    ...f,
    attachments,
    audioDirectory: path.join(f.repoRoot, "quartz", "static", "favorites-audio"),
  }
}

test("Obsidian audio embeds copy only referenced clips and render escaped players", (t) => {
  const f = audioFixture(t)
  fs.writeFileSync(path.join(f.attachments, "Favorite moment.mp3"), "selected audio bytes")
  fs.writeFileSync(path.join(f.attachments, "Private.mp3"), "private recording")
  f.write(
    "publish: true",
    '## Songs\n![[Favorite moment.mp3|A "favorite" <moment>]]\n%% ![[Private.mp3]] %%\n`![[Example.mp3]]`',
  )
  syncFavorites(f)
  const output = fs.readFileSync(f.destination, "utf8")
  assert.match(output, /<audio controls preload="none"/)
  assert.match(output, /A &quot;favorite&quot; &lt;moment&gt;/)
  assert.match(output, /`!\[\[Example.mp3\]\]`/)
  assert.doesNotMatch(output, /Private.mp3/)
  const files = fs.readdirSync(f.audioDirectory)
  assert.equal(files.length, 1)
  assert.equal(
    fs.readFileSync(path.join(f.audioDirectory, files[0]), "utf8"),
    "selected audio bytes",
  )
  assert.ok(output.includes(`/static/favorites-audio/${files[0]}`))
  assert.equal(syncFavorites(f).status, "unchanged")
})

test("Markdown audio links, encoded spaces and vault-relative paths work", (t) => {
  const f = audioFixture(t)
  fs.writeFileSync(path.join(f.attachments, "Two words.wav"), "audio")
  f.write(
    "publish: true",
    "![Clip](Attachments/Two%20words.wav)\n![Clip](<Attachments/Two words.wav>)\n![[Attachments/Two words.wav]]",
  )
  syncFavorites(f)
  assert.equal(fs.readFileSync(f.destination, "utf8").match(/<audio /g).length, 3)
  assert.equal(fs.readdirSync(f.audioDirectory).length, 1)
})

test("replacing, removing and unpublishing audio cleans up only managed clips", (t) => {
  const f = audioFixture(t)
  const clip = path.join(f.attachments, "clip.mp3")
  fs.writeFileSync(clip, "first")
  f.write("publish: true", "![[clip.mp3]]")
  syncFavorites(f)
  const first = fs.readdirSync(f.audioDirectory)[0]
  fs.writeFileSync(path.join(f.audioDirectory, "unrelated.mp3"), "keep")
  fs.writeFileSync(clip, "replacement")
  syncFavorites(f)
  assert.equal(fs.existsSync(path.join(f.audioDirectory, first)), false)
  f.write("publish: true", "No clip now.")
  syncFavorites(f)
  assert.deepEqual(fs.readdirSync(f.audioDirectory), ["unrelated.mp3"])
  f.write("publish: true", "![[clip.mp3]]")
  syncFavorites(f)
  f.write("publish: false", "![[clip.mp3]]")
  syncFavorites(f)
  assert.deepEqual(fs.readdirSync(f.audioDirectory), ["unrelated.mp3"])
  assert.equal(fs.readFileSync(clip, "utf8"), "replacement")
})

test("missing and ambiguous audio fail without changing existing public content", (t) => {
  const f = audioFixture(t)
  fs.writeFileSync(path.join(f.attachments, "clip.mp3"), "audio")
  f.write("publish: true", "![[clip.mp3]]")
  syncFavorites(f)
  const before = fs.readFileSync(f.destination, "utf8")
  const files = fs.readdirSync(f.audioDirectory)
  f.write("publish: true", "![[missing.mp3]]")
  assert.throws(() => syncFavorites(f), /not found/)
  fs.writeFileSync(path.join(path.dirname(f.source), "clip.mp3"), "different")
  f.write("publish: true", "![[clip.mp3]]")
  assert.throws(() => syncFavorites(f), /ambiguous/)
  assert.equal(fs.readFileSync(f.destination, "utf8"), before)
  assert.deepEqual(fs.readdirSync(f.audioDirectory), files)
})

test("outside-vault references and unsafe audio manifests cannot modify files", (t) => {
  const f = audioFixture(t)
  f.write("publish: true", "![[../outside.mp3]]")
  assert.throws(() => syncFavorites(f), /not found/)
  f.write("publish: true")
  syncFavorites(f)
  const manifest = path.join(f.repoRoot, "scripts", ".publish-favorites-audio.json")
  fs.mkdirSync(path.dirname(manifest), { recursive: true })
  fs.writeFileSync(manifest, '["../../index.md"]')
  f.write("publish: false")
  assert.throws(() => syncFavorites(f), /Invalid favorites audio manifest/)
  assert.equal(fs.existsSync(f.destination), true)
})
