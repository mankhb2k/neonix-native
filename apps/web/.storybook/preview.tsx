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
      values: [
        { name: "dark", value: "#0F0F11" },
        { name: "light", value: "#FFFFFF" },
      ],
    },
  },
  decorators: [
    (Story, context) => {
      const selectedBg = context.globals.backgrounds?.value;
      const theme = selectedBg === "#FFFFFF" ? "light" : "dark";

      return (
        <div
          data-theme={theme}
          className={theme}
          style={{
            padding: "20px",
            background: "var(--bg)",
            color: "var(--fg)",
            borderRadius: "8px",
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
