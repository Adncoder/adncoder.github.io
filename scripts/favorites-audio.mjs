import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"

const extensions = new Set([".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".webm"])
const escape = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
const inside = (root, target) => {
  const relative = path.relative(root, target)
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function vaultFor(source) {
  let folder = path.dirname(path.resolve(source))
  while (!fs.existsSync(path.join(folder, ".obsidian"))) {
    const parent = path.dirname(folder)
    if (parent === folder)
      throw new Error("Cannot locate the Obsidian vault for audio attachments.")
    folder = parent
  }
  return fs.realpathSync(folder)
}

function locateAudio(reference, source) {
  const vault = vaultFor(source)
  const noteFolder = path.dirname(path.resolve(source))
  if (path.isAbsolute(reference) || /^[a-z]+:/i.test(reference))
    throw new Error("Audio attachments must be inside the Obsidian vault.")
  const settingsFile = path.join(vault, ".obsidian", "app.json")
  const settings = fs.existsSync(settingsFile)
    ? JSON.parse(fs.readFileSync(settingsFile, "utf8"))
    : {}
  const configured = settings.attachmentFolderPath || ""
  const attachmentFolder = configured.startsWith(".")
    ? path.resolve(noteFolder, configured)
    : path.resolve(vault, configured)
  const candidates = [
    ...new Set([
      path.resolve(noteFolder, reference),
      path.resolve(vault, reference),
      path.resolve(attachmentFolder, reference),
    ]),
  ].filter((file) => inside(vault, file) && fs.existsSync(file))
  const files = [...new Set(candidates.map((file) => fs.realpathSync(file)))]
  if (files.some((file) => !inside(vault, file) || !fs.statSync(file).isFile()))
    throw new Error(`Audio attachment must be a file inside the vault: ${reference}`)
  if (files.length !== 1)
    throw new Error(
      `Audio attachment ${files.length ? "is ambiguous" : "not found"}: ${reference}. Use its full vault-relative path.`,
    )
  if (fs.statSync(files[0]).size > 25 * 1024 * 1024)
    throw new Error(`Audio clip is over 25 MB: ${reference}. Export a shorter MP3 clip first.`)
  return files[0]
}

// Resolve every reference before making any public-file changes.
export function prepareAudio(body, source) {
  const assets = new Map()
  function embed(reference, label, wiki = false) {
    if (/^(?:https?:|data:|\/\/)/i.test(reference)) return null
    const decoded = decodeURIComponent(reference).replaceAll("\\", "/")
    if (!extensions.has(path.extname(decoded).toLowerCase())) {
      if (wiki)
        throw new Error(
          "Only local audio attachments are copied. Use a hosted image or media embed for other attachments.",
        )
      return null
    }
    const file = locateAudio(decoded, source)
    const bytes = fs.readFileSync(file)
    const hash = createHash("sha256").update(bytes).digest("hex")
    const name = hash + path.extname(file).toLowerCase()
    assets.set(name, bytes)
    const title = label || path.basename(decoded, path.extname(decoded))
    return `<audio controls preload="none" aria-label="${escape(title)}" src="/static/favorites-audio/${name}"></audio>`
  }
  // Code examples are text, not requests to publish an attachment.
  const text = body
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g)
    .map((part, index) => {
      if (index % 2) return part
      return part
        .replace(/!\[\[([^\]\n]+)\]\]/g, (_, value) => {
          const [reference, label] = value.split("|")
          return embed(reference, label, true)
        })
        .replace(
          /!\[([^\]\n]*)\]\((?:<([^>\n]+)>|([^\s)]+))\)/g,
          (original, label, wrapped, bare) => embed(wrapped || bare, label) || original,
        )
    })
    .join("")
  return { text, assets }
}

export function syncAudio(repoRoot, assets) {
  const directory = path.join(repoRoot, "quartz", "static", "favorites-audio")
  const manifest = path.join(repoRoot, "scripts", ".publish-favorites-audio.json")
  // Reject redirected directories before writing or removing managed files.
  for (const target of [
    "quartz",
    "quartz/static",
    "quartz/static/favorites-audio",
    "scripts",
    "scripts/.publish-favorites-audio.json",
  ]) {
    const file = path.join(repoRoot, target)
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink())
      throw new Error("Audio destination must not be a symbolic link.")
  }
  const previous = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, "utf8")) : []
  if (
    !Array.isArray(previous) ||
    previous.some(
      (name) =>
        typeof name !== "string" || !/^[a-f0-9]{64}\.(mp3|m4a|wav|ogg|flac|aac|webm)$/.test(name),
    )
  )
    throw new Error("Invalid favorites audio manifest.")
  for (const name of new Set([...previous, ...assets.keys()])) {
    const file = path.join(directory, name)
    if (fs.existsSync(file) && (fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile()))
      throw new Error("Managed audio destination must be a regular file.")
    if (assets.has(name) && fs.existsSync(file) && !fs.readFileSync(file).equals(assets.get(name)))
      throw new Error("Refusing to overwrite conflicting audio content.")
  }
  if (!assets.size && !previous.length) return
  fs.mkdirSync(directory, { recursive: true })
  fs.mkdirSync(path.dirname(manifest), { recursive: true })
  for (const [name, bytes] of assets) fs.writeFileSync(path.join(directory, name), bytes)
  for (const name of previous) {
    const file = path.join(directory, name)
    if (!assets.has(name) && fs.existsSync(file)) fs.unlinkSync(file)
  }
  fs.writeFileSync(manifest, JSON.stringify([...assets.keys()].sort(), null, 2) + "\n")
}
