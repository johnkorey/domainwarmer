import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMailgunDomain, parseDnsHealth } from "@/lib/mailgun/domains";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const domains = await prisma.domain.findMany({
      where: { status: { in: ["VERIFYING", "ACTIVE"] } },
    });

    for (const domain of domains) {
      try {
        const info = await getMailgunDomain(domain.domain);
        const health = parseDnsHealth(info);

        await prisma.domain.update({
          where: { id: domain.id },
          data: {
            spfValid: health.spfValid,
            dkimValid: health.dkimValid,
            dmarcValid: health.dmarcValid,
            mxValid: health.mxValid,
            isVerified: health.isVerified,
            status: health.isVerified ? "ACTIVE" : domain.status,
          },
        });
      } catch (err) {
        console.error(`DNS check failed for ${domain.domain}:`, err);
      }
    }

    return NextResponse.json({ success: true, checked: domains.length });
  } catch (err) {
    console.error("DNS check cron error:", err);
    return NextResponse.json({ error: "DNS check failed" }, { status: 500 });
  }
}
