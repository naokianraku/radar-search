import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // mode: "github" のときだけ GitHub Pages 用の base を使う
  const base = mode === "github" ? "/radar-search/" : "/";

  return {
    plugins: [react()],
    base,
  };
});