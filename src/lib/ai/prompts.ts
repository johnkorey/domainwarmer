export function businessSummaryPrompt(domain: string, websiteText: string): string {
  return `Analyze this website content for the domain "${domain}" and provide a concise business summary.

Website content:
${websiteText}

Return a JSON object with:
{
  "summary": "A 2-3 sentence description of what this business does, their products/services, and target audience",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "industry": "The industry this business operates in",
  "tone": "The general communication tone of the business (professional/casual/technical/friendly)"
}`;
}

export function emailGenerationPrompt(
  domain: string,
  businessSummary: string,
  tone: string,
  topic: string
): string {
  return `You are generating a realistic business email that would naturally be sent to or from someone at ${domain}.

Business context: ${businessSummary}

Requirements:
- Write in a ${tone} tone
- The email topic/scenario: ${topic}
- Make it sound like a real person writing a natural business email
- 3-8 sentences long
- Do NOT make it look like marketing, spam, or a template
- Include natural greetings and sign-offs
- Pick a realistic first name for the sender that fits the business context
- The sender name will be used as the "From" name and as part of the email address (e.g. "sarah@${domain}")
- The content should relate to what ${domain} actually does
- The subject line should feel natural and specific — avoid generic subjects

Return ONLY a JSON object:
{
  "senderName": "A realistic first name for the sender (e.g. Sarah, James, Michael)",
  "subject": "A natural, specific email subject line related to the business",
  "body": "The full email body text with proper line breaks (sign off with the sender's name)"
}`;
}

export function replyGenerationPrompt(
  originalSubject: string,
  originalBody: string,
  businessSummary: string
): string {
  return `You are replying to a business email. Write a natural, human reply.

Original email:
Subject: ${originalSubject}
Body: ${originalBody}

Business context: ${businessSummary}

Requirements:
- Reply naturally to the content of the original email
- 2-5 sentences
- Sound like a real person, not a bot
- Reference something specific from the original email
- Be conversational and genuine

Return ONLY a JSON object:
{
  "subject": "Re: ${originalSubject}",
  "body": "Your reply text here"
}`;
}

export const EMAIL_TONES = [
  "professional",
  "casual",
  "friendly",
  "enthusiastic",
  "formal",
] as const;

export const EMAIL_TOPICS = [
  "product inquiry about their services",
  "partnership or collaboration proposal",
  "follow-up from a previous conversation",
  "scheduling a meeting or call",
  "asking a question about their offerings",
  "providing feedback on a recent experience",
  "introducing yourself and your interest in their business",
  "requesting a quote or pricing information",
  "thanking them for their service",
  "discussing industry trends relevant to their business",
] as const;
