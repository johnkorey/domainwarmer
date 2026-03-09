import { NextRequest, NextResponse } from "next/server";
import { processWarmingBatch } from "@/lib/warming/engine";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await processWarmingBatch();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Warming cron error:", err);
    return NextResponse.json({ error: "Warming batch failed" }, { status: 500 });
  }
}
