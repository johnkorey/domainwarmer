import { NextRequest, NextResponse } from "next/server";
import { processWebmailEngagement } from "@/lib/webmail/engagement-engine";

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await processWebmailEngagement();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webmail engagement cron error:", err);
    return NextResponse.json(
      { error: "Engagement processing failed" },
      { status: 500 }
    );
  }
}
