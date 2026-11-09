import { describe, expect, it } from "vitest"
import { parseWebVTT, replayCaptionsAt } from "./captions"

describe("captions", () => {
  it("reads WebVTT cues: identifiers, both timestamp forms, settings, tags and entities", () => {
    const cues = parseWebVTT(
      "﻿WEBVTT - narration\r\n\r\nNOTE written by the agent\r\n\r\nstep-1\r\n00:00:01.5 --> 00:00:03.250 align:start\r\n<v Agent>Opens</v> the cart &amp; pays\r\n\r\n00:04.000 --> 01:00.000\r\nTwo\nlines\r\n\r\n00:09.000 --> 00:08.000\r\nbackwards\r\n",
    )
    expect(cues).toEqual([
      { start: 1500, end: 3250, text: "Opens the cart & pays" },
      { start: 4000, end: 60000, text: "Two\nlines" },
    ])
    expect(replayCaptionsAt(cues, 3249).map((c) => c.text)).toEqual(["Opens the cart & pays"])
    expect(replayCaptionsAt(cues, 3250)).toEqual([])
  })

  it("gives no cues for text that isn't WebVTT", () => {
    expect(parseWebVTT("1\n00:00:01,000 --> 00:00:02,000\nan SRT file\n")).toEqual([])
  })
})
