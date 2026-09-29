import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";

import "../packages/ui/src/tokens.css";
import "./storybook.css";

// Light / dark from the toolbar, applied the way the apps do it: a class on <html>. Every story sits dead
// centre in its canvas, for focus. Wide ones (tables, boards, token grids) set `parameters.fill` and get a
// full-width column that is itself centred.
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === "dark" ? "dark" : "light";
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);
  const fill = context.parameters.fill === true;
  // App shells (the sidebar) own the whole canvas.
  if (context.parameters.shell === true) return <div className="h-screen bg-background text-foreground"><Story /></div>;
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-8 text-foreground">
      <div className={fill ? "w-full max-w-6xl" : "flex w-full max-w-6xl justify-center"}>
        <Story />
      </div>
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Colour theme",
      toolbar: { title: "Theme", icon: "mirror", items: [{ value: "light", title: "Light" }, { value: "dark", title: "Dark" }], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
    // Accessibility checks run on every story. "todo" reports without failing while the two contrast
    // questions in principles.md are open; switch to "error" once they're settled.
    a11y: { test: "todo" },
    options: { storySort: { order: ["Principles", "Tokens", "Primitives", "Product"] } },
  },
};
export default preview;
