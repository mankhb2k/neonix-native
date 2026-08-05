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
      values: [
        { name: "light", value: "#F5F6F8" },
        { name: "dark", value: "#12110F" },
      ],
    },
  },
  decorators: [
    (Story, context) => {
      const selectedBg = context.globals.backgrounds?.value;
      const theme = selectedBg === "#12110F" ? "dark" : "light";

      return (
        <div
          data-theme={theme}
          className={theme}
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
      );
    },
  ],
};

export default preview;
