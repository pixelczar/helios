/**
 * One-shot script to seed the demo data.
 *
 * Usage (while the dev server is running and you're authenticated):
 *   1. Open your browser to http://localhost:3000/app (make sure you're logged in)
 *   2. Open the browser console and run:
 *        copy(document.cookie)
 *   3. Actually — since auth cookies are httpOnly, use this approach instead:
 *      Open your browser DevTools → Network tab → find any request to /api/activities
 *      → right-click → Copy as cURL → paste the curl command and pipe to this script.
 *
 * Or, simply log out and log back in via Strava. The auto-sync in the OAuth callback
 * will write .demo-cache.json automatically, then run:
 *   cp .demo-cache.json src/data/demo-activities.json
 */

import { readFileSync, existsSync } from "fs";

const cachePath = ".demo-cache.json";

if (existsSync(cachePath)) {
  const data = JSON.parse(readFileSync(cachePath, "utf8"));
  console.log(
    `Found ${data.length} activities in .demo-cache.json — copy to seed file with:`
  );
  console.log("  cp .demo-cache.json src/data/demo-activities.json");
} else {
  console.log("No .demo-cache.json found yet.");
  console.log(
    "Log out and back in via Strava to trigger auto-sync, then re-run this script."
  );
}
