import { existsSync } from "node:fs";
import { join } from "node:path";
import Experience from "@/components/Experience";
import { AUDIO, TEXTURES } from "@/lib/invitation.config";

// Resolve which optional textures / sounds were dropped into /public
// so the client only loads files that actually exist.
export default function Page() {
  const candidates = [...Object.values(TEXTURES), ...Object.values(AUDIO)];
  const available = candidates.filter((p) => existsSync(join(process.cwd(), "public", p)));
  return <Experience available={available} />;
}
