const localApiUrl = "http://localhost:8000";

// NEXT_PUBLIC_* values are compiled into the browser bundle, so NEXT_PUBLIC_API_URL must be
// passed as a build arg in Dokploy. A deploy may pass an empty build argument, so use `||`
// rather than `??` to keep requests away from the frontend origin in that case.
export const apiUrl = (process.env.NEXT_PUBLIC_API_URL || localApiUrl).replace(/\/$/, "");
