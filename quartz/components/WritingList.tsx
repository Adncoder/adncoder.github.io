import { QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"

// The public build is the source of truth: notebooks and private notes never
// become catalogue entries, and unpublishing a work removes its entry too.
export default function WritingList({ fileData, allFiles }: QuartzComponentProps) {
  const isHome = fileData.slug === "index"
  if (!isHome && fileData.slug !== "writing/index") return null

  const works = allFiles
    .filter(
      (file) =>
        file.frontmatter?.type === "writing" &&
        file.frontmatter?.publish === true &&
        file.unlisted !== true &&
        file.frontmatter?.unlisted !== true &&
        file.slug?.startsWith("writing/"),
    )
    .sort(
      (a, b) =>
        String(b.frontmatter?.date ?? "").localeCompare(String(a.frontmatter?.date ?? "")) ||
        String(a.frontmatter?.title ?? "").localeCompare(String(b.frontmatter?.title ?? "")),
    )
  const visibleWorks = isHome ? works.slice(0, 5) : works
  if (!visibleWorks.length) return null

  return (
    <section class="writing-catalogue" aria-labelledby="writing-catalogue-title">
      <div class="catalogue-heading">
        <h2 id="writing-catalogue-title">{isHome ? "Recent writing" : "All writing"}</h2>
        {isHome && (
          <a class="internal" href={resolveRelative(fileData.slug!, "writing/index" as FullSlug)}>
            All writing <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
      <ul class="writing-entries">
        {visibleWorks.map((file) => (
          <li key={file.slug}>
            <div class="writing-entry-main">
              <span class="writing-genre">
                {String(file.frontmatter?.genre ?? "Writing").replace(/-/g, " ")}
              </span>
              <h3>
                <a class="internal" href={resolveRelative(fileData.slug!, file.slug!)}>
                  {file.frontmatter?.title}
                </a>
              </h3>
              {file.frontmatter?.description && <p>{String(file.frontmatter.description)}</p>}
            </div>
            {file.frontmatter?.date && (
              <time datetime={String(file.frontmatter.date)}>{String(file.frontmatter.date)}</time>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
