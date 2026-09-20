import type { NextConfig } from "next";

// MaßWerk ist vollständig clientseitig (Messen, Rechnen, Export laufen im
// Browser). Der statische Export erzeugt ein reines Asset-Bundle in `out/`
// und lässt sich damit direkt auf statischem Hosting betreiben –
// z. B. Cloudflare Pages (`npm run build` → Verzeichnis `out/` deployen).
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
