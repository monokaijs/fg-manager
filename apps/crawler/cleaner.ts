import "dotenv/config";
import mongoose from "mongoose";
import { PostModel } from "./src/models/Post.js";
import { startUploader } from "./src/uploader.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fg-manager";

async function run() {
  console.log("Connecting to DB...");
  await mongoose.connect(MONGODB_URI);

  const digestMatches = await PostModel.updateMany(
    { title: { $regex: /updates digest|upcoming repacks/i } },
    { 
      $set: { 
        isParsed: true, 
        aiParsingRequired: false, 
        parsedData: { ignored: true, reason: "Digest / Placeholder" },
        isUploaded: false // Flag to ensure the uploader strips them remotely if they were already there!
      }
    }
  );

  console.log(`[Cleaner] Sanitized and blocked ${digestMatches.modifiedCount} Digest/Placeholder posts natively.`);

  console.log("[Cleaner] Regenerating Master Catalog entirely without digests...");
  await startUploader();

  await mongoose.disconnect();
}

run().catch(console.error);
