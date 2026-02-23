import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Helios — Your running journey, visualized";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
          backgroundColor: "#000000",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: "absolute",
            width: 800,
            height: 800,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(252,76,2,0.15) 0%, rgba(252,76,2,0.05) 40%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 128,
              fontWeight: 900,
              fontStyle: "italic",
              color: "#f5f5f5",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            Helios
          </div>
          {/* <div
            style={{
              fontSize: 28,
              fontWeight: 400,
              color: "#737373",
              letterSpacing: "0.05em",
            }}
          >
            Your running journey, visualized
          </div> */}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
