# Demo Composer

Concept prototype demonstrating a modular demo architecture with AI-assisted assembly.

**The argument it makes visually:** a core platform spine is built once and never rebuilt. Vertical overlays (data packs plus narrative modules) snap on top. Context layers (persona, region, deal stage) determine sequencing and depth. Switching verticals visibly swaps only Layer 02 while Layer 01 stays locked. The assembly step then composes the right demo for that combination from the existing library.

All data is synthetic and illustrative. Nothing reflects any company's internal systems.

---

## File structure

```
demo-composer/
├── server.js           Express server, holds the API key server-side
├── package.json
├── .env.example        Template for your local key
├── .gitignore          Keeps .env and node_modules out of git
├── README.md
└── public/
    └── index.html      Entire frontend, single file
```

---

## Part 1: Run it locally in VS Code

**Step 1. Create the folder and add the files.**
Make a folder called `demo-composer`, open it in VS Code, and add every file above in the same structure. `index.html` must sit inside a `public` subfolder.

**Step 2. Confirm Node is installed.**
In the VS Code terminal:
```bash
node --version
```
You need v18 or higher. If the command fails, install Node from nodejs.org first.

**Step 3. Install dependencies.**
```bash
npm install
```

**Step 4. Get an API key.**
Use your existing Gemini API key, or generate one at aistudio.google.com under Get API Key.

Gemini has a free tier with rate limits that this prototype sits comfortably inside. If you are on a paid plan, consider setting a budget cap in Google Cloud regardless.

**Step 5. Create your .env file.**
Duplicate `.env.example`, rename the copy to `.env`, and paste your key in:
```
GEMINI_API_KEY=your-actual-key-here
```
`.gitignore` already excludes `.env`, so the key will never reach GitHub.

**Step 6. Start the server.**
```bash
npm start
```
You should see `Demo Composer running on port 3000`.

**Step 7. Open it.**
Go to `http://localhost:3000` in your browser. Click through the verticals to confirm the overlay swaps, then click **Assemble Demo** to confirm the AI call works.

**Step 8. Verify the key is loaded.**
If assembly fails, visit `http://localhost:3000/healthz`. It returns `keyPresent: true` or `false`, plus the model name in use. If false, your `.env` is missing, misnamed, or the server needs restarting after you created it.

---

## Part 2: Deploy to Render

**Step 1. Push to GitHub.**
Create a new repository, then from your project folder:
```bash
git init
git add .
git commit -m "Demo Composer prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/demo-composer.git
git push -u origin main
```
Confirm on GitHub that `.env` is **not** in the repo. If it is, remove it before going further.

**Step 2. Create the Render service.**
In the Render dashboard, choose **New** then **Web Service**, and connect the GitHub repository.

**Step 3. Configure the service.**

| Setting | Value |
|---|---|
| Environment | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free is fine for a demo |

**Step 4. Add the environment variable.**
Before deploying, open the **Environment** section and add:

- Key: `GEMINI_API_KEY`
- Value: your key

This is the step that keeps the key server-side. The browser never sees it.

**Step 5. Deploy and test.**
Render builds and gives you a public URL. Open it, switch verticals, and run an assembly to confirm the API call works in production.

**Step 6. Note the cold start.**
Render's free tier sleeps after inactivity, so the first load after a quiet period can take 30 to 50 seconds. Before any live demo, open the URL a few minutes early to wake it. If you are sending the link to someone, either warn them or use a paid instance.

---

## Troubleshooting

**Assembly fails with a 502.** Check the Render logs. Most often the key is wrong, or the model name in `GEMINI_MODEL` is not one your key can access. Model names change; confirm the current one in Google AI Studio and set `GEMINI_MODEL` accordingly.

**Assembly fails with a 429.** You have hit Gemini's free-tier rate limit. Wait a minute and retry, or move to a paid tier before a live demo.

**Assembly fails with "unparseable output."** The model returned prose instead of JSON. Refresh and retry; if it persists, the prompt in `server.js` may need a stronger instruction to return JSON only.

**Page loads but styling is broken.** Google Fonts is blocked or offline. The layout still works, only the typefaces fall back.

**Works locally but not on Render.** The environment variable was almost certainly not added in the Render dashboard. `.env` files are local only and are never deployed.

---

## Changing the content

**Add or edit a vertical:** in `public/index.html`, find the `VERTICALS` object near the top of the script block. Each entry needs a `label`, an `assets` array, a `metrics` array, and a `personas` array. Adding one is roughly ten lines, which is the point the prototype is making.

**Edit the core spine:** the `CORE_SPINE` array sits directly above it.

**Change what the AI returns:** the prompt lives in `server.js` inside the `/api/assemble` route. The requested JSON shape is specified there, and the frontend renders whatever fields come back.

**Switch model providers:** only the fetch block inside `/api/assemble` is provider-specific. The route contract, the frontend, and everything else stay the same. Swapping providers means changing the endpoint, the request body shape, and the line that extracts text from the response.
