import "dotenv/config";
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { business } from "./business.js";
import { getRealtimeTools, handleToolCall, makeInstructions } from "./receptionist.js";
import { buildSummary, deliverSummary, persistCallRecord } from "./summary.js";

const port = Number(process.env.PORT || 8787);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const realtimeModel = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini";
const realtimeVoice = process.env.OPENAI_REALTIME_VOICE || "marin";
const recordCalls = process.env.RECORD_CALLS === "true";

const server = http.createServer(async (request, response) => {
  if (request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      business: business.name,
      demo: true,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    });
    return;
  }

  if (request.url === "/voice") {
    sendXml(response, voiceResponseXml());
    return;
  }

  response.writeHead(404, { "content-type": "text/plain" });
  response.end("Not found");
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  if (new URL(request.url, publicBaseUrl).pathname !== "/media-stream") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (twilioSocket) => {
    wss.emit("connection", twilioSocket, request);
  });
});

wss.on("connection", (twilioSocket) => {
  const callRecord = {
    business: business.name,
    demo: true,
    startedAt: new Date().toISOString(),
    transcript: [],
    outcomes: [],
  };
  const pendingFunctionCalls = new Map();

  if (!process.env.OPENAI_API_KEY) {
    twilioSocket.close(1011, "OPENAI_API_KEY missing");
    return;
  }

  const openaiSocket = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(realtimeModel)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Safety-Identifier": safetyIdentifier(callRecord.callSid || "demo-caller"),
      },
    },
  );

  openaiSocket.on("open", () => {
    sendOpenAI(openaiSocket, {
      type: "session.update",
      session: {
        type: "realtime",
        model: realtimeModel,
        output_modalities: ["audio"],
        instructions: makeInstructions({ recordCalls }),
        audio: {
          input: {
            format: {
              type: "audio/pcmu",
            },
            turn_detection: {
              type: "semantic_vad",
            },
          },
          output: {
            format: {
              type: "audio/pcmu",
            },
            voice: realtimeVoice,
          },
        },
        tools: getRealtimeTools(),
        tool_choice: "auto",
      },
    });
  });

  twilioSocket.on("message", (raw) => {
    const event = parseJson(raw);
    if (!event) return;

    if (event.event === "start") {
      callRecord.callSid = event.start?.callSid || event.start?.streamSid || callRecord.callSid;
      callRecord.streamSid = event.start?.streamSid;
      callRecord.from = event.start?.customParameters?.From || event.start?.from || callRecord.from;
      return;
    }

    if (event.event === "media" && event.media?.payload) {
      sendOpenAI(openaiSocket, {
        type: "input_audio_buffer.append",
        audio: event.media.payload,
      });
      return;
    }

    if (event.event === "stop") {
      endCall(openaiSocket, twilioSocket, callRecord).catch((error) => {
        console.error("Failed to finish call", error);
      });
    }
  });

  openaiSocket.on("message", (raw) => {
    const event = parseJson(raw);
    if (!event) return;

    if (event.type === "response.output_audio.delta" && event.delta && callRecord.streamSid) {
      sendTwilio(twilioSocket, {
        event: "media",
        streamSid: callRecord.streamSid,
        media: { payload: event.delta },
      });
      return;
    }

    if (event.type === "input_audio_buffer.speech_started" && callRecord.streamSid) {
      sendTwilio(twilioSocket, { event: "clear", streamSid: callRecord.streamSid });
      return;
    }

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      appendTranscript(callRecord, "caller", event.transcript);
      return;
    }

    if (event.type === "response.output_audio_transcript.done") {
      appendTranscript(callRecord, "assistant", event.transcript);
      return;
    }

    if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
      executeFunctionCall(openaiSocket, event.item, callRecord);
      return;
    }

    if (event.type === "response.function_call_arguments.done") {
      const pending = pendingFunctionCalls.get(event.call_id) || {};
      pending.name = event.name || pending.name;
      pending.arguments = event.arguments || pending.arguments;
      pending.call_id = event.call_id;
      pendingFunctionCalls.set(event.call_id, pending);
      executeFunctionCall(openaiSocket, pending, callRecord);
    }

    if (event.type === "error") {
      console.error("OpenAI Realtime error", event.error || event);
    }
  });

  twilioSocket.on("close", () => openaiSocket.close());
  openaiSocket.on("close", () => {
    if (twilioSocket.readyState === WebSocket.OPEN) {
      twilioSocket.close();
    }
  });
  openaiSocket.on("error", (error) => console.error("OpenAI socket error", error));
  twilioSocket.on("error", (error) => console.error("Twilio socket error", error));
});

server.listen(port, () => {
  console.log(`AI receptionist demo listening on http://localhost:${port}`);
  console.log(`Twilio Voice webhook: ${publicBaseUrl.replace(/^http/, "http")}/voice`);
});

function voiceResponseXml() {
  const wsUrl = `${publicBaseUrl.replace(/^http/, "ws")}/media-stream`;
  const recordingNotice = recordCalls
    ? " This call may be recorded for demo testing if you consent."
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Olivia">Thanks for calling ${escapeXml(business.name)}. This is a demo AI receptionist, not a human.${recordingNotice} I can help with roofing intake, bookings, or a callback.</Say>
  <Connect>
    <Stream url="${escapeXml(wsUrl)}" />
  </Connect>
</Response>`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendXml(response, xml) {
  response.writeHead(200, { "content-type": "text/xml" });
  response.end(xml);
}

function sendOpenAI(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function sendTwilio(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function parseJson(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

function executeFunctionCall(openaiSocket, functionCall, callRecord) {
  const name = functionCall.name;
  const callId = functionCall.call_id;
  if (!name || !callId) return;

  let args = {};
  try {
    args = JSON.parse(functionCall.arguments || "{}");
  } catch {
    args = {};
  }

  const result = handleToolCall(name, args, callRecord);
  sendOpenAI(openaiSocket, {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(result),
    },
  });
  sendOpenAI(openaiSocket, { type: "response.create" });
}

async function endCall(openaiSocket, twilioSocket, callRecord) {
  callRecord.endedAt = new Date().toISOString();
  callRecord.summary = buildSummary(callRecord);
  callRecord.summaryDelivery = await deliverSummary(callRecord);
  callRecord.persistedPath = await persistCallRecord(callRecord);

  if (openaiSocket.readyState === WebSocket.OPEN) openaiSocket.close();
  if (twilioSocket.readyState === WebSocket.OPEN) twilioSocket.close();
}

function appendTranscript(callRecord, role, text) {
  if (!text) return;
  callRecord.transcript.push({
    role,
    text,
    at: new Date().toISOString(),
  });
}

function safetyIdentifier(value) {
  return `webuildco-phone-demo-${Buffer.from(String(value)).toString("base64url").slice(0, 24)}`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
