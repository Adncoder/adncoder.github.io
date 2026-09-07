import { PageFrame, PageFrameProps } from "./types"
import HeaderConstructor from "../Header"
import WritingList from "../WritingList"
import { pathToRoot } from "../../util/path"

const Header = HeaderConstructor()

/** Single-column reading layout with navigation shared by every public page. */
export const FullWidthFrame: PageFrame = {
  name: "full-width",
  render({
    componentData,
    header,
    beforeBody,
    pageBody: Content,
    afterBody,
    footer,
  }: PageFrameProps) {
    const root = pathToRoot(componentData.fileData.slug!)
    const isHome = componentData.fileData.slug === "index"
    return (
      <>
        <div
          class="center full-width"
          data-writing-genre={String(componentData.fileData.frontmatter?.genre ?? "")}
          data-home={isHome ? "true" : "false"}
          data-writing-index={componentData.fileData.slug === "writing/index" ? "true" : "false"}
        >
          <a class="skip-link" href="#main-content">
            Skip to content
          </a>
          <div class="site-masthead">
            <a class="site-name internal" href={`${root}/`}>
              {componentData.cfg.pageTitle}
            </a>
            <nav aria-label="Main navigation">
              <a class="internal" href={`${root}/`} aria-current={isHome ? "page" : undefined}>
                Home
              </a>
              <a
                class="internal"
                href={`${root}/writing/`}
                aria-current={componentData.fileData.slug === "writing/index" ? "page" : undefined}
              >
                Writing
              </a>
            </nav>
            <Header {...componentData}>
              {header.map((HeaderComponent) => (
                <HeaderComponent {...componentData} />
              ))}
            </Header>
          </div>
          <main id="main-content" tabIndex={-1}>
            <div class="page-header">
              <div class="popover-hint">
                {beforeBody.map((BodyComponent) => (
                  <BodyComponent {...componentData} />
                ))}
              </div>
            </div>
            <Content {...componentData} />
            <WritingList {...componentData} />
            <div class="page-footer">
              {afterBody.map((BodyComponent) => (
                <BodyComponent {...componentData} />
              ))}
            </div>
          </main>
        </div>
        {footer.map((FooterComponent) => (
          <FooterComponent {...componentData} />
        ))}
      </>
    )
  },
}
