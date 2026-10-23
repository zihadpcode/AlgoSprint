"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { studyLanguageLabel, useStudyLanguage } from "@/components/workspace/study-language";
import type { ProblemWalkthrough } from "@/lib/problem-walkthroughs";
import { ProblemWalkthroughVideo } from "./problem-walkthrough";
import { embedUrl, formatTimestamp, watchUrl } from "@/lib/youtube";
import type { ProblemDetail } from "@/features/problems/detail-query";

type Video = Omit<ProblemDetail["videos"][number], "codingLanguages"> & { codingLanguages?: readonly string[] };

// Fixed framing keeps reference lessons distinct from the exact AlgoSprint contract.
export const VIDEO_FRAMING = "These are reference lessons. The video may solve a related problem; the bridge notes explain what matches and what you still need to adapt for AlgoSprint.";

export function VideoLesson({ videos, walkthroughs = [], isVisible = true }: { videos: Video[]; walkthroughs?: ProblemWalkthrough[]; isVisible?: boolean }) {
  const study = useStudyLanguage();
  const [localLanguage, setLocalLanguage] = useState("ALL");
  const [otherFor, setOtherFor] = useState<string | null>(null);
  const [playbackSession, setPlaybackSession] = useState(0);
  const language = study?.language ?? localLanguage;
  const available = study?.languages ?? [...new Set([...videos.flatMap((video) => video.codingLanguages ?? []), ...walkthroughs.map((walkthrough) => walkthrough.language)])];
  const matchingWalkthroughs = language === "ALL" ? walkthroughs : walkthroughs.filter((walkthrough) => walkthrough.language === language);
  const matching = language === "ALL" ? videos : videos.filter((video) => video.codingLanguages?.includes(language));
  const otherCount = videos.length - matching.length;
  const showingOther = otherFor === `${language}:${study?.selection ?? 0}`;
  const shown = showingOther ? videos : matching;
  if (!videos.length && !walkthroughs.length) return null;
  return <div>
    <p className="mt-3 text-sm leading-7 text-muted">{walkthroughs.length ? "AlgoSprint walkthroughs use this exact problem. External reference lessons include bridge notes explaining what to adapt." : VIDEO_FRAMING}</p>
    <details className="mt-4" onToggle={(event) => {
      // Hiding a native disclosure does not stop its media. Unmount loaded players on close.
      if (!event.currentTarget.open) setPlaybackSession((session) => session + 1);
    }}>
      <summary className="cursor-pointer rounded-xl border border-line p-4 font-semibold text-accent">Reveal {videos.length + walkthroughs.length === 1 ? "the video lesson" : "video lessons"}</summary>
      <p className="my-5 text-sm leading-7 text-muted">The concept and the bridge can hint at the approach. Try the hints first if you want to find the idea yourself.</p>
      {(available.length > 0 || study) && <label className="mb-4 flex flex-wrap items-center gap-3 text-sm font-medium">Video language
        <select className="min-h-11 rounded-xl border border-line bg-canvas px-3 py-2" value={language} onChange={(event) => {
          if (study) study.selectLanguage(event.target.value); else setLocalLanguage(event.target.value);
        }}>
          {!study && <option value="ALL">All lessons</option>}
          {available.map((value) => <option key={value} value={value}>{studyLanguageLabel(value)}</option>)}
        </select>
      </label>}
      {matching.length === 0 && matchingWalkthroughs.length === 0 && <p role="status" className="mb-4 text-sm leading-7 text-muted">No video with verified {studyLanguageLabel(language ?? "selected-language")} code is available here yet. Other concept lessons may still help.</p>}
      {isVisible && matchingWalkthroughs.length > 0 && <ul className="mb-8 space-y-8">{matchingWalkthroughs.map((walkthrough) =>
        <li key={`${walkthrough.src}:${language}:${playbackSession}:${isVisible}`}><ProblemWalkthroughVideo walkthrough={walkthrough} /></li>)}</ul>}
      {otherCount > 0 && <div className="mb-5">
        <button type="button" className="min-h-11 text-left text-sm font-semibold text-accent underline underline-offset-4"
          onClick={() => setOtherFor(showingOther ? null : `${language}:${study?.selection ?? 0}`)}>
          {showingOther ? "Hide other concept lessons" : `Show ${otherCount} other concept lesson${otherCount === 1 ? "" : "s"}`}
        </button>
        <p className="mt-1 text-xs leading-6 text-muted">These may use another programming language or have an unverified coding language. Their ideas can still transfer.</p>
      </div>}
      {isVisible && <ul className="space-y-8">
        {shown.map((video) => <li key={`${video.youtubeId}:${language}:${playbackSession}:${isVisible}`}><VideoItem video={video} /></li>)}
      </ul>}
    </details>
  </div>;
}

