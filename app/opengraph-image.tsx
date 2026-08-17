import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// fs.readFileSync below needs the Node runtime, not edge.
export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const markBase64 = readFileSync(
    join(process.cwd(), "public", "logo-mark-512.png")
  ).toString("base64");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#14181f",
        }}
      >
        <img
          src={`data:image/png;base64,${markBase64}`}
          width={140}
          height={140}
          style={{ borderRadius: 28 }}
        />
        <div
          style={{
            marginTop: 32,
            fontSize: 72,
            fontWeight: 600,
            color: "#edeef2",
            display: "flex",
          }}
        >
          DevAtlas
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 26,
            color: "#e8a33d",
            letterSpacing: 4,
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          The Library
        </div>
      </div>
    ),
    size
  );
}
