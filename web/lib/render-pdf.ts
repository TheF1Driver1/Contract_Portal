/**
 * Shared Puppeteer PDF renderer.
 * Accepts a complete HTML string and returns a PDF buffer.
 */
export async function renderPdfFromHtml(html: string): Promise<Buffer | null> {
  try {
    const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    const { default: puppeteer } = await import("puppeteer-core");

    let browser;
    if (isVercel) {
      const { default: chromium } = await import("@sparticuz/chromium-min");
      const packUrl =
        process.env.CHROMIUM_PACK_URL ??
        "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.tar";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chromiumAny = chromium as any;
      browser = await puppeteer.launch({
        args: chromiumAny.args ?? [],
        defaultViewport: chromiumAny.defaultViewport ?? { width: 1200, height: 900 },
        executablePath: await chromiumAny.executablePath(packUrl),
        headless: true,
      });
    } else {
      const localChrome =
        process.env.CHROMIUM_PATH ??
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
      browser = await puppeteer.launch({
        executablePath: localChrome,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        headless: true,
      });
    }

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({ format: "Letter", printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[render-pdf] Puppeteer failed:", err);
    return null;
  }
}
