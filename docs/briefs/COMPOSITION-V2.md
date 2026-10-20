# Composition v2 — the neglected measurables (Brendan's word, 2026-10-20 ~06:15 Eastern)

Every property below is measurable from the file alone and not yet measured. They extend `scripts/composition/extract.py` and the Mac merge; same output file, `version: composition-2`. Code lands now; the box run itself waits for the full catalog media and rides the next extraction launch. Exact unless marked ≈ (approximate method, named in the notes column of the output).

## Container (ffprobe, free)
fileSizeMb, videoBitrateKbps, audioBitrateKbps, width, height, fps, codec, aspectRatio

## Visual (existing frame pass, extended)
shotCount, medianShotSec, longestShotSec, motionMagnitude (mean inter-frame global motion), faceCountMax, faceCountMedian, faceScreenShare (OpenCV detector), paletteColors (distinct dominant colors by k-means at k up to 8, count that explains 90% of pixels), dominantHue, darkFrameShare, brightnessVariance

## On-screen text (existing OCR pass, extended)
overlayWordsTotal, overlayMedianDurationSec, overlayStyleClusters ≈ (distinct text styles by size/position/color clustering — the honest stand-in for "fonts"), captionCoverageShare (share of runtime with burned captions)

## Audio (existing loudness pass, extended)
musicShare ≈, silenceShare, bpm ≈ (when music present), endLoudnessDelta (last 3 s against the rest), speakerCount ≈ (pitch/energy clustering, not identity — counts voices, never infers who or what they are)

## Speech (from the merged transcripts, Mac-side)
wordCount, sentenceCount, topicSegments ≈ (the operational "distinct ideas": embedding-shift segmentation), readabilityGrade, questionCount, firstPersonRate, secondPersonRate, namedPeopleCount ≈, namedPlacesCount ≈, repetitionRate, hookIsQuestion, ctaInSpeech, ctaTimeSec

## Thumbnail (one pass over the stored thumbnails)
thumbFacePresent, thumbTextPresent, thumbTextWords

Rules as ever: measured values only, a null where the method does not apply, coverage counts in the output header, no measurement of demographic or identity attributes of people on screen or on mic — counts and screen-share only. `docs/VARIABLES.html` gains these rows when the first v2 run lands, not before.
