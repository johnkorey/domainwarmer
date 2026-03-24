import { Resolver } from "dns/promises";
import { chatCompletion } from "./openrouter";

// Use Google public DNS instead of system resolver (system DNS fails on some servers)
const resolver = new Resolver();
resolver.setServers(["8.8.8.8", "8.8.4.4"]);

export interface DomainAnalysis {
  domain: string;
  score: number;
  checks: {
    mx: { found: boolean; records: string[] };
    spf: { found: boolean; record: string | null };
    dmarc: { found: boolean; record: string | null };
    website: { reachable: boolean };
  };
  recommendations: string[];
  summary: string;
}

async function checkMx(domain: string): Promise<{ found: boolean; records: string[] }> {
  try {
    const records = await resolver.resolveMx(domain);
    return {
      found: records.length > 0,
      records: records.sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority).map((r: { exchange: string }) => r.exchange),
    };
  } catch {
    return { found: false, records: [] };
  }
}

async function checkSpf(domain: string): Promise<{ found: boolean; record: string | null }> {
  try {
    const records = await resolver.resolveTxt(domain);
    const spf = records.flat().find((r) => r.startsWith("v=spf1"));
    return { found: !!spf, record: spf || null };
  } catch {
    return { found: false, record: null };
  }
}

async function checkDmarc(domain: string): Promise<{ found: boolean; record: string | null }> {
  try {
    const records = await resolver.resolveTxt(`_dmarc.${domain}`);
    const dmarc = records.flat().find((r) => r.startsWith("v=DMARC1"));
    return { found: !!dmarc, record: dmarc || null };
  } catch {
    return { found: false, record: null };
  }
}

async function checkWebsite(domain: string): Promise<boolean> {
  for (const url of [`https://${domain}`, `http://${domain}`]) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        signal: controller.signal,
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; DomainWarmer/1.0)" },
      });
      clearTimeout(timeout);
      if (res.ok || res.status < 500) return true;
    } catch {
      continue;
    }
  }
  return false;
}

export async function analyzeDomain(domain: string): Promise<DomainAnalysis> {
  // Run all checks in parallel
  const [mx, spf, dmarc, websiteReachable] = await Promise.all([
    checkMx(domain),
    checkSpf(domain),
    checkDmarc(domain),
    checkWebsite(domain),
  ]);

  // Calculate score
  let score = 0;
  const recommendations: string[] = [];

  if (mx.found) {
    score += 25;
  } else {
    recommendations.push("No MX records found — email delivery will fail. Configure MX records for your domain.");
  }

  if (spf.found) {
    score += 25;
  } else {
    recommendations.push("No SPF record found — ISPs may mark emails as suspicious. Add an SPF TXT record.");
  }

  if (dmarc.found) {
    score += 20;
  } else {
    recommendations.push("No DMARC record found — add a DMARC policy to improve deliverability and protect against spoofing.");
  }

  if (websiteReachable) {
    score += 15;
  } else {
    recommendations.push("Website is not reachable — having a live website builds domain credibility with ISPs.");
  }

  // Base score for existing domain with email configured
  if (mx.found) {
    score += 15;
  }

  score = Math.min(100, Math.max(0, score));

  // Generate AI summary
  let summary = "";
  try {
    summary = await generateAnalysisSummary(domain, { mx, spf, dmarc, websiteReachable }, score, recommendations);
  } catch {
    summary = buildFallbackSummary(domain, score, mx.found, spf.found, dmarc.found, websiteReachable);
  }

  return {
    domain,
    score,
    checks: {
      mx,
      spf,
      dmarc,
      website: { reachable: websiteReachable },
    },
    recommendations,
    summary,
  };
}

async function generateAnalysisSummary(
  domain: string,
  checks: { mx: { found: boolean; records: string[] }; spf: { found: boolean; record: string | null }; dmarc: { found: boolean; record: string | null }; websiteReachable: boolean },
  score: number,
  recommendations: string[]
): Promise<string> {
  const response = await chatCompletion(
    [
      {
        role: "system",
        content: "You are an email deliverability expert. Provide a concise 2-3 sentence analysis of domain readiness for email warming. Be direct and actionable.",
      },
      {
        role: "user",
        content: `Analyze domain "${domain}" for email warming readiness:

Score: ${score}/100
MX Records: ${checks.mx.found ? `Yes (${checks.mx.records.join(", ")})` : "None"}
SPF: ${checks.spf.found ? checks.spf.record : "Not configured"}
DMARC: ${checks.dmarc.found ? checks.dmarc.record : "Not configured"}
Website: ${checks.websiteReachable ? "Reachable" : "Not reachable"}

${recommendations.length > 0 ? `Issues: ${recommendations.join("; ")}` : "All checks passed."}

Give a brief assessment of this domain's readiness for email warming and cold outreach. Focus on what matters most.`,
      },
    ],
    { temperature: 0.3 }
  );

  return response.trim();
}

function buildFallbackSummary(
  domain: string,
  score: number,
  hasMx: boolean,
  hasSpf: boolean,
  hasDmarc: boolean,
  hasWebsite: boolean
): string {
  const parts: string[] = [];

  if (score >= 80) {
    parts.push(`${domain} has strong email infrastructure.`);
  } else if (score >= 50) {
    parts.push(`${domain} has basic email setup but needs improvements.`);
  } else {
    parts.push(`${domain} has significant email configuration gaps.`);
  }

  if (!hasMx) parts.push("Critical: No MX records detected.");
  if (!hasSpf) parts.push("Missing SPF record.");
  if (!hasDmarc) parts.push("Missing DMARC record.");
  if (!hasWebsite) parts.push("No active website detected.");

  if (hasMx && hasSpf && hasDmarc && hasWebsite) {
    parts.push("All DNS records are properly configured — ready to begin warming.");
  }

  return parts.join(" ");
}
