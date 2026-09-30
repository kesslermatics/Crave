const productionApiUrl = "https://crave-backend-production.up.railway.app";

// NEXT_PUBLIC_* values are compiled into the browser bundle. Railway may pass
// an empty build argument, so use `||` rather than `??` to keep requests away
// from the frontend origin in that case.
export const apiUrl = (process.env.NEXT_PUBLIC_API_URL || productionApiUrl).replace(/\/$/, "");
