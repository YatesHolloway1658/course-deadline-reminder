import { createServer } from "node:http";
import { ZodError } from "zod";
import { reminderRequestSchema, scheduleDeadlineReminder } from "./deadline_reminder.js";
import { infrai, InfraiError } from "./infrai_cron.js";

const port = Number(process.env.PORT ?? 3000);

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/reminders") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = reminderRequestSchema.parse(await readJson(request));
    const result = await scheduleDeadlineReminder(input, infrai.cron.create);
    send(response, 201, result);
  } catch (error) {
    if (error instanceof ZodError) {
      send(response, 400, { error: "Invalid reminder request", issues: error.issues });
      return;
    }
    if (error instanceof RangeError) {
      send(response, 422, { error: error.message });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, detail: error.detail });
      return;
    }
    send(response, 500, { error: "Could not schedule reminder" });
  }
}).listen(port, () => {
  console.log(`Deadline reminder service listening on http://localhost:${port}`);
});
