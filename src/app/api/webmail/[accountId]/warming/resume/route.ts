import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    await requireAuth();
    const { accountId } = await params;

    await prisma.webmailAccount.update({
      where: { id: accountId },
      data: {
        warmingStatus: "WARMING",
        pausedAt: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
