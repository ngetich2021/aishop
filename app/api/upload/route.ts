import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret)
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const timestamp = Math.floor(Date.now() / 1000);
  const toSign    = `timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");

  const upload = new FormData();
  upload.append("file",      file);
  upload.append("api_key",   apiKey);
  upload.append("timestamp", String(timestamp));
  upload.append("signature", signature);

  try {
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: upload });
    const data = await res.json() as { secure_url?: string; error?: { message: string } };
    if (!res.ok || data.error) return NextResponse.json({ error: data.error?.message ?? "Upload failed" }, { status: 500 });
    return NextResponse.json({ url: data.secure_url });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
