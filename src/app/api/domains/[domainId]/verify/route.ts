import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { verifyMailgunDomain, parseDnsHealth } from "@/lib/mailgun/domains";

export async function POST(
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

    const info = await verifyMailgunDomain(domain.domain);
    const health = parseDnsHealth(info);

    const updatedDomain = await prisma.domain.update({
      where: { id: domainId },
      data: {
        spfValid: health.spfValid,
        dkimValid: health.dkimValid,
        dmarcValid: health.dmarcValid,
        mxValid: health.mxValid,
        isVerified: health.isVerified,
        status: health.isVerified ? "ACTIVE" : "VERIFYING",
      },
    });

    return NextResponse.json({
      domain: updatedDomain,
      dnsRecords: {
        sending: health.sendingRecords,
        receiving: health.receivingRecords,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
