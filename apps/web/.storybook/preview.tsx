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
      default: "light",
      values: [{ name: "light", value: "#F5F6F8" }],
    },
  },
  decorators: [
    (Story) => (
      <div
        data-theme="light"
        style={{
          padding: "20px",
          background: "var(--bg-app)",
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
