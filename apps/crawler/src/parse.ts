import "dotenv/config";
import mongoose from "mongoose";
import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { PostModel } from "./models/Post.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy",
  baseURL: process.env.OPENAI_BASE_URL,
});

// GPT-5-nano pricing based on 2026 specs
const COST_PER_1M_INPUT = 0.20;
const COST_PER_1M_OUTPUT = 1.25;

let totalSessionCost = 0;

import * as cheerio from "cheerio";

// Pure DOM Parser (Cheerio)
export function parsePostDOM(postTitle: string, htmlContent: string) {
  const $ = cheerio.load(htmlContent);
  
  // 1. Title is already given
  const title = postTitle;
  
  // 2. Cover Image
  const postImage = $('img').first().attr('src') || "";
  
  // 3. Screenshots
  const screenshotImages: string[] = [];
  $('img').slice(1).each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.includes('pixel.wp.com')) {
      screenshotImages.push(src);
    }
  });

  // 4. Torrent Links
  const torrentLinks: any[] = [];
  $('a[href^="magnet:"]').each((_, el) => {
    torrentLinks.push({ type: "magnet", url: $(el).attr('href') });
  });
  
  $('a').each((_, el) => {
    const text = $(el).text().toLowerCase();
    const href = $(el).attr('href');
    if (href && !href.startsWith('magnet:') && !href.endsWith('.com/') && href.length > 5) {
      if (href.endsWith('.torrent') || text.includes("torrent") || text.includes("rutor") || text.includes("tapochek")) {
        if (!torrentLinks.find(t => t.url === href)) {
          torrentLinks.push({ type: "torrent_file", url: href });
        }
      }
    }
  });

  // 5. Download Collections
  const downloadCollections: any[] = [];
  let mirrorsUl: cheerio.Cheerio | null = null;
  $('h3, p').each((_, el) => {
    if ($(el).text().includes("Download Mirrors")) {
      mirrorsUl = $(el).nextAll('ul').first();
    }
  });

  if (mirrorsUl) {
    mirrorsUl.find('li').each((_, el) => {
      const text = $(el).text().toLowerCase();
      // Skip torrent links listed in mirrors
      if (text.includes('1337x') || text.includes('rutor') || text.includes('tapochek') || text.includes('torrent')) return;
      
      const hostName = $(el).text().split('(')[0].split('-')[0].split('|')[0].trim() || "WebHost";
      const urls: string[] = [];
      $(el).find('a').each((_, a) => {
        const h = $(a).attr('href');
        if (h && h.startsWith('http')) urls.push(h);
      });
      if (urls.length > 0) {
        // Find if host exists already
        const existing = downloadCollections.find(d => d.host === hostName);
        if (existing) existing.urls.push(...urls);
        else downloadCollections.push({ host: hostName, urls });
      }
    });
  }

  // 6. Features
  const features: string[] = [];
  let featuresHeader = $('h3:contains("Repack Features")');
  if (featuresHeader.length > 0) {
    featuresHeader.nextAll('ul').first().find('li').each((_, el) => { features.push($(el).text().trim()) });
  } else {
    featuresHeader = $('strong:contains("Repack Features")').parent();
    featuresHeader.nextAll('ul').first().find('li').each((_, el) => { features.push($(el).text().trim()) });
  }

  // 7. Update Log
  const updateLog: string[] = [];
  // FitGirl usually puts backwards compatibility / update logs in standard paragraphs
  
  // 8. Description
  let description = "";
  let descHeader = $('h3:contains("Description"), strong:contains("Description:")').last();
  if (descHeader.length > 0) {
    let parentBlock = descHeader.is('strong') ? descHeader.closest('p') : descHeader;
    description = parentBlock.nextAll('p').filter((_, el) => $(el).text().length > 30).first().text().trim();
    if (!description && descHeader.parent().length > 0) {
       description = descHeader.parent().text().replace('Description:', '').trim();
    }
  } 
  
  if (!description) {
    $('p').each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 100 && !t.includes("Genres/Tags:") && !t.includes("Repack Size:") && !t.includes("Download Mirrors")) {
         description = t;
         return false; // break cheerio loop
      }
    });
  }
  
  if (torrentLinks.length === 0 && downloadCollections.length === 0) {
    return null; // Force AI fallback if critical parsing missed
  }

  return {
    title,
    description,
    postImage,
    screenshotImages,
    downloadCollections,
    torrentLinks,
    features,
    updateLog,
    additionalNotes: "Parsed via Deterministic DOM"
  };
}

// ==========================================
// Main Runner
// ==========================================
import { connectDB, flagPostAsIgnored } from "./utils.js";

async function parserRunner() {
  console.log("Connecting to MongoDB...");
  await connectDB();

  const postsToParse = await PostModel.find({ isParsed: false, aiParsingRequired: { $ne: true } }).sort({ date: -1 });
  console.log(`Found ${postsToParse.length} posts waiting to be parsed locally.`);

  const BATCH_SIZE = 20; // Parallel degree

  for (let i = 0; i < postsToParse.length; i += BATCH_SIZE) {
    const batch = postsToParse.slice(i, i + BATCH_SIZE);
    console.log(`\n[Batch ${Math.floor(i / BATCH_SIZE) + 1}] Processing posts ${i + 1} to ${Math.min(i + BATCH_SIZE, postsToParse.length)} in parallel...`);

    const promises = batch.map(async (post) => {
        try {
          if (await flagPostAsIgnored(post)) {
            console.log(`  -> [IGNORED] ${post.title.substring(0, 40)}...`);
            return;
          }
          
          const domData = parsePostDOM(post.title, post.content);
          if (domData && domData.torrentLinks.length > 0 && domData.description.length > 0) {
            post.parsedData = domData;
            post.isParsed = true;
            await post.save();
            console.log(`  -> [SUCCESS] ${post.title.substring(0, 40)}... | Local Parse`);
          } else {
            post.aiParsingRequired = true;
            await post.save();
            console.log(`  -> [SKIPPED] ${post.title.substring(0, 40)}... (Incomplete DOM -> Flagged for AI Queue)`);
          }
        } catch (error: any) {
          console.error(`Local Parsing Error for ${post.title}: ${error.message}`);
        }
    });

    await Promise.all(promises);
  }

  console.log(`\n\n=== RUN COMPLETE ===`);
  console.log(`Total Handled Locally: ${postsToParse.length}`);
  await mongoose.disconnect();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  parserRunner().catch(console.error);
}
