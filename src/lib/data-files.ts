import "server-only"

import fs from "node:fs"
import path from "node:path"

// The big shared JSONs, read from disk once instead of compiled into every importing route's
// chunk. Before this module, features.json rode in 4 chunks, home-feed in 8, yt-shorts in 8 and
// reference-model in 8 — each copy paid twice in the deploy (the server directory ships raw and
// again inside standalone). The literal fs paths are what the build's file tracer follows, so each
// file lands in the deploy exactly once; the type-only imports erase at compile.

type Features = typeof import("../../data/generated/features.json")
type HomeFeed = typeof import("../../data/generated/home-feed.json")
type YtShorts = typeof import("../../data/raw/yt-shorts.json")
type ReferenceModel = typeof import("../../data/generated/model/reference-model.json")

let _features: Features | null = null
export const featuresFile = (): Features => (_features ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/generated/features.json"), "utf8")))

let _homeFeed: HomeFeed | null = null
export const homeFeedFile = (): HomeFeed => (_homeFeed ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/generated/home-feed.json"), "utf8")))

let _ytShorts: YtShorts | null = null
export const ytShortsFile = (): YtShorts => (_ytShorts ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/raw/yt-shorts.json"), "utf8")))

let _reference: ReferenceModel | null = null
export const referenceModelFile = (): ReferenceModel => (_reference ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/generated/model/reference-model.json"), "utf8")))
