import { baseLang } from "../languages";
import type { Lang, VideoMeta } from "../types";
import { cleanTitle } from "./title";

/** The slice of YouTube's player response (getPlayerResponse()) this extension reads. */
export interface PlayerResponse {
  videoDetails?: {
    videoId?: string;
    title?: string;
    author?: string;
    lengthSeconds?: string;
    isLive?: boolean;
    defaultAudioLanguageCode?: string;
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
  audioIsDefault?: boolean;
  isAutoDubbed?: boolean;
}

/** Audio track ids look like "es.4": the language, then a track number. */
function codeOf(audioTrackId: string | undefined): string | undefined {
  return audioTrackId?.split(".")[0];
}

function originalAudioCode(response: PlayerResponse): string | undefined {
  const streaming = response.streamingData;
  const tracks = new Map<string, AudioLabel>();
  for (const format of [...(streaming?.formats ?? []), ...(streaming?.adaptiveFormats ?? [])]) {
    const track = format.audioTrack;
    if (track?.id) tracks.set(track.id, track);
  }
  const all = [...tracks.values()];
  const originals = all.filter((track) => !track.isAutoDubbed);
  const original =
    all.find((track) => track.audioIsDefault) ??
    (all.some((track) => track.isAutoDubbed) && originals.length === 1 ? originals[0] : undefined);
  return codeOf(original?.id);
}

function defaultAudioTrackCode(response: PlayerResponse): string | undefined {
  const renderer = response.captions?.playerCaptionsTracklistRenderer;
  const index = renderer?.defaultAudioTrackIndex;
  return codeOf(typeof index === "number" ? renderer?.audioTracks?.[index]?.audioTrackId : undefined);
}

/** Caption tracks are a weaker guess: auto-generated tracks can name the wrong language. */
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
  return baseLang(originalAudioCode(response) ?? defaultAudioTrackCode(response) ?? hint ?? captionCode(response) ?? null);
}

/** The metadata for the video the player response describes, or null when it has no video id. */
export function metaFromPlayerResponse(response: PlayerResponse | null | undefined): VideoMeta | null {
  const details = response?.videoDetails;
  if (!details?.videoId) return null;
  return {
    videoId: details.videoId,
    title: cleanTitle(details.title ?? ""),
    channel: details.author ?? "",
    duration: details.isLive ? 0 : Number(details.lengthSeconds) || 0,
    detectedLang: detectLanguage(response),
  };
}
