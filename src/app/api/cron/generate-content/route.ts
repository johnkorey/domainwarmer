import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateEmailContent,
  getContentPoolSize,
} from "@/lib/ai/content-generator";
import { CONTENT_POOL_MIN, CONTENT_POOL_GENERATE } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const domains = await prisma.domain.findMany({
      where: { warmingStatus: "WARMING" },
    });

    let generated = 0;

    for (const domain of domains) {
      const poolSize = await getContentPoolSize(domain.id);
      if (poolSize < CONTENT_POOL_MIN) {
        await generateEmailContent(domain.id, CONTENT_POOL_GENERATE);
        generated++;
      }
    }

    return NextResponse.json({
      success: true,
      domainsRefilled: generated,
    });
  } catch (err) {
    console.error("Content generation cron error:", err);
    return NextResponse.json(
      { error: "Content generation failed" },
      { status: 500 }
    );
  }
}
