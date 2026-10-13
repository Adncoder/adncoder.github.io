import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import YAML from "yaml"

const marker = "publish-favorites"
export const defaultSource =
  "G:/My Drive/Obsidian Vault/Andrew/Life/Watch & Reading List/All-Time Favorites.md"

function parts(text) {
  const match = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text)
  if (!match) throw new Error("The favorites note needs YAML properties at the beginning.")
  const metadata = YAML.parse(match[1])
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    throw new Error("Invalid favorites properties.")
  return { metadata, body: text.slice(match[0].length) }
}

function publicBody(body) {
  // Obsidian comments and HTML comments are authoring notes, not public content.
  let text = body.replace(/%%[\s\S]*?%%/g, "").replace(/<!--[\s\S]*?-->/g, "")
  if (text.includes("%%") || text.includes("<!--"))
    throw new Error("Close the unfinished comment in your favorites note before publishing.")
  if (/!\[\[/.test(text))
    throw new Error(
      "Favorites attachments are not copied automatically. Use a hosted image or media embed instead of an Obsidian attachment.",
    )
  return text.trim() + "\n"
}

export function syncFavorites({
  source = defaultSource,
  repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
} = {}) {
  if (!fs.existsSync(source))
    throw new Error(`Favorites source note not found: ${source}. No website files were changed.`)
  const { metadata, body } = parts(fs.readFileSync(source, "utf8"))
  const content = path.join(path.resolve(repoRoot), "content")
  const destination = path.join(content, "favorites.md")
  if (fs.existsSync(content) && fs.lstatSync(content).isSymbolicLink())
    throw new Error("Favorites destination must be a real content folder.")
  const exists = fs.existsSync(destination)
  if (exists) {
    if (fs.lstatSync(destination).isSymbolicLink())
      throw new Error("Favorites destination cannot be a symbolic link.")
    if (parts(fs.readFileSync(destination, "utf8")).metadata["generated-by"] !== marker)
      throw new Error("Refusing to overwrite an unmanaged content/favorites.md.")
  }
  if (metadata.publish !== true) {
    if (exists) fs.unlinkSync(destination)
    return { status: exists ? "removed" : "draft", destination }
  }
  if (metadata.type !== "collection")
    throw new Error("Favorites must have type: collection and publish: true.")
  const cleanBody = publicBody(body)
  if (!cleanBody.trim()) throw new Error("Add favorites before publishing the collection.")
  const properties = {
    title: typeof metadata.title === "string" ? metadata.title : "All-Time Favorites",
    ...(typeof metadata.description === "string" ? { description: metadata.description } : {}),
    type: "collection",
    publish: true,
    cssclasses: ["favorites"],
    "generated-by": marker,
  }
  const output = `---\n${YAML.stringify(properties)}---\n\n${cleanBody}`
  if (exists && fs.readFileSync(destination, "utf8") === output)
    return { status: "unchanged", destination }
  fs.mkdirSync(content, { recursive: true })
  fs.writeFileSync(destination, output, "utf8")
  return { status: "updated", destination }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    const options = {}
    for (let i = 0; i < args.length; i += 2) {
      const key = { "--source": "source", "--repo": "repoRoot" }[args[i]]
      if (!key || !args[i + 1])
        throw new Error(
          "Usage: node scripts/publish-favorites.mjs [--source NOTE] [--repo REPOSITORY]",
        )
      options[key] = args[i + 1]
    }
    console.log(`Favorites: ${syncFavorites(options).status}`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
