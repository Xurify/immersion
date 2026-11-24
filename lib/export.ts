import type { Sentence } from "./types";

/** Fields can't hold the separators; line breaks and tabs become spaces. */
const flat = (text: string) => text.replace(/[\t\r\n]+/g, " ").trim();

function stamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Tab-separated notes for Anki: sentence, translation, source, link to the moment in the video.
 * The header lines let Anki's importer pick the separator and field names.
 */
export function ankiTsv(sentences: Sentence[]): string {
  const lines = ["#separator:tab", "#html:false", "#columns:Sentence\tTranslation\tSource\tLink"];
  for (const sentence of sentences) {
    lines.push(
      [
        flat(sentence.text),
        flat(sentence.translation),
        flat(`${sentence.videoTitle} (${stamp(sentence.start)})`),
        `https://www.youtube.com/watch?v=${sentence.videoId}&t=${Math.floor(sentence.start)}s`,
      ].join("\t"),
    );
  }
  return lines.join("\n") + "\n";
}

const csvField = (text: string) => `"${flat(text).replace(/"/g, '""')}"`;

/**
 * Rows for a Clozemaster custom collection: sentence, translation. The cloze column is left
 * out so Clozemaster picks the word. Sentences without a translation are skipped; it needs one.
 */
export function clozemasterCsv(sentences: Sentence[]): { csv: string; skipped: number } {
  const usable = sentences.filter((sentence) => sentence.translation.trim() !== "");
  const csv = usable.map((sentence) => `${csvField(sentence.text)},${csvField(sentence.translation)}`).join("\n");
  return { csv: csv ? csv + "\n" : "", skipped: sentences.length - usable.length };
}
