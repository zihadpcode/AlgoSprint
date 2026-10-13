"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { embedUrl, formatTimestamp, watchUrl } from "@/lib/youtube";
import type { ProblemDetail } from "@/features/problems/detail-query";

type Video = ProblemDetail["videos"][number];

// The framing is deliberately fixed text, not data: a video is a lesson on a concept, never a walkthrough of this problem.
export const VIDEO_FRAMING = "These videos teach the underlying concept using a different example problem. They are not a walkthrough of this problem, so use the bridge notes to connect the idea back to it.";

export function VideoLesson({ videos }: { videos: Video[] }) {
  if (!videos.length) return null;
  return <div>
    <p className="mt-3 text-sm leading-7 text-muted">{VIDEO_FRAMING}</p>
    <details className="mt-4">
      <summary className="cursor-pointer rounded-xl border border-line p-4 font-semibold text-accent">Reveal {videos.length === 1 ? "the video lesson" : "video lessons"}</summary>
      <p className="my-5 text-sm leading-7 text-muted">The concept and the bridge can hint at the approach. Try the hints first if you want to find the idea yourself.</p>
      <ul className="space-y-8">
        {videos.map((video) => <li key={video.youtubeId}><VideoItem video={video} /></li>)}
      </ul>
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
