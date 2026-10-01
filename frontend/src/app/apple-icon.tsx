import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ alignItems: "center", background: "#D7C56D", display: "flex", height: "100%", justifyContent: "center", width: "100%" }}>
        <div style={{ alignItems: "center", background: "#423421", borderRadius: "50%", display: "flex", height: 104, justifyContent: "center", position: "relative", width: 104 }}>
          <div style={{ background: "#FCFBF6", borderRadius: "50%", height: 76, width: 76 }} />
          <div style={{ background: "#996130", borderRadius: "50%", height: 32, position: "absolute", width: 32 }} />
          <div style={{ background: "#423421", borderRadius: 10, height: 12, position: "absolute", right: -32, top: 6, transform: "rotate(-45deg)", width: 50 }} />
        </div>
      </div>
    ),
    size,
  );
}
