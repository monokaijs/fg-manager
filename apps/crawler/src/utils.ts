import "dotenv/config";
import mongoose from "mongoose";
import axios from "axios";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fg-manager";
const WP_API_BASE = "https://fitgirl-repacks.site/wp-json/wp/v2/posts";

/**
 * Connects to MongoDB securely, ignoring if already connected.
 */
export async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }
}

/**
 * Check if a post title matches known non-game releases.
 */
export function isIgnorablePost(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return lowerTitle.includes("upcoming repacks") || 
         lowerTitle.includes("updates digest") || 
         lowerTitle.includes("a call for donations");
}

/**
 * Flags a Mongoose Post document as ignored securely and saves it to DB if applicable.
 * Returns true if the post was flagged and saved.
 */
export async function flagPostAsIgnored(post: any): Promise<boolean> {
  if (isIgnorablePost(post.title)) {
    post.isParsed = true;
    post.aiParsingRequired = false;
    post.parsedData = { ignored: true, reason: "Digest / Placeholder" };
    await post.save();
    return true;
  }
  return false;
}

/**
 * Centralized fetch API routing through CodeTabs Proxy for FitGirl bypass.
 */
export async function fetchWPPage(page: number, perPage: number = 20) {
  const url = new URL(WP_API_BASE);
  url.searchParams.append("page", page.toString());
  url.searchParams.append("per_page", perPage.toString());
  url.searchParams.append("orderby", "date");
  url.searchParams.append("order", "desc");
  
  const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url.toString())}`;
  
  const response = await axios.get(proxyUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });
  
  return response.data;
}
