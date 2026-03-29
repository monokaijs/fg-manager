import "dotenv/config";
import mongoose from "mongoose";
import { PostModel } from "./models/Post.js";
import { connectDB, fetchWPPage } from "./utils.js";

async function crawler() {
  console.log("Connecting to MongoDB...");
  await connectDB();
  console.log("Connected to DB:", mongoose.connection.name);

  let page = 1;
  const perPage = 20; // 20 per request is safer for API proxies
  let totalSaved = 0;

  console.log("Starting historical traversal in chronological rollback. Hit Ctrl+C to stop.");
  
  while (true) {
    try {
      console.log(`[Crawler] Fetching Page ${page}...`);
      const rawPosts = await fetchWPPage(page, perPage);

      // Protect against CodeTabs returning a JSON error dictionary instead of an array on HTTP 200
      if (!rawPosts || !Array.isArray(rawPosts) || rawPosts.length === 0) {
        console.log(`[Crawler] No more posts found at page ${page} (Array empty or invalid). Finalizing...`);
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
      console.log(`[DB] Page ${page} synchronized: ${res.upsertedCount} new, ${res.modifiedCount} updated.`);
      
      totalSaved += rawPosts.length;
      page++;
      
      // Artificial delay to prevent aggressive bot blocks
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      if (error?.response?.status === 400 || (error.message && error.message.includes("400"))) {
        console.log(`[Crawler] Reached end of pagination (400) at page ${page}.`);
        break;
      }
      console.error(`[Error] Fetching page ${page} failed:`, error.message);
      console.log("Retrying in 5 seconds...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`\nFinished historical crawl. Total posts verified/saved: ${totalSaved}`);
  await mongoose.disconnect();
}

// Running the historical crawler
if (import.meta.url === `file://${process.argv[1]}`) {
  crawler().catch(console.error);
}
