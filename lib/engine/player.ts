import { baseLang } from "../languages";
import type { Lang, VideoMeta } from "../types";
import { cleanTitle } from "./title";

/** The slice of YouTube's player response (getPlayerResponse()) this extension reads. */
export interface PlayerResponse {
  videoDetails?: {
    videoId?: string;
    title?: string;
    author?: string;
    channelId?: string;
    lengthSeconds?: string;
    isLive?: boolean;
    defaultAudioLanguageCode?: string;
    shortDescription?: string;
  };
  microformat?: { playerMicroformatRenderer?: { defaultAudioLanguage?: string } };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: { languageCode?: string; kind?: string }[];
      audioTracks?: { audioTrackId?: string }[];
      defaultAudioTrackIndex?: number;
    };
  };
  streamingData?: {
    formats?: { audioTrack?: AudioLabel }[];
    adaptiveFormats?: { audioTrack?: AudioLabel }[];
  };
}

interface AudioLabel {
  id?: string;
  displayName?: string;
  audioIsDefault?: boolean;
  isAutoDubbed?: boolean;
}

/** Audio track ids look like "es.4": the language, then a track number. */
function codeOf(audioTrackId: string | undefined): string | undefined {
  return audioTrackId?.split(".")[0];
}

/**
 * The original audio's language. Auto-dubbed tracks are skipped: with an English
 * interface YouTube makes its English dub the default track, so "default" alone
 * would call a Russian interview English.
 */
function originalAudioCode(response: PlayerResponse): string | undefined {
  const streaming = response.streamingData;
  const tracks = new Map<string, AudioLabel>();
  for (const format of [...(streaming?.formats ?? []), ...(streaming?.adaptiveFormats ?? [])]) {
    const track = format.audioTrack;
    if (track?.id) tracks.set(track.id, track);
  }
  const originals = [...tracks.values()].filter((track) => !track.isAutoDubbed);
  if (originals.length === 0) return undefined;
  const original =
    originals.find((track) => /original/i.test(track.displayName ?? "")) ??
    (originals.length === 1 ? originals[0] : originals.find((track) => track.audioIsDefault));
  return codeOf(original?.id);
}

function dubbedTrackIds(response: PlayerResponse): Set<string> {
  const streaming = response.streamingData;
  const ids = [...(streaming?.formats ?? []), ...(streaming?.adaptiveFormats ?? [])].flatMap((format) =>
    format.audioTrack?.isAutoDubbed && format.audioTrack.id ? [format.audioTrack.id] : [],
  );
  return new Set(ids);
}

function defaultAudioTrackCode(response: PlayerResponse): string | undefined {
  const renderer = response.captions?.playerCaptionsTracklistRenderer;
  const index = renderer?.defaultAudioTrackIndex;
  const id = typeof index === "number" ? renderer?.audioTracks?.[index]?.audioTrackId : undefined;
  return id && !dubbedTrackIds(response).has(id) ? codeOf(id) : undefined;
}

/** Auto-generated captions are transcribed from the original audio, so a single one names the spoken language. */
function speechRecognitionCode(response: PlayerResponse): string | undefined {
  const asr = (response.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []).filter((track) => track.kind === "asr" && track.languageCode);
  return asr.length === 1 ? asr[0]?.languageCode : undefined;
}

/** Manual captions are a weaker guess: channels often upload translations. */
function captionCode(response: PlayerResponse): string | undefined {
  const tracks = (response.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []).filter((track) => track.languageCode);
  if (tracks.length === 1) return tracks[0]?.languageCode;
  const manual = tracks.filter((track) => track.kind !== "asr");
  return manual.length === 1 ? manual[0]?.languageCode : undefined;
}

/** The video's spoken language, as a base code. Original audio beats default-track and caption guesses. */
export function detectLanguage(response: PlayerResponse | null | undefined): Lang | null {
  if (!response) return null;
  const details = response.videoDetails;
  const hint = details?.defaultAudioLanguageCode ?? response.microformat?.playerMicroformatRenderer?.defaultAudioLanguage;
  return baseLang(originalAudioCode(response) ?? speechRecognitionCode(response) ?? defaultAudioTrackCode(response) ?? hint ?? captionCode(response) ?? null);
}

/** The metadata for the video the player response describes, or null when it has no video id. */
export function metaFromPlayerResponse(response: PlayerResponse | null | undefined): VideoMeta | null {
  const details = response?.videoDetails;
  if (!details?.videoId) return null;
  const detectedLang = detectLanguage(response);
  return {
    videoId: details.videoId,
    title: cleanTitle(details.title ?? ""),
    channel: details.author ?? "",
    ...(details.channelId ? { channelId: details.channelId } : {}),
    duration: details.isLive ? 0 : Number(details.lengthSeconds) || 0,
    detectedLang,
    langSource: detectedLang ? "captions" : undefined,
  };
}

/** Rank of what a meta says about language: captions beat a text guess, and either beats none. */
function langRank(meta: VideoMeta): number {
  if (!meta.detectedLang) return 0;
  return meta.langSource === "text" ? 1 : 2;
}

/** Combines a stored meta with a fresh one: a non-empty value wins, and a higher-ranked language stays. */
export function mergeMeta(previous: VideoMeta | undefined, incoming: VideoMeta): VideoMeta {
  if (!previous) return incoming;
  const keep = langRank(previous) > langRank(incoming) ? previous : incoming;
  return {
    videoId: incoming.videoId,
    title: incoming.title || previous.title,
    channel: incoming.channel || previous.channel,
    duration: incoming.duration || previous.duration,
    detectedLang: keep.detectedLang,
    langSource: keep.langSource,
    ...(incoming.channelId || previous.channelId ? { channelId: incoming.channelId || previous.channelId } : {}),
  };
}
