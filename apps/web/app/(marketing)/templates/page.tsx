import { TemplatesGallery } from "./_components/TemplatesGallery";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Templates",
  description:
    "Starting points for Neonix — fully-editable HTML/CSS scenes you can open in the playground and change anything in, not fill-in-the-blank templates.",
  alternates: { canonical: "/templates" },
};

const TEMPLATE_ITEMS = [
  {
    id: "product-launch",
    title: "Product launch teaser",
    category: "Marketing",
    description: "A title card, feature callouts, and a closing CTA — timed for a short teaser.",
    accent: "from-cyan-400/25 via-slate-900 to-violet-500/20",
    ratio: "16/9",
  },
  {
    id: "brand-intro",
    title: "Brand intro",
    category: "Brand",
    description: "Logo reveal, tagline, and an accent sweep — a clean open for any video.",
    accent: "from-amber-300/20 via-slate-900 to-cyan-500/15",
    ratio: "1/1",
  },
  {
    id: "stat-highlight",
    title: "Stat highlight",
    category: "Data",
    description: "One big number, a supporting label, and a subtle counting animation.",
    accent: "from-violet-400/25 via-slate-900 to-fuchsia-500/15",
    ratio: "4/5",
  },
  {
    id: "event-countdown",
    title: "Event countdown",
    category: "Events",
    description: "A live countdown layout with date, location, and an RSVP overlay.",
    accent: "from-cyan-300/20 via-slate-900 to-slate-900",
    ratio: "9/16",
  },
  {
    id: "timeline-story",
    title: "Timeline story",
    category: "Storytelling",
    description: "A scrolling sequence of dated chapters — built the same way as Neonix's own demo project.",
    accent: "from-rose-400/20 via-slate-900 to-amber-500/15",
    ratio: "21/9",
  },
  {
    id: "social-caption",
    title: "Social caption card",
    category: "Social",
    description: "A caption-style overlay with animated emphasis words, sized for vertical video.",
    accent: "from-emerald-400/20 via-slate-900 to-cyan-500/15",
    ratio: "9/16",
  },
  {
    id: "ui-showcase",
    title: "UI kit showcase",
    category: "Design",
    description: "Panels, buttons, and form fields sliding into place — good for a product walkthrough.",
    accent: "from-sky-400/20 via-slate-900 to-indigo-500/20",
    ratio: "4/3",
  },
  {
    id: "price-comparison",
    title: "Pricing comparison",
    category: "Marketing",
    description: "Two or three plan cards animating in side by side, with the recommended plan highlighted.",
    accent: "from-fuchsia-400/20 via-slate-900 to-blue-500/15",
    ratio: "1/1",
  },
  {
    id: "quote-carousel",
    title: "Quote carousel",
    category: "Social proof",
    description: "Rotating customer quotes with an avatar, name, and subtle background drift.",
    accent: "from-orange-300/20 via-slate-900 to-rose-500/15",
    ratio: "3/4",
  },
  {
    id: "map-route",
    title: "Map route reveal",
    category: "Travel",
    description: "An animated route line drawing across a stylized map toward a destination pin.",
    accent: "from-lime-300/20 via-slate-900 to-emerald-500/15",
    ratio: "16/9",
  },
  {
    id: "app-walkthrough",
    title: "App walkthrough",
    category: "Product",
    description: "A phone frame stepping through three screens with swipe transitions.",
    accent: "from-indigo-400/20 via-slate-900 to-cyan-400/15",
    ratio: "9/16",
  },
  {
    id: "recipe-steps",
    title: "Recipe steps",
    category: "Food",
    description: "Numbered ingredient and step cards animating in sequence over a soft background.",
    accent: "from-amber-400/20 via-slate-900 to-rose-400/15",
    ratio: "4/5",
  },
  {
    id: "podcast-clip",
    title: "Podcast audiogram",
    category: "Audio",
    description: "A waveform pulse synced to audio, with the episode title and host name.",
    accent: "from-violet-300/20 via-slate-900 to-slate-900",
    ratio: "1/1",
  },
  {
    id: "real-estate-tour",
    title: "Real estate tour",
    category: "Real estate",
    description: "Listing photos crossfading with price, address, and key details overlaid.",
    accent: "from-teal-300/20 via-slate-900 to-amber-400/15",
    ratio: "21/9",
  },
  {
    id: "hiring-announcement",
    title: "We're hiring",
    category: "Recruiting",
    description: "A role title, a few perks, and an apply-now CTA — built for a careers post.",
    accent: "from-cyan-400/20 via-slate-900 to-fuchsia-400/15",
    ratio: "4/3",
  },
  {
    id: "milestone-counter",
    title: "Milestone counter",
    category: "Data",
    description: "A counting number ticking up to a milestone, with a short supporting line.",
    accent: "from-rose-300/20 via-slate-900 to-violet-500/15",
    ratio: "3/4",
  },
  {
    id: "weather-forecast",
    title: "Weather forecast",
    category: "Data",
    description: "A five-day forecast strip with animated icons and temperature ticks.",
    accent: "from-sky-300/20 via-slate-900 to-blue-600/15",
    ratio: "16/9",
  },
] as const;

export default function TemplatesPage() {
  return (
    <main className="bg-[var(--bg-site)] text-[var(--fg-primary)]">
      <TemplatesGallery items={TEMPLATE_ITEMS} />
    </main>
  );
}
