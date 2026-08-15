import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:3000";

export default defineConfig(({ mode }) => ({
  // "mobile" mode serves over HTTPS on the LAN so a phone browser can use
  // the camera (getUserMedia requires a secure context — plain http:// on a
  // LAN IP won't work, only localhost or https:// do).
  plugins: [react(), ...(mode === "mobile" ? [basicSsl()] : [])],
  server: {
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
}));
