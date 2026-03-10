import { prisma } from "../prisma";
import { chatCompletion } from "./openrouter";
import { scrapeWebsite } from "./scraper";
import {
  businessSummaryPrompt,
  emailGenerationPrompt,
  replyGenerationPrompt,
  EMAIL_TONES,
  EMAIL_TOPICS,
} from "./prompts";
import { CONTENT_POOL_GENERATE } from "../constants";

function stripMarkdownJson(text: string): string {
  // Strip ```json ... ``` or ``` ... ``` wrappers
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  return match ? match[1].trim() : text.trim();
}

export async function generateBusinessSummary(
  domainName: string
): Promise<{ summary: string; keywords: string[] }> {
  const websiteText = await scrapeWebsite(domainName);

  if (!websiteText) {
    return {
      summary: `${domainName} is a business website. Unable to scrape specific details.`,
      keywords: [domainName.split(".")[0]],
    };
  }

  const response = await chatCompletion(
    [
      {
        role: "system",
        content:
          "You are a business analyst. Analyze websites and provide structured summaries. Always respond with valid JSON.",
      },
      {
        role: "user",
        content: businessSummaryPrompt(domainName, websiteText),
      },
    ],
    { temperature: 0.3, jsonMode: true }
  );

  try {
    const parsed = JSON.parse(stripMarkdownJson(response));
    return {
      summary: parsed.summary || `Business website at ${domainName}`,
      keywords: parsed.keywords || [domainName.split(".")[0]],
    };
  } catch {
    return {
      summary: `Business website at ${domainName}`,
      keywords: [domainName.split(".")[0]],
    };
  }
}

export async function generateEmailContent(
  domainId: string,
  count: number = CONTENT_POOL_GENERATE
): Promise<void> {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) throw new Error("Domain not found");

  const summary =
    domain.businessSummary || `Business website at ${domain.domain}`;

  for (let i = 0; i < count; i++) {
    const tone = EMAIL_TONES[Math.floor(Math.random() * EMAIL_TONES.length)];
    const topic = EMAIL_TOPICS[Math.floor(Math.random() * EMAIL_TOPICS.length)];

    try {
      const response = await chatCompletion(
        [
          {
            role: "system",
            content:
              "You are an email writer. Generate realistic business emails. Always respond with valid JSON containing 'subject' and 'body' fields.",
          },
          {
            role: "user",
            content: emailGenerationPrompt(domain.domain, summary, tone, topic),
          },
        ],
        { temperature: 0.9, jsonMode: true }
      );

      const parsed = JSON.parse(stripMarkdownJson(response));

      if (parsed.subject && parsed.body) {
        await prisma.generatedContent.create({
          data: {
            domainId,
            senderName: parsed.senderName || "Team",
            subject: parsed.subject,
            body: parsed.body,
            tone,
            topic,
          },
        });
      }
    } catch (err) {
      console.error(`Failed to generate email content #${i + 1}:`, err);
    }
  }
}

export async function generateReplyContent(
  originalSubject: string,
  originalBody: string,
  businessSummary: string
): Promise<{ subject: string; body: string } | null> {
  try {
    const response = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are replying to a business email naturally. Always respond with valid JSON containing 'subject' and 'body' fields.",
        },
        {
          role: "user",
          content: replyGenerationPrompt(
            originalSubject,
            originalBody,
            businessSummary
          ),
        },
      ],
      { temperature: 0.8, jsonMode: true }
    );

    const parsed = JSON.parse(stripMarkdownJson(response));
    if (parsed.subject && parsed.body) {
      return { subject: parsed.subject, body: parsed.body };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getAvailableContent(domainId: string) {
  return prisma.generatedContent.findFirst({
    where: { domainId, usedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

export async function markContentUsed(contentId: string) {
  return prisma.generatedContent.update({
    where: { id: contentId },
    data: { usedAt: new Date() },
  });
}

export async function getContentPoolSize(domainId: string): Promise<number> {
  return prisma.generatedContent.count({
    where: { domainId, usedAt: null },
  });
}
