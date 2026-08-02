import type { Preview } from "@storybook/react-vite";
import "../gui/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "#0e0e10" },
        { name: "panel", value: "#1b1b1a" },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-[120px] min-w-[280px] p-5 text-[var(--fg-primary)]">
        <Story />
      </div>
    ),
  ],
};

export default preview;
