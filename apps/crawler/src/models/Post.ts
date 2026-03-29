import mongoose from "mongoose";

const PostSchema = new mongoose.Schema(
  {
    wpId: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    link: { type: String, required: true },
    date: { type: Date, required: true },
    modified: { type: Date, required: true },
    content: { type: String, required: true },
    isParsed: { type: Boolean, default: false },
    parsedData: { type: mongoose.Schema.Types.Mixed, default: null },
    isUploaded: { type: Boolean, default: false },
    aiParsingRequired: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const PostModel = mongoose.models.Post || mongoose.model("Post", PostSchema);
