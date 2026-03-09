import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createMailgunDomain, parseDnsHealth } from "@/lib/mailgun/domains";
import { generateBusinessSummary } from "@/lib/ai/content-generator";

export async function GET() {
  try {
    await requireAuth();
    const domains = await prisma.domain.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { emailLogs: true, seedAddresses: true },
        },
      },
    });
    return NextResponse.json(domains);
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
    const { domain: domainName } = await request.json();

    if (!domainName) {
      return NextResponse.json(
        { error: "Domain name is required" },
        { status: 400 }
      );
    }

    // Check if domain already exists
    const existing = await prisma.domain.findUnique({
      where: { domain: domainName },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Domain already exists" },
        { status: 409 }
      );
    }

    // Create domain in Mailgun
    let mailgunInfo;
    try {
      mailgunInfo = await createMailgunDomain(domainName);
    } catch (err) {
      return NextResponse.json(
        {
          error: `Failed to create domain in Mailgun: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
        { status: 400 }
      );
    }

    const dnsHealth = parseDnsHealth(mailgunInfo);

    // Create domain in database
    const domain = await prisma.domain.create({
      data: {
        domain: domainName,
        status: "VERIFYING",
        spfValid: dnsHealth.spfValid,
        dkimValid: dnsHealth.dkimValid,
        dmarcValid: dnsHealth.dmarcValid,
        mxValid: dnsHealth.mxValid,
        isVerified: dnsHealth.isVerified,
      },
    });

    // Trigger async business summary generation
    generateBusinessSummary(domainName)
      .then(async ({ summary, keywords }) => {
        await prisma.domain.update({
          where: { id: domain.id },
          data: { businessSummary: summary, businessKeywords: keywords },
        });
      })
      .catch((err) =>
        console.error(`Failed to generate business summary for ${domainName}:`, err)
      );

    return NextResponse.json({
      domain,
      dnsRecords: {
        sending: mailgunInfo.sending_dns_records,
        receiving: mailgunInfo.receiving_dns_records,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create domain error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
