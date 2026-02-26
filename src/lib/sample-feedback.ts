import type { FeedbackItem } from "./parse-feedback";

export const SAMPLE_EVIDENCE_TAG = "__koso_sample__";

export const SAMPLE_FEEDBACK_ITEMS: FeedbackItem[] = [
  {
    id: "sample-1",
    content:
      "We keep losing deals because prospects ask about SSO and we have to say it's on the roadmap. Three enterprise leads churned last quarter over this. Need SAML support ASAP.",
    title: "Enterprise SSO is blocking deals",
    isSample: true,
  },
  {
    id: "sample-2",
    content:
      "The onboarding flow is confusing — I signed up, connected my repo, and then had no idea what to do next. There was no guide or walkthrough. I almost gave up before finding the editor.",
    title: "New users lost after signup",
    isSample: true,
  },
  {
    id: "sample-3",
    content:
      "Love the product but the mobile experience is unusable. I often review specs on my phone during commutes and the text overflows, buttons are tiny, and the sidebar covers everything.",
    title: "Mobile experience is broken",
    isSample: true,
  },
  {
    id: "sample-4",
    content:
      "Would be great if I could export specs as PDF or share a read-only link with stakeholders who don't have accounts. Right now I'm copy-pasting into Google Docs which defeats the purpose.",
    title: "Need spec sharing and export",
    isSample: true,
  },
  {
    id: "sample-5",
    content:
      "The AI suggestions are hit or miss. Sometimes it nails the user story but other times it hallucinates features we never discussed. Would help to see which evidence it's drawing from.",
    title: "AI transparency and source attribution",
    isSample: true,
  },
];