function VideoItem({ video }: { video: Video }) {
  const id = useId();
  // null means the player has not been loaded, so no request is made to YouTube until the learner asks for it.
  const [start, setStart] = useState<number | null>(null);
  const loaded = start !== null;
  return <article aria-labelledby={`${id}-concept`} className="space-y-4 rounded-xl border border-line bg-canvas p-4 sm:p-5">
    <div>
      <p className="mb-2 text-xs font-semibold text-muted">{video.codingLanguages?.length ? `Code shown: ${video.codingLanguages.map(studyLanguageLabel).join(" and ")}` : "Concept lesson · coding language not verified"}</p>
      <h3 id={`${id}-concept`} className="text-base font-semibold text-accent">Concept: {video.concept}</h3>
      <p className="mt-2 text-sm leading-7 text-muted">Video: {video.title}, by {video.channel}.</p>
    </div>
    <dl className="space-y-3 text-sm leading-7">
      <div><dt className="font-semibold">Example problem in the video</dt><dd className="mt-1 text-muted">{video.referenceProblem}</dd></div>
      <div><dt className="font-semibold">How it connects to this problem</dt><dd className="mt-1 whitespace-pre-wrap text-muted">{video.bridge}</dd></div>
    </dl>
    {video.segments.length > 0 && <div>
      <h4 id={`${id}-segments`} className="text-sm font-semibold">Where the core idea is explained</h4>
      <p className="mt-1 text-xs leading-6 text-muted">Chapters from the video&apos;s own description. Choose one to start the video there.</p>
      <ul aria-labelledby={`${id}-segments`} className="mt-3 flex flex-wrap gap-2">
        {video.segments.map((segment) => <li key={segment.startSeconds}>
          <button type="button" onClick={() => setStart(segment.startSeconds)}
            className="min-h-11 rounded-xl border border-line px-3 py-2 text-left text-sm text-muted transition-colors hover:border-accent hover:text-ink">
            <span className="font-mono text-accent">{formatTimestamp(segment.startSeconds)}&ndash;{formatTimestamp(segment.endSeconds)}</span> {segment.label}
          </button>
        </li>)}
      </ul>
    </div>}
    {loaded ? <div className="aspect-video w-full overflow-hidden rounded-xl border border-line bg-surface">
      <iframe key={start} className="h-full w-full" src={embedUrl(video.youtubeId, start, { autoplay: true })}
        title={`Video lesson: ${video.title} by ${video.channel}, about ${video.concept}`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div> : <div className="rounded-xl border border-dashed border-line p-4">
      <p className="text-xs leading-6 text-muted">Nothing is requested from YouTube until you load the player. It uses youtube-nocookie.com.</p>
      <Button className="mt-3" onClick={() => setStart(0)}>Load video player</Button>
    </div>}
    <p role="status" className="sr-only">{loaded ? `Video player loaded${start > 0 ? ` at ${formatTimestamp(start)}` : ""}.` : ""}</p>
    <a href={watchUrl(video.youtubeId, start ?? 0)} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-accent underline underline-offset-4">Watch on YouTube (opens in a new tab)</a>
  </article>;
}
