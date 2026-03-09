import { convert } from "html-to-text";

export async function scrapeWebsite(domain: string): Promise<string> {
  const urls = [
    `https://${domain}`,
    `https://www.${domain}`,
    `http://${domain}`,
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; DomainWarmer/1.0; +https://domainwarmer.local)",
        },
      });

      clearTimeout(timeout);

      if (!res.ok) continue;

      const html = await res.text();
      const text = convert(html, {
        wordwrap: false,
        selectors: [
          { selector: "script", format: "skip" },
          { selector: "style", format: "skip" },
          { selector: "nav", format: "skip" },
          { selector: "footer", format: "skip" },
          { selector: "img", format: "skip" },
          { selector: "a", options: { ignoreHref: true } },
        ],
      });

      // Clean up and truncate
      const cleaned = text
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 4000);

      return cleaned;
    } catch {
      continue;
    }
  }

  return "";
}
