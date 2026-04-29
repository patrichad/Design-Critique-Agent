import { createServer } from "http";
import { handleCreateCritique } from "./routes/critiques";
import { seedWallet } from "../services/billing/creditLedger";
import { handleCreateCheckout, handleStripeWebhook } from "./routes/billing";
import { handleFeedbackCreate } from "./routes/feedback";
import { listEvents } from "../services/telemetry/metrics";

const port = Number(process.env.PORT ?? 8787);

seedWallet("demo-team", 500);

const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method === "POST" && request.url === "/v1/critiques") {
    await handleCreateCritique(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/v1/billing/checkout") {
    await handleCreateCheckout(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/v1/billing/stripe/webhook") {
    await handleStripeWebhook(request, response);
    return;
  }

  if (request.method === "POST" && request.url === "/v1/feedback/beta") {
    await handleFeedbackCreate(request, response);
    return;
  }

  if (request.method === "GET" && request.url === "/v1/telemetry/events") {
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ events: listEvents() }));
    return;
  }

  response.statusCode = 404;
  response.end("Not found");
});

server.listen(port, () => {
  console.log(`Critique API listening on :${port}`);
});
