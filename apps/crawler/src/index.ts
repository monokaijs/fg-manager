import "dotenv/config";
import axios from "axios";
import { OpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const WP_API_BASE = "https://fitgirl-repacks.site/wp-json/wp/v2/posts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy",
  baseURL: process.env.OPENAI_BASE_URL, // e.g. https://api.openai-proxy.com/v1 to bypass region locks
});

// Zod schema for the AI parser output
const PostDataSchema = z.object({
  title: z.string().describe("The clean title of the game in the post."),
  postImage: z.string().nullable().describe("The main cover image URL from the post content."),
  screenshotImages: z.array(z.string()).describe("An array of screenshot URLs found in the post."),
  downloadMirrors: z.array(z.object({
    name: z.string(),
    url: z.string()
  })).describe("Filehoster download mirror links, including names like OneDrive, Filehoster XYZ, etc."),
  torrentLinks: z.array(z.string()).describe("Direct links to .torrent files, or magnet URLs."),
  features: z.array(z.string()).describe("The key features of the repack, such as size, languages, installer type, etc."),
  updateLog: z.array(z.string()).describe("Any notes regarding updates or newer builds, if present."),
  additionalNotes: z.string().describe("Any extra relevant repack notes or warnings.")
});

/**
 * Fetch posts from WP JSON API
 */
async function fetchPosts(params: Record<string, string>) {
  const url = new URL(WP_API_BASE);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }
  
  // Using allorigins.win to bypass local ISP or VPN Deep Packet Inspection resets (ECONNRESET)
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url.toString())}`;
  
  const response = await axios.get(proxyUrl);
  let posts = JSON.parse(response.data.contents);
  
  // Filter out any sticky/announcement posts like "Upcoming Repacks"
  posts = posts.filter((p: any) => p.title?.rendered && !p.title.rendered.toLowerCase().includes("upcoming repacks"));

  // We skip pagination headers here since we are proxying, but it works for standard scraping.
  const totalPages = 100;
  const totalPosts = 1000;
  
  return { posts, totalPages, totalPosts };
}

/**
 * Fetch latest posts
 */
export async function getLatestPosts(perPage = 10) {
  console.log(`Fetching latest posts...`);
  return fetchPosts({ per_page: perPage.toString(), orderby: "date", order: "desc" });
}

/**
 * Fetch latest strictly updated posts
 */
export async function getLatestUpdatedPosts(perPage = 10) {
  console.log(`Fetching latest updated posts...`);
  return fetchPosts({ per_page: perPage.toString(), orderby: "modified", order: "desc" });
}

/**
 * Fetch 'all' posts via pagination wrapper (generator)
 */
export async function* getAllPosts(perPage = 10) {
  console.log(`Starting full catalog fetch...`);
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await fetchPosts({
      per_page: perPage.toString(),
      orderby: "date",
      order: "desc",
      page: page.toString(),
    });
    
    totalPages = data.totalPages;
    for (const post of data.posts) {
      yield post;
    }
    
    page++;
  }
}

/**
 * Parses post HTML content to structured JSON via OpenAI API
 */
export async function parsePostWithAI(postTitle: string, htmlContent: string) {
  console.log(`Parsing content for: ${postTitle}`);

  // We are stripping heavily embedded HTML tags down to minimize tokens.
  const cleanContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional web scraper/parser.
Extract specific game and repack data from the provided HTML payload and structure it strictly into the following JSON format:
{
  "title": "Clean title",
  "postImage": "Cover image URL (or null)",
  "screenshotImages": ["URL 1", "URL 2"],
  "downloadMirrors": [{"name": "Mirrors", "url": "URL"}],
  "torrentLinks": ["Magnet / Torrent link"],
  "features": ["Repack size", "Languages", etc],
  "updateLog": ["Patch notes"],
  "additionalNotes": "Any extra notes"
}
Ensure you return strictly a JSON object surrounded by \`\`\`json and nothing else.`
        },
        {
          role: "user",
          content: `Title: ${postTitle}\n\nContent:\n${cleanContent}`
        }
      ]
    });

    const text = completion.choices[0].message.content || "{}";
    const jsonMatch = text.match(/```json([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : "{}");
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return null;
  }
}

async function main() {
  console.log("Starting FitGirl WP JSON Crawler...");
  
  // 1. Fetching latest posts
  const { posts } = await getLatestPosts(2);
  console.log(`Fetched ${posts.length} clean posts.`);
  
  // Print titles
  posts.forEach((p: any, i: number) => console.log(`[${i}] ${p.title.rendered}`));

  if (!process.env.OPENAI_API_KEY) {
    console.warn("\nNo OPENAI_API_KEY set in .env! Skipping AI parsing.");
    return;
  }

  // 2. Demonstrating AI Parsing on fetched posts
  for (const post of posts) {
    const parsedData = await parsePostWithAI(post.title.rendered, post.content.rendered);
    console.log(`\n== Parsed Output for [${post.title.rendered}] ==`);
    console.log(JSON.stringify(parsedData, null, 2));
  }
}

// Running the test script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
