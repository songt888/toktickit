import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const requesterA = "Ari Suksan (ari.suksan@example.com)";
const requesterB = "Ben Chaiyo (ben.chaiyo@example.com)";
const apiBaseURL = "http://127.0.0.1:3000";

async function chooseRequester(page: Page, label: string) {
  await expect(page.getByLabel("Choose a Development Requester")).toBeVisible();
  await page.getByLabel("Choose a Development Requester").selectOption({ label });
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Current Development Requester")).toContainText(label.split(" (")[0]);
}

test("covers requester selection, ticket creation, detail, attachments, and requester switching", async ({ page, request }, testInfo) => {
  await page.goto("/");
  await chooseRequester(page, requesterA);

  await page.getByRole("link", { name: "Create Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await page.getByLabel("Category").selectOption({ label: "Network" });
  await page.getByLabel("Related System").selectOption({ label: "Network and Internet" });

  const summary = `E2E attachment workflow ${Date.now()}`;
  await page.getByLabel("Summary").fill(summary);
  await page.getByLabel("Description").fill("Verify the complete requester ticket and attachment workflow.");
  await page.getByLabel("Requested Priority").selectOption("HIGH");
  await page.getByLabel("Attachments").setInputFiles(path.resolve("docs/lab-01/screenshots/01-health.png"));

  const ticketCreated = page.waitForResponse((response) =>
    response.url().endsWith("/api/tickets") && response.request().method() === "POST" && response.status() === 201,
  );
  await page.getByRole("button", { name: "Create Ticket" }).click();
  await ticketCreated;
  await expect(page.getByText("Ticket created successfully.")).toBeVisible();
  await expect(page.getByText("Attachments uploaded: 1/1.")).toBeVisible();

  const ticketNumber = await page.locator("strong").filter({ hasText: /^TKT-/ }).innerText();
  await expect(page.getByText(ticketNumber)).toBeVisible();
  await page.screenshot({
    path: path.resolve("artifacts/lab-02/screenshots/desktop-create-ticket-success.png"),
    fullPage: true,
  });

  const listResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/tickets?") && response.request().method() === "GET" && response.status() === 200,
  );
  await page.getByRole("link", { name: "My Tickets" }).click();
  const listResponse = await listResponsePromise;
  const listPayload = await listResponse.json() as { items: Array<{ id: number; summary: string }> };
  const createdTicket = listPayload.items.find((item) => item.summary === summary);
  expect(createdTicket).toBeTruthy();

  const createdRow = page.locator("tr").filter({ hasText: summary });
  await expect(createdRow).toBeVisible();
  await createdRow.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
  const ticketInformation = page.getByRole("region", { name: "Ticket Information" });
  await expect(ticketInformation.getByText(ticketNumber)).toBeVisible();
  await expect(ticketInformation.getByText("Network", { exact: true })).toBeVisible();
  await expect(ticketInformation.getByText("Network and Internet", { exact: true })).toBeVisible();
  await expect(ticketInformation.getByText(summary)).toBeVisible();
  await expect(page.getByText("01-health.png", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download 01-health.png" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download 01-health.png" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("01-health.png");

  const requestersResponse = await request.get(`${apiBaseURL}/api/requesters?active=true`);
  expect(requestersResponse.status()).toBe(200);
  const requesters = await requestersResponse.json() as Array<{ id: number; name: string }>;
  const ari = requesters.find((requester) => requester.name === "Ari Suksan");
  const ben = requesters.find((requester) => requester.name === "Ben Chaiyo");
  if (!ari || !ben) throw new Error("Ari Suksan and Ben Chaiyo must be returned by the active requester API");

  const ownerDetail = await request.get(`${apiBaseURL}/api/tickets/${createdTicket!.id}`, {
    headers: { "X-Requester-Id": String(ari.id) },
  });
  expect(ownerDetail.status()).toBe(200);
  const ownerTicket = await ownerDetail.json() as {
    attachments: Array<{ id: number; originalName: string; removedAt: string | null }>;
  };
  const activeAttachment = ownerTicket.attachments.find(
    (attachment) => attachment.originalName === "01-health.png" && attachment.removedAt === null,
  );
  if (!activeAttachment) throw new Error("The uploaded active attachment was not returned in Ticket Detail");

  const crossRequesterURL = `${apiBaseURL}/api/attachments/${activeAttachment.id}/download`;
  const forbiddenAttachment = await request.get(crossRequesterURL, {
    headers: { "X-Requester-Id": String(ben.id) },
  });
  expect(forbiddenAttachment.status()).toBe(404);
  const forbiddenAttachmentBody = await forbiddenAttachment.json() as { error: string };
  expect(forbiddenAttachmentBody).toEqual({ error: "Resource not found" });

  const evidencePage = await page.context().newPage();
  await evidencePage.setViewportSize({ width: 1280, height: 720 });
  await evidencePage.setContent(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Cross-requester attachment authorization evidence</title>
        <style>
          :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; }
          body { margin: 0; background: #f4f7fb; color: #172033; }
          main { max-width: 1040px; margin: 52px auto; padding: 0 32px; }
          .card { background: white; border: 1px solid #d9e1ec; border-radius: 16px; box-shadow: 0 10px 28px rgba(23, 32, 51, .08); overflow: hidden; }
          header { padding: 26px 30px; background: #173f5f; color: white; }
          h1 { margin: 0 0 8px; font-size: 30px; }
          header p { margin: 0; color: #dceaf5; }
          .content { padding: 30px; }
          .context { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
          .context div { padding: 16px; border-radius: 10px; background: #f7f9fc; border: 1px solid #e1e7f0; }
          .label { display: block; margin-bottom: 5px; color: #667085; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
          .value { font-size: 19px; font-weight: 700; }
          pre { margin: 10px 0 22px; padding: 18px; overflow-wrap: anywhere; white-space: pre-wrap; border-radius: 10px; background: #101828; color: #e6edf3; font: 16px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
          .result { display: flex; align-items: center; gap: 14px; padding: 18px; border: 1px solid #f1b8b3; border-radius: 10px; background: #fff2f0; }
          .status { padding: 6px 11px; border-radius: 999px; background: #b42318; color: white; font-weight: 800; }
          .safe { color: #7a271a; font: 17px ui-monospace, SFMono-Regular, Menlo, monospace; }
          footer { margin-top: 18px; color: #667085; font-size: 14px; }
        </style>
      </head>
      <body>
        <main>
          <section class="card">
            <header>
              <h1>Cross-requester attachment access</h1>
              <p>Verified against the running TokTickIT API</p>
            </header>
            <div class="content">
              <div class="context">
                <div><span class="label">Resource owner</span><span class="value">Ari Suksan — requester ID ${ari.id}</span></div>
                <div><span class="label">Acting requester</span><span class="value">Ben Chaiyo — requester ID ${ben.id}</span></div>
                <div><span class="label">Ticket</span><span class="value">${ticketNumber} — ID ${createdTicket!.id}</span></div>
                <div><span class="label">Attachment</span><span class="value">01-health.png — ID ${activeAttachment.id}</span></div>
              </div>
              <span class="label">Request</span>
              <pre>GET ${crossRequesterURL}\nX-Requester-Id: ${ben.id}</pre>
              <span class="label">Actual API response</span>
              <div class="result">
                <span class="status">HTTP ${forbiddenAttachment.status()}</span>
                <span class="safe">${JSON.stringify(forbiddenAttachmentBody)}</span>
              </div>
              <footer>The attachment was active and downloadable by its owner before this cross-requester check.</footer>
            </div>
          </section>
        </main>
      </body>
    </html>
  `);
  await evidencePage.screenshot({
    path: path.resolve("artifacts/lab-02/screenshots/cross-requester-attachment-404.png"),
    fullPage: true,
  });
  await evidencePage.close();

  await page.getByRole("button", { name: "Remove" }).click();
  await page.getByLabel("Removal reason").fill("E2E cleanup after lifecycle verification");
  await page.getByRole("button", { name: "Confirm removal" }).click();
  await expect(page.getByText("Removed", { exact: true })).toBeVisible();
  await expect(page.getByText(/Unavailable for download/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Download 01-health.png" })).toHaveCount(0);
  await page.screenshot({
    path: path.resolve("artifacts/lab-02/screenshots/desktop-ticket-detail-removed.png"),
    fullPage: true,
  });

  const forbidden = await request.get(`${apiBaseURL}/api/tickets/${createdTicket!.id}`, {
    headers: { "X-Requester-Id": String(ben.id) },
  });
  expect(forbidden.status()).toBe(404);
  await expect(forbidden.json()).resolves.toEqual({ error: "Resource not found" });

  await page.getByRole("button", { name: "Change Requester" }).click();
  await chooseRequester(page, requesterB);
  await page.getByRole("link", { name: "My Tickets" }).click();
  await expect(page.getByText("Tickets created by Ben Chaiyo.")).toBeVisible();
  await expect(page.getByText(summary)).toHaveCount(0);

  await testInfo.attach("workflow-summary", {
    body: Buffer.from(`Created ${ticketNumber}; owner download succeeded; attachment and ticket cross-requester access returned 404; removal completed.`),
    contentType: "text/plain",
  });
});
