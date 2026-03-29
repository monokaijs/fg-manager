import "dotenv/config";
import mongoose from "mongoose";
import { OpenAI } from "openai";
import { PostModel } from "./models/Post.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy",
  baseURL: process.env.OPENAI_BASE_URL,
});

const COST_PER_1M_INPUT = 0.20;
const COST_PER_1M_OUTPUT = 1.25;

let totalSessionCost = 0;

export async function parsePostWithAI(postTitle: string, htmlContent: string) {
  // Minimize token costs by stripping HTML
  const cleanContent = htmlContent
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: `You are a professional web scraper/parser.
Extract specific game and repack data from the provided HTML payload and structure it strictly into the following JSON format:

{
  "title": "Clean title",
  "description": "Game lore/summary description. Not the release notes.",
  "postImage": "Cover image URL (or empty string)",
  "screenshotImages": ["URL 1", "URL 2"],
  "downloadCollections": [
    { "host": "FuckingFast", "urls": ["url 1", "url 2"] },
    { "host": "DataNodes", "urls": ["url 1", "url 2"] }
  ],
  "torrentLinks": [
    { "type": "magnet", "url": "magnet:..." },
    { "type": "torrent_file", "url": "..." }
  ],
  "features": ["Repack size", "Languages", "Original size", "etc"],
  "updateLog": ["Patch notes"],
  "additionalNotes": "Any extra notes"
}

RULES:
- Respond ONLY with valid JSON inside a standard markdown code block (i.e. \`\`\`json { ... } \`\`\`). Do not add any conversational text.
- If it's a digest or multi-game post, try to compile an overarching "Digest" metadata or grab the first game. You can mark "ignored": true in the root JSON if it's purely a site update and contains zero game downloads.
- Ensure all magnets use 'magnet' type, and direct torrent URLs use 'torrent_file' type.`
        },
        {
          role: "user",
          content: `Title: ${postTitle}\n\nContent:\n${cleanContent}`
        }
      ]
    });

    const text = completion.choices[0].message.content || "{}";
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    const parsedData = JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : "{}");

    const usage = completion.usage;
    let cost = 0;
    if (usage) {
      const inputCost = (usage.prompt_tokens / 1_000_000) * COST_PER_1M_INPUT;
      const outputCost = (usage.completion_tokens / 1_000_000) * COST_PER_1M_OUTPUT;
      cost = inputCost + outputCost;
      totalSessionCost += cost;
    }
    
    if (!parsedData.downloadCollections) parsedData.downloadCollections = [];
    if (!parsedData.torrentLinks) parsedData.torrentLinks = [];
    parsedData.additionalNotes = parsedData.additionalNotes ? parsedData.additionalNotes + " | Parsed with AI Fallback" : "Parsed with AI Fallback";

    return { parsedData, cost, usage };
  } catch (error: any) {
    console.error(`AI Parsing Error for ${postTitle}:`, error.message);
    return null;
  }
}

import { connectDB, flagPostAsIgnored } from "./utils.js";

async function aiParserRunner() {
  console.log("Connecting to MongoDB...");
  await connectDB();
  
  // Scans for posts that specifically failed DOM validation flag
  const aiQueue = await PostModel.find({ isParsed: false, aiParsingRequired: true });
  console.log(`Found ${aiQueue.length} complex/malformed posts waiting for AI Resolution.`);

  const CONCURRENCY = 20;

  for (let i = 0; i < aiQueue.length; i += CONCURRENCY) {
    const batch = aiQueue.slice(i, i + CONCURRENCY);
    console.log(`\n[Batch ${Math.floor(i/CONCURRENCY) + 1}] Processing posts ${i + 1} to ${Math.min(i + CONCURRENCY, aiQueue.length)} in parallel...`);

    const promises = batch.map(async (post) => {
      if (await flagPostAsIgnored(post)) {
        console.log(`  -> [IGNORED] ${post.title.substring(0, 40)}...`);
        return;
      }

      const result = await parsePostWithAI(post.title, post.content);
      
      if (result && result.parsedData) {
        post.parsedData = result.parsedData;
        post.isParsed = true;
        // Strip flag
        post.aiParsingRequired = false;
        await post.save();
        console.log(`  -> [AI RESOLVED] ${post.title.substring(0, 45)}... | Cost: $${result.cost.toFixed(6)} | Tokens: ${result.usage?.total_tokens}`);
      } else {
        console.log(`  -> [AI FAILED AGAIN] ${post.title.substring(0, 45)}...`);
      }
    });

    await Promise.all(promises);
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n======================================`);
  console.log(`AI Queue execution finished.`);
  console.log(`Total Session AI Cost: $${totalSessionCost.toFixed(6)}`);
  console.log(`======================================\n`);
  
  await mongoose.disconnect();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  aiParserRunner().catch(console.error);
}
