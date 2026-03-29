import "dotenv/config";
import mongoose from "mongoose";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { PostModel } from "./models/Post.js";
import { connectDB } from "./utils.js";

// Cloudflare R2 Config
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "your-account-id";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "your-access-key";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "your-secret";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "fg-cdn";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function uploadToR2(key: string, data: any) {
  const isIndex = key === "catalog.json" || key === "version.json";
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: "application/json",
    CacheControl: isIndex ? "public, max-age=0, must-revalidate" : "public, max-age=3600",
  });
  
  await s3.send(command);
}

export async function startUploader() {
  console.log(`[Uploader] Starting CDN Synchronization...`);
  await connectDB();
  
  // 1. Fetch ALL valid parsed posts to quickly compile the Master Index FIRST
  const allValidPosts = await PostModel.find({ isParsed: true }).sort({ date: -1 });
  
  const catalogData = allValidPosts
    .filter(p => p.parsedData && !p.parsedData.ignored)
    .map(p => ({
       id: p.wpId,
       slug: p.slug,
       title: p.parsedData.title || p.title,
       postImage: p.parsedData.postImage || "",
       date: p.date,
    }));
    
  const version = Date.now().toString();
  const catalogPayload = {
    version,
    updatedAt: new Date().toISOString(),
    games: catalogData,
  };
    
  try {
     console.log(`[Uploader] Re-compiling master catalog.json cache header bypassing index...`);
     await uploadToR2(`catalog.json`, catalogPayload);
     await uploadToR2(`version.json`, { version, updatedAt: catalogPayload.updatedAt });
     console.log(`[Uploader] Master index deployed successfully! [v${version}] (${catalogData.length} records)`);
  } catch (e: any) {
     console.error(`[Uploader] Failed to put master catalog objects: ${e.message}`);
  }

  // 2. Find newly parsed posts that haven't been meticulously pushed to the CDN yet
  const pendingPosts = await PostModel.find({ isParsed: true, isUploaded: { $ne: true } }).limit(500);
  console.log(`[Uploader] Found ${pendingPosts.length} detailed posts queued for R2 streaming...`);
  
  let uploadedCount = 0;
  
  for (const post of pendingPosts) {
    if (post.parsedData && !post.parsedData.ignored) {
      console.log(`[Uploader] Pushing ${post.slug}.json...`);
      try {
        await uploadToR2(`posts/${post.slug}.json`, {
          id: post.wpId,
          slug: post.slug,
          date: post.date,
          modified: post.modified,
          link: post.link,
          ...post.parsedData, // injects title, features, torrentLinks, downloadCollections, description
        });
        
        post.isUploaded = true;
        await post.save();
        uploadedCount++;
      } catch (e: any) {
         console.error(`[Uploader] Failed to put ${post.slug}.json: ${e.message}`);
      }
    } else if (post.parsedData && post.parsedData.ignored) {
       // Just flag ignored/digest anomalies as uploaded so they don't block the queue
       post.isUploaded = true;
       await post.save();
    }
  }
  
  console.log(`[Uploader] Synced ${uploadedCount} detailed pages to Cloudflare R2!`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startUploader().then(() => mongoose.disconnect()).catch(console.error);
}
