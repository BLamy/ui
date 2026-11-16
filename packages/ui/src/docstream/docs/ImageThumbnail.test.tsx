// @vitest-environment happy-dom
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { parseMarkdown } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"
import { MarkdownContent } from "./DocsRenderer"
import { ImageThumbnail, thumbnailLabel } from "./ImageThumbnail"
import { focus, mount, press, tick } from "../__fixtures__/dom"

const html = (md: string) => renderToString(<MarkdownContent markdown={md} />)

describe("thumbnail images", () => {
  it("are images whose title starts with `thumbnail`, with an optional badge", () => {
    const image = (title?: string) => ({ type: "image" as const, src: "a.jpg", ...(title === undefined ? {} : { title }) })
    expect(thumbnailLabel(image("thumbnail: 0:39.8"))).toBe("0:39.8")
    expect(thumbnailLabel(image("Thumbnail"))).toBe("")
    expect(thumbnailLabel(image("A photo"))).toBeNull()
    expect(thumbnailLabel(image())).toBeNull()
    expect(thumbnailLabel({ type: "text", text: "thumbnail" })).toBeNull()
  })

  it("first in a paragraph, set the text beside them, with the badge and a hover card", () => {
    const out = html('![Overview](shots/a.jpg "thumbnail: 0:39.8") The console Overview loads.\n')
    expect(out).toContain('class="docs-media"')
    expect(out).toContain('class="docs-thumb"')
    expect(out).toContain('data-slot="hover-card-trigger"')
    // The card (a second badge, the full image) mounts when it opens.
    expect(out.match(/docs-thumb-badge">0:39.8</g)).toHaveLength(1)
    expect(out).toContain('aria-label="Overview"')
    expect(out).toMatch(/docs-media-body"><span>The console Overview loads.<\/span>/)
  })

  it("work in list items, and mid-sentence stay inline without the media layout", () => {
    expect(html('1. ![Step](s.jpg "thumbnail: 0:01.2") Clicked Save\n')).toContain('class="docs-media"')
    const mid = html('Before ![x](s.jpg "thumbnail") after\n')
    expect(mid).toContain('class="docs-thumb"')
    expect(mid).not.toContain("docs-media")
  })

  it("other titled images render as before", () => {
    const out = html('![Badge](b.svg "Build status") Passing\n')
    expect(out).toContain("docs-inline-img")
    expect(out).not.toContain("docs-thumb")
  })

  it("open their hover card on keyboard focus after the delay, and close it with Escape", async () => {
    const { host, unmount } = await mount(<MarkdownContent markdown={'![Overview](shots/a.jpg "thumbnail: 0:39.8") Loads.\n'} />)
    const thumb = host.querySelector<HTMLElement>(".docs-thumb")!
    expect(thumb.tabIndex).toBe(0)
    expect(thumb.getAttribute("role")).toBe("img")
    expect(host.querySelector(".docs-thumb-card")).toBeNull()
    await press("Tab", document.body)
    await focus(thumb)
    await tick(260)
    const card = host.querySelector<HTMLElement>(".docs-thumb-card")!
    expect(card.getAttribute("data-slot")).toBe("hover-card-content")
    expect(card.querySelector("img")!.getAttribute("alt")).toBe("Overview")
    expect(document.activeElement).toBe(thumb)
    await press("Escape")
    expect(host.querySelector(".docs-thumb-card[data-open]")).toBeNull()
    expect(document.activeElement).toBe(thumb)
    await unmount()
  })

  it("linked, are one link that names the image and opens the same card", async () => {
    const image = { type: "image" as const, src: "a.jpg", alt: "Overview", link: "https://example.com/shot" }
    const { host, unmount } = await mount(<ImageThumbnail image={image} label="0:01" />)
    const links = host.querySelectorAll("a")
    expect(links).toHaveLength(1)
    expect(links[0]!.className).toBe("docs-thumb docs-thumb-link")
    expect(links[0]!.getAttribute("href")).toBe("https://example.com/shot")
    expect(links[0]!.getAttribute("aria-label")).toBe("Overview")
    await press("Tab", document.body)
    await focus(links[0]!)
    await tick(260)
    expect(host.querySelector(".docs-thumb-card")).not.toBeNull()
    await unmount()
  })

  it("round-trip through Markdown unchanged", () => {
    const md = '1. ![Overview](shots/a.jpg "thumbnail: 0:39.8") The console Overview loads.\n'
    expect(serializeMarkdown(parseMarkdown(md))).toBe(md)
  })

  it("in a stepper step's heading, sit beside the title; the title text leaves them out", () => {
    const md = [
      "{% stepper %}",
      "{% step %}",
      '### ![Overview](shots/a.jpg "thumbnail: 0:39.8") Overview loads with Unauthorized',
      "",
      "The ticker shows the fallback.",
      "{% endstep %}",
      "{% step %}",
      "### Plain step",
      "",
      "Body",
      "{% endstep %}",
      "{% endstepper %}",
      "",
    ].join("\n")
    const doc = parseMarkdown(md)
    const stepper = doc.children[0]
    expect(stepper?.type === "stepper" && stepper.steps.map((s) => s.title)).toEqual(["Overview loads with Unauthorized", "Plain step"])
    const out = html(md)
    expect(out).toContain('class="docs-step-main docs-step-media"')
    expect(out).toContain('docs-thumb-badge">0:39.8<')
    // The title and the body sit together beside the image.
    expect(out).toMatch(/docs-step-media-body"><div class="docs-step-title"><span>Overview loads with Unauthorized<\/span><\/div>.*The ticker shows the fallback/)
    expect(out).toContain('<div class="docs-step-title">Plain step</div>')
    expect(serializeMarkdown(doc)).toBe(md)
  })
})
