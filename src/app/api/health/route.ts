// Statischer Health-Endpunkt für Uptime-Monitoring (z. B. Cloudflare).
// Bewusst force-static: Die App ist vollständig clientseitig, auch der
// Health-Check braucht keinen Server und überlebt jeden statischen Export.
export const dynamic = "force-static";

export async function GET() {
  return Response.json({ ok: true, app: "MaßWerk" });
}
