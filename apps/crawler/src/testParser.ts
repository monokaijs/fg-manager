import "dotenv/config";
import mongoose from "mongoose";
import { PostModel } from "./models/Post.js";
import { parsePostDOM } from "./parse.js";
import * as cheerio from "cheerio";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fg-manager";

async function run() {
  await mongoose.connect(MONGODB_URI);
  
  // Get 5 sample posts natively bypassing Digests
  const posts = await PostModel.aggregate([
    { $match: { $and: [{ title: { $not: /Updates Digest/i } }, { title: { $not: /Upcoming Repacks/i } }] } },
    { $sample: { size: 5 } }
  ]);
  
  for (const post of posts) {
    console.log(`\n\n======================================================`);
    console.log(`[TESTING] ${post.title}`);
    console.log(`======================================================`);
    
    // Call the fast-path parser directly
    const data = parsePostDOM(post.title, post.content);
    
    if (!data) {
       console.log(`\n=> FATAL PARSE FAILURE (Force AI Fallback)`);
       continue;
    }
    
    console.log(`\n[COVER IMAGE]: ${data.postImage ? "FOUND -> " + data.postImage : "FAILED"}`);
    
    console.log(`\n[SCREENSHOTS] (${data.screenshotImages.length}):`);
    data.screenshotImages.slice(0, 3).forEach((s: string) => console.log(`  - ${s}`));
    if (data.screenshotImages.length > 3) console.log(`  ... and ${data.screenshotImages.length - 3} more`);
    
    console.log(`\n[TORRENT LINKS] (${data.torrentLinks.length}):`);
    data.torrentLinks.forEach((t: any) => console.log(`  - [${t.type}] ${t.url.substring(0, 80)}...`));
    
    console.log(`\n[DOWNLOAD COLLECTIONS] (${data.downloadCollections.length}):`);
    data.downloadCollections.forEach((c: any) => {
       console.log(`  - Host: ${c.host} | Links: ${c.urls.length}`);
    });
    
    const $ = cheerio.load(post.content);
    console.log(`\n[DEBUG MIRROR HEADER]:`, $.html().substring($.html().indexOf('Download Mirrors') - 50, $.html().indexOf('Download Mirrors') + 200));
    
    console.log(`\n[FEATURES] (${data.features.length} lines):`);
    data.features.slice(0, 3).forEach((f: string) => console.log(`  - ${f.substring(0, 80)}...`));
    if (data.features.length > 3) console.log(`  ... and ${data.features.length - 3} more`);
    
  }
  
  await mongoose.disconnect();
}
run();
