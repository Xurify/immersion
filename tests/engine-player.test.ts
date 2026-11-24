import { test, expect } from "bun:test";
import { detectLanguage, mergeMeta, metaFromPlayerResponse, type PlayerResponse } from "../lib/engine/player";
import type { VideoMeta } from "../lib/types";

const details = { videoId: "abc123XYZ_0", title: "(2) Un día en Madrid - YouTube", author: "Canal", lengthSeconds: "754" };

test("detects the original audio language, even when it is not the default track", () => {
  const response: PlayerResponse = {
    videoDetails: details,
    streamingData: {
      adaptiveFormats: [
        { audioTrack: { id: "en.4", isAutoDubbed: true } },
        { audioTrack: { id: "es-419.0", audioIsDefault: false } },
        { audioTrack: { id: "en.0", audioIsDefault: true } },
      ],
    },
  };
  expect(detectLanguage(response)).toBe("en");
});

test("with auto-dubs and one original track, the original wins", () => {
  const response: PlayerResponse = {
    videoDetails: details,
    streamingData: {
      formats: [{ audioTrack: { id: "fr.0", isAutoDubbed: true } }, { audioTrack: { id: "pt-BR.2" } }],
      adaptiveFormats: [{ audioTrack: { id: "fr.0", isAutoDubbed: true } }],
    },
  };
  expect(detectLanguage(response)).toBe("pt");
});

test("falls back to the default audio track index", () => {
  const response: PlayerResponse = {
    videoDetails: details,
    captions: {
      playerCaptionsTracklistRenderer: {
        audioTracks: [{ audioTrackId: "de.1" }, { audioTrackId: "ja.0" }],
        defaultAudioTrackIndex: 1,
      },
    },
  };
  expect(detectLanguage(response)).toBe("ja");
});

test("uses the sole caption track when there is no audio hint", () => {
  const response: PlayerResponse = {
    videoDetails: details,
    captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: "sk-SK", kind: "asr" }] } },
  };
  expect(detectLanguage(response)).toBe("sk");
});

test("several auto-generated caption tracks with no hint give no language", () => {
  const response: PlayerResponse = {
    videoDetails: details,
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          { languageCode: "en", kind: "asr" },
          { languageCode: "fr", kind: "asr" },
        ],
      },
    },
  };
  expect(detectLanguage(response)).toBeNull();
});

test("metaFromPlayerResponse cleans the title and reads duration and language", () => {
  const response: PlayerResponse = {
    videoDetails: { ...details, defaultAudioLanguageCode: "es" },
  };
  expect(metaFromPlayerResponse(response)).toEqual({
    videoId: "abc123XYZ_0",
    title: "Un día en Madrid",
    channel: "Canal",
    duration: 754,
    detectedLang: "es",
    langSource: "captions",
  });
});

const base: VideoMeta = { videoId: "abc123XYZ_0", title: "Título", channel: "Canal", duration: 0, detectedLang: null };

test("mergeMeta keeps a caption-based language over a text guess, and a text guess over none", () => {
  const guessed: VideoMeta = { ...base, detectedLang: "sk", langSource: "text" };
  const captioned: VideoMeta = { ...base, detectedLang: "et", langSource: "captions" };
  expect(mergeMeta(guessed, captioned).detectedLang).toBe("et");
  expect(mergeMeta(captioned, guessed).detectedLang).toBe("et");
  expect(mergeMeta(base, guessed).detectedLang).toBe("sk");
  expect(mergeMeta(guessed, base).detectedLang).toBe("sk");
});

test("mergeMeta keeps existing non-empty values when the fresh one is empty", () => {
  const stored: VideoMeta = { ...base, title: "Stored", channel: "Chan", duration: 300, detectedLang: "fr", langSource: "captions" };
  expect(mergeMeta(stored, { ...base, title: "", channel: "" })).toEqual(stored);
});

test("metaFromPlayerResponse reports live streams with zero duration and no video as null", () => {
  expect(metaFromPlayerResponse({ videoDetails: { ...details, isLive: true } })?.duration).toBe(0);
  expect(metaFromPlayerResponse({ videoDetails: {} })).toBeNull();
  expect(metaFromPlayerResponse(undefined)).toBeNull();
});

test("an auto-dubbed default track does not hide the original language", () => {
  const { detectLanguage } = require("../lib/engine/player");
  const response = {
    videoDetails: { videoId: "x" },
    captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ languageCode: "en", kind: "asr" }, { languageCode: "ru", kind: "asr" }], audioTracks: [{ audioTrackId: "en-US.10" }, { audioTrackId: "ru.4" }], defaultAudioTrackIndex: 0 } },
    streamingData: { adaptiveFormats: [{ audioTrack: { id: "en-US.10", displayName: "English (US)", audioIsDefault: true, isAutoDubbed: true } }, { audioTrack: { id: "ru.4", displayName: "Russian original", audioIsDefault: false } }] },
  };
  expect(detectLanguage(response)).toBe("ru");
});
