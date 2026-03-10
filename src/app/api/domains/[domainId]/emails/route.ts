import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    await requireAuth();
    const { domainId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const status = searchParams.get("status");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { domainId };
    if (status) {
      where.status = status;
    }

    const [emails, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          fromAddress: true,
          toAddress: true,
          subject: true,
          status: true,
          isReply: true,
          sentAt: true,
          deliveredAt: true,
          openedAt: true,
          bouncedAt: true,
          complainedAt: true,
          failedAt: true,
          failureReason: true,
          shouldReply: true,
          replyScheduledAt: true,
        },
      }),
      prisma.emailLog.count({ where }),
    ]);

    return NextResponse.json({
      emails,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
