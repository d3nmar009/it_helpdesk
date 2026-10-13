import { readFile, stat } from "node:fs/promises";
import path from "node:path";

// Next.js only serves `public/` files that existed when the server started, so attachments
// uploaded at runtime fall through to this handler until the next restart.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
};

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path ?? [];
  const filePath = path.resolve(UPLOAD_DIR, ...segments);

  if (!filePath.startsWith(UPLOAD_DIR + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new Response("Not found", { status: 404 });

    const data = await readFile(filePath);
    const contentType = IMAGE_TYPES[path.extname(filePath).toLowerCase()];

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType ?? "application/octet-stream",
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        ...(contentType ? {} : { "Content-Disposition": "attachment" }),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
