import "dotenv/config";
import mongoose from "mongoose";
import { PostModel } from "./models/Post.js";
import { parsePostDOM } from "./parse.js";
import { parsePostWithAI } from "./ai-parse.js";
import { startUploader } from "./uploader.js";
import { connectDB, flagPostAsIgnored, fetchWPPage } from "./utils.js";

async function runCronJob() {
  console.log(`[Cron] Starting scheduled sync job at ${new Date().toISOString()}`);
  await connectDB();

  // 1. Crawl the latest 5 pages (100 posts) to catch any edits or recent releases
  const MAX_PAGES = 5;
  let newOrUpdatedCount = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    console.log(`[Cron] Fetching Page ${page}...`);
    try {
      const rawPosts = await fetchWPPage(page, 20);
      
      if (!rawPosts || !Array.isArray(rawPosts) || rawPosts.length === 0) {
        break;
      }
      
      const bulkOps = rawPosts.map((p: any) => ({
        updateOne: {
          filter: { wpId: p.id },
          update: {
            $set: {
              title: p.title.rendered,
              slug: p.slug,
              link: p.link,
              date: new Date(p.date),
              modified: new Date(p.modified),
              content: p.content.rendered,
            }
          },
          upsert: true
        }
      }));

      const res = await PostModel.bulkWrite(bulkOps);
      console.log(`[Cron] Page ${page} synchronized: ${res.upsertedCount} new, ${res.modifiedCount} updated.`);
      
      newOrUpdatedCount += res.upsertedCount + res.modifiedCount;
      await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      console.error(`[Cron] Failed fetching page ${page}:`, e.message);
    }
  }
  
  // 2. Auto-parse any newly queued unparsed posts!
  const unparsedPosts = await PostModel.find({ isParsed: false, aiParsingRequired: { $ne: true } }).limit(20);
  console.log(`[Cron] Found ${unparsedPosts.length} unparsed posts in DB queue for this sync.`);
  
  for (const post of unparsedPosts) {
    if (await flagPostAsIgnored(post)) {
      continue;
    }

    const domData = parsePostDOM(post.title, post.content);
    if (domData && domData.torrentLinks.length > 0 && domData.description.length > 0) {
      post.parsedData = domData;
      post.isParsed = true;
      await post.save();
      console.log(`  -> [CRON: 0.00$] ${post.title.substring(0, 45)}...`);
    } else {
      post.aiParsingRequired = true;
      await post.save();
    }
  }
  
  // 3. Process AI Queue cleanly just in case
  const aiQueue = await PostModel.find({ isParsed: false, aiParsingRequired: true }).limit(5);
  for (const post of aiQueue) {
    console.log(`[Cron] Resolving Complex Post via AI: ${post.title.substring(0, 45)}...`);
    
    // Auto-ignore sticky placeholder
    if (await flagPostAsIgnored(post)) {
      continue;
    }
    
    const result = await parsePostWithAI(post.title, post.content);
    if (result && result.parsedData) {
      post.parsedData = result.parsedData;
      post.isParsed = true;
      post.aiParsingRequired = false;
      await post.save();
      console.log(`  -> [CRON: AI RESOLVED] Embedded into DB. Cost: $${result.cost.toFixed(6)}`);
    } else {
      console.log(`  -> [FAILED] Check AI API limits.`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // 4. Synchronize all results to Cloudflare R2
  await startUploader();
  
  await mongoose.disconnect();
  console.log(`[Cron] Job complete. ${newOrUpdatedCount} DB writes synced.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCronJob().catch(console.error);
}
