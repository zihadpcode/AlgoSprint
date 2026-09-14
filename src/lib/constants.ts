// Public display content only. Never import secrets into this module.
export const APP_CONFIG = {
  name: "AlgoSprint",
  tagline: "Practice with purpose",
  description:
    "An early preview of AlgoSprint: an original coding interview preparation platform built around deliberate practice and clear explanations.",
} as const;

// These links point to real sections on the current landing page.
export const LANDING_NAV = [
  { label: "The approach", href: "#approach" },
  { label: "Practice preview", href: "#practice-preview" },
  { label: "What's next", href: "#path-ahead" },
] as const;

export const PRACTICE_STEPS = [
  {
    number: "01",
    title: "Find the question inside the question.",
    description:
      "Start with the inputs, the constraints, and a small example. Understand what a correct answer needs to do.",
  },
  {
    number: "02",
    title: "Build an approach you can explain.",
    description:
      "Write down a first solution. Trace it by hand, spot repeated work, and look for a pattern that makes it simpler.",
  },
  {
    number: "03",
    title: "Carry the lesson forward.",
    description:
      "Check edge cases, explain the tradeoffs, and revisit what challenged you. Make the next unfamiliar problem feel more familiar.",
  },
] as const;

export const PLANNED_FEATURES = [
  {
    id: "collection",
    title: "An original problem collection",
    description:
      "Browse five carefully checked challenges by topic and available time. Guided problem pages are the next step.",
    label: "Available · problem library",
  },
  {
    id: "progress",
    title: "A record of how you learn",
    description:
      "Keep notes, revisit tricky questions, and see which topics deserve another practice session.",
    label: "Planned · notes and progress",
  },
  {
    id: "preparation",
    title: "Preparation with direction",
    description:
      "Follow original learning paths and, later, put your reasoning into words in timed interview practice.",
    label: "Planned · roadmaps and interviews",
  },
] as const;
