import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getMailgunDomain, parseDnsHealth } from "@/lib/mailgun/domains";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    await requireAuth();
    const { domainId } = await params;

    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const info = await getMailgunDomain(domain.domain);
    const health = parseDnsHealth(info);

    return NextResponse.json({
      ...health,
      sendingRecords: info.sending_dns_records,
      receivingRecords: info.receiving_dns_records,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
