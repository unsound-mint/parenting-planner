const { chromium } = await import(process.env.PP_PLAYWRIGHT || "playwright");
const base = process.env.PP_BASE_URL;
const out = process.env.PP_OUT;
const b = await chromium.launch();
for (const template of ["pregnancy", "preschool"]) {
  for (const width of [1920, 390]) {
    const ctx = await b.newContext({ viewport: { width, height: width > 1000 ? 1080 : 844 } });
    const r = await ctx.request.post(base + "/api/demo/sessions", { data: { template } });
    if (r.status() !== 201) throw new Error("session " + r.status());
    const p = await ctx.newPage();
    await p.goto(base + "/family", { waitUntil: "networkidle" });
    const fam = new URL(p.url()).pathname.replace(/\/$/, "");
    const shot = async (path, name, full = true) => {
      await p.goto(base + fam + path, { waitUntil: "networkidle" });
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `${out}/library-${name}-${template}-${width}.png`, fullPage: full });
    };
    await shot("/learn", "landing", false);
    await shot("/learn/library", "library");
    const see = p.locator('a:has-text("See all")').first();
    const href = await see.getAttribute("href");
    await shot(href.replace(fam, ""), "topic");
    await p.goto(base + fam + "/learn/quizzes", { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${out}/library-quizzes-${template}-${width}.png`, fullPage: true });
    await p.locator("main ul button").first().click();
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${out}/library-deck-${template}-${width}.png`, fullPage: true });
    console.log(template, width, fam, href);
    await ctx.close();
  }
}
await b.close();
