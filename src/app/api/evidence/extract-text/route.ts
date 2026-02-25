import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileUrl, fileType, fileContent } = body;

    if (!fileType) {
      return NextResponse.json(
        { error: "fileType is required" },
        { status: 400 }
      );
    }

    let extractedText = "";

    if (fileType === "text/plain") {
      // Plain text — return as-is
      extractedText = fileContent || "";
    } else if (fileType === "text/csv") {
      // CSV — return as-is (could parse later)
      extractedText = fileContent || "";
    } else if (fileType === "application/pdf") {
      // PDF — use pdf-parse if available, otherwise use Claude
      try {
        // Try using Claude to describe the PDF content
        if (fileUrl) {
          const response = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            messages: [
              {
                role: "user",
                content: `Extract all text content from this PDF. The file is at: ${fileUrl}. Return only the extracted text, no commentary.`,
              },
            ],
          });
          extractedText =
            response.content[0].type === "text"
              ? response.content[0].text
              : "";
        }
      } catch (err) {
        console.error("[extract-text] PDF extraction failed:", err);
        extractedText = fileContent || "[PDF content could not be extracted]";
      }
    } else if (fileType.startsWith("image/")) {
      // Images — use Claude Haiku vision
      if (fileUrl) {
        try {
          // Fetch the image and convert to base64
          const imgRes = await fetch(fileUrl);
          const buffer = await imgRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");

          const mediaType = fileType as
            | "image/png"
            | "image/jpeg"
            | "image/gif"
            | "image/webp";

          const response = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mediaType,
                      data: base64,
                    },
                  },
                  {
                    type: "text",
                    text: "Extract all text visible in this image. If there's no text, describe the key content and data shown. Return only the extracted content, no commentary.",
                  },
                ],
              },
            ],
          });

          extractedText =
            response.content[0].type === "text"
              ? response.content[0].text
              : "";
        } catch (err) {
          console.error("[extract-text] Image extraction failed:", err);
          extractedText = "[Image content could not be extracted]";
        }
      }
    }

    return NextResponse.json({ extractedText });
  } catch (err) {
    console.error("[api/evidence/extract-text] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
