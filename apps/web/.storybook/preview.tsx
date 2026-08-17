import React from "react";
import type { Preview } from "@storybook/react";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "dark",
      values: [{ name: "dark", value: "#0a0a0f" }],
    },
  },
  decorators: [
    (Story) => (
      <div
        data-theme="dark"
        style={{
          padding: "20px",
          background: "var(--bg-site)",
          color: "var(--fg-primary)",
          borderRadius: "12px",
          minHeight: "100px",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
