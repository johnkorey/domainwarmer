import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();
    const seeds = await prisma.seedAddress.findMany({
      orderBy: { createdAt: "desc" },
      include: { domain: { select: { domain: true } } },
    });
    return NextResponse.json(seeds);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const { emails, domainId, isInternal } = await request.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "At least one email address is required" },
        { status: 400 }
      );
    }

    const results = [];
    for (const email of emails) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes("@")) continue;

      try {
        const seed = await prisma.seedAddress.create({
          data: {
            email: trimmed,
            domainId: domainId || null,
            isInternal: isInternal || false,
          },
        });
        results.push(seed);
      } catch {
        // Skip duplicates
      }
    }

    return NextResponse.json({ created: results.length, seeds: results });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Seed ID is required" }, { status: 400 });
    }

    await prisma.seedAddress.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
