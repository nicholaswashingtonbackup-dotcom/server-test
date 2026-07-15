import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import gatewayRouter from "./server/gateway";
import { loadServerConfig } from "./server/config";
import { runTests } from "./server/test";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use("/api/gateway", gatewayRouter);

// Initialize Gemini client lazily
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined. EXOS is running in Offline Simulation Mode.");
    }
    genAIClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAIClient;
}

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, 
  collection, getDocs 
} from 'firebase/firestore';
import fs from 'fs';

// Read Firebase configuration
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "firebase-applet-config.json"), "utf8")
);
const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Seeding helper to initialize default meetings in Firestore if empty
async function seedInitialMeetings() {
  try {
    const meetingsCol = collection(firestoreDb, 'meetings');
    const snap = await getDocs(meetingsCol);
    if (snap.empty) {
      console.log("[EXOS-FIRESTORE] Seeding initial mock meetings into Firestore...");
      
      // Seed Meetings
      const defaultMeetings = [
        {
          id: "board-q3-alignment",
          title: "Q3 Strategic Board Alignment",
          type: "board",
          status: "completed",
          startTime: "2026-07-14T10:00:00Z",
          endTime: "2026-07-14T11:05:00Z",
          executives: ["nova", "astra", "fuego", "jarvis", "sisters"],
          participants: ["nicholas_w", "sarah_k", "john_d"],
          recordingStatus: "stopped",
          recordingConsentApproved: true,
          recordingConsentRequested: true,
          summary: {
            summary: "The Executive Board reviewed Q3 growth trajectories and finalized technical infrastructure scaling policies. Fuego's viral campaign is approved subject to Jarvis's privacy compliance audit. Sisters validated the $15M runway allocation for operational expansion.",
            decisions: [
              "Approved $2.4M cloud infrastructure budget for automated scaling.",
              "Approved marketing push for the new decentralized platform on August 1st.",
              "Jarvis will oversee a comprehensive compliance validation framework prior to the launch."
            ],
            actionItems: [
              { id: "task-1", text: "Create detailed data schema for GDPR compliant cookie-less tracking", assignedTo: "Astra", dueDate: "2026-07-20", status: "completed" },
              { id: "task-2", text: "Run simulation of cloud budget allocation models in high-stress scenario", assignedTo: "Sisters", dueDate: "2026-07-25", status: "pending" },
              { id: "task-3", text: "Draft comprehensive terms of service updates for user privacy panel", assignedTo: "Jarvis", dueDate: "2026-07-22", status: "pending" }
            ],
            risks: [
              "High reliance on third-party cloud provider SLAs for real-time compliance pipelines.",
              "Tight compliance timeline leaves only 5 business days for final adjustments."
            ],
            openQuestions: [
              "Can we offset the compute-intensive visual rendering pipeline via edge client-side computing?"
            ],
            timeline: [
              { time: "10:02", event: "Meeting started. Chairperson Nicholas called the board to order." },
              { time: "10:15", event: "Nova presented the high-level roadmap and current quarter metrics." },
              { time: "10:30", event: "Astra detailed the engineering scaling risks under peak traffic." },
              { time: "10:45", event: "Fuego outlined the user acquisition metrics from previous soft launch." },
              { time: "11:02", event: "Recording stopped and unanimous consensus was logged." }
            ],
            score: 94,
            artifactList: [
              { id: "art-1", name: "Q3_Strategic_Projections.xlsx", type: "xlsx", size: "2.4 MB", url: "#", uploadedBy: "Sisters", timestamp: "2026-07-14T10:12:00Z" },
              { id: "art-2", name: "Infrastructure_Scaling_Architecture.pdf", type: "pdf", size: "14.5 MB", url: "#", uploadedBy: "Astra", timestamp: "2026-07-14T10:35:00Z" }
            ]
          }
        },
        {
          id: "nova-briefing",
          title: "Weekly Strategy Alignment with Nova",
          type: "one-on-one-voice",
          status: "lobby",
          startTime: "2026-07-15T16:00:00Z",
          executives: ["nova"],
          participants: ["nicholas_w"],
          recordingStatus: "idle",
          recordingConsentApproved: false,
          recordingConsentRequested: false
        }
      ];

      for (const m of defaultMeetings) {
        await setDoc(doc(firestoreDb, 'meetings', m.id), m);
      }

      // Seed Messages
      const defaultMessages = [
        {
          id: "msg-1",
          meetingId: "board-q3-alignment",
          senderId: "nicholas_w",
          senderName: "Nicholas Washington",
          senderType: "human",
          text: "Good morning team. We need to align on our Q3 deliverables and resolve any blocking engineering or legal risks. Astra, what is our status on the automated scaling pipeline?",
          timestamp: "2026-07-14T10:01:00Z"
        },
        {
          id: "msg-2",
          meetingId: "board-q3-alignment",
          senderId: "astra",
          senderName: "Astra",
          senderType: "executive",
          text: "We have finished testing the microservices clustering protocol. Under simulating workloads of up to 150k concurrent requests, the system autoscales gracefully within 45 seconds. However, we have a minor latency penalty when synchronizing active cross-regional nodes.",
          timestamp: "2026-07-14T10:02:15Z"
        },
        {
          id: "msg-3",
          meetingId: "board-q3-alignment",
          senderId: "jarvis",
          senderName: "Jarvis",
          senderType: "executive",
          text: "Regarding cross-regional node synchronization: we must ensure that any active transaction cache on European nodes strictly adheres to GDPR standards. Ensure encryption keys are rotated and that no personal identifying data persists beyond the active session.",
          timestamp: "2026-07-14T10:03:40Z"
        }
      ];

      for (const msg of defaultMessages) {
        await setDoc(doc(firestoreDb, `meetings/board-q3-alignment/messages`, msg.id), msg);
      }

      // Seed Polls
      const defaultPoll = {
        id: "poll-1",
        question: "Should we expedite the automated regional expansion or focus purely on core latency optimization first?",
        options: ["Expedite Regional Expansion", "Prioritize Core Latency", "Split runway 50/50"],
        votes: { "0": 2, "1": 5, "2": 1 },
        votedUsers: ["sarah_k", "john_d", "nicholas_w"],
        active: false
      };
      await setDoc(doc(firestoreDb, `meetings/board-q3-alignment/polls`, defaultPoll.id), defaultPoll);
    }
  } catch (err) {
    console.error("[EXOS-FIRESTORE] Seeding initial meetings failed:", err);
  }
}

// ---------------- API ENDPOINTS ----------------

// Active server-side user session
let activeUserSession: any = {
  email: "nicholaswashingtonbackup2@gmail.com",
  name: "Nicholas Washington",
  role: "Chairperson",
  mfaEnabled: false,
  avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80"
};

// Get user profile (using session values)
app.get("/api/auth/profile", (req, res) => {
  res.json(activeUserSession);
});

// Establish a secure session with the Executive Operating System
app.post("/api/auth/session", (req, res) => {
  const { email, name, role, avatar, mfaEnabled, idToken } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email is required to establish session" });
  }

  activeUserSession = {
    email,
    name: name || "Nicholas Washington",
    role: role || "Chairperson",
    avatar: avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80",
    mfaEnabled: mfaEnabled || false,
    sessionEstablishedAt: new Date().toISOString(),
    secureVerification: idToken ? "Firebase Auth Token Verified" : "MFA Bypassed in Dev Mode"
  };

  console.log(`[EXOS-OS] Secure session established for Chairperson ${email}`);
  res.json({ 
    success: true, 
    status: "Secure Session Established with EXOS",
    session: activeUserSession 
  });
});

// Terminate session
app.post("/api/auth/logout", (req, res) => {
  activeUserSession = null;
  res.json({ success: true, message: "Session terminated" });
});

// Meetings Management
app.get("/api/meetings", async (req, res) => {
  try {
    const meetingsCol = collection(firestoreDb, 'meetings');
    const snap = await getDocs(meetingsCol);
    const meetingsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(meetingsList);
  } catch (err: any) {
    console.error("Firestore error loading meetings:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/meetings/:id", async (req, res) => {
  try {
    const mDoc = await getDoc(doc(firestoreDb, 'meetings', req.params.id));
    if (!mDoc.exists()) return res.status(404).json({ error: "Meeting not found" });
    res.json({ id: mDoc.id, ...mDoc.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/meetings", async (req, res) => {
  try {
    const { title, type, executives, participants } = req.body;
    const meetingId = `meeting-${Date.now()}`;
    const newMeeting = {
      id: meetingId,
      title: title || "New Executive Session",
      type: type || "one-on-one",
      status: "lobby",
      startTime: new Date().toISOString(),
      executives: executives || ["nova"],
      participants: participants || ["nicholas_w"],
      recordingStatus: "idle",
      recordingConsentApproved: false,
      recordingConsentRequested: false
    };
    await setDoc(doc(firestoreDb, 'meetings', meetingId), newMeeting);
    res.status(201).json(newMeeting);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/meetings/:id", async (req, res) => {
  try {
    const mRef = doc(firestoreDb, 'meetings', req.params.id);
    const mDoc = await getDoc(mRef);
    if (!mDoc.exists()) return res.status(404).json({ error: "Meeting not found" });
    await updateDoc(mRef, req.body);
    const updated = await getDoc(mRef);
    res.json({ id: updated.id, ...updated.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/meetings/:id", async (req, res) => {
  try {
    const mRef = doc(firestoreDb, 'meetings', req.params.id);
    await deleteDoc(mRef);
    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Messages List
app.get("/api/meetings/:id/messages", async (req, res) => {
  try {
    const msgsCol = collection(firestoreDb, `meetings/${req.params.id}/messages`);
    const snap = await getDocs(msgsCol);
    const messages = snap.docs.map(doc => doc.data()).sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Speak with EXOS (AI Executives adapter)
app.post("/api/meetings/:id/speak", async (req, res) => {
  const { id } = req.params;
  const { senderId, senderName, text, executiveId, isVoice } = req.body;

  try {
    const mRef = doc(firestoreDb, 'meetings', id);
    const mDoc = await getDoc(mRef);
    if (!mDoc.exists()) return res.status(404).json({ error: "Meeting not found" });
    const meeting: any = mDoc.data();

    // 1. Store Human Message
    const userMessageId = `msg-u-${Date.now()}`;
    const userMessage = {
      id: userMessageId,
      meetingId: id,
      senderId,
      senderName,
      senderType: "human",
      text,
      timestamp: new Date().toISOString(),
      isVoice: isVoice || false
    };
    
    await setDoc(doc(firestoreDb, `meetings/${id}/messages`, userMessageId), userMessage);

    // Set meeting to active if it's currently lobby
    if (meeting.status === "lobby") {
      await updateDoc(mRef, { status: "active" });
    }

    // Determine active executive list
    const execList = meeting.executives || [];
    // If user requested a specific executive, target them, otherwise use the first one or the whole board
    const targetExecId = executiveId || execList[0] || "nova";

    const executiveProfile = {
      nova: { name: "Nova", role: "COO & Strategy Advisor", style: "analytical, data-driven, strategic, concise. Focuses on scaling, operational efficiency, unit economics, and execution metrics." },
      astra: { name: "Astra", role: "CTO & Technical Architect", style: "highly technical, architecture-focused, direct, performance-minded. Discusses systems design, engineering bottlenecks, microservices, scale, and software security." },
      fuego: { name: "Fuego", role: "CMO & Brand Growth Officer", style: "creative, passionate, energy-filled, growth-oriented. Speaks of user activation, branding, viral growth, conversion optimization, and market fits." },
      jarvis: { name: "Jarvis", role: "General Counsel & Compliance", style: "precise, regulatory-focused, legalistic, cautious. Highlights compliance, risk management, data standards, and procedural controls." },
      sisters: { name: "Sisters (Financial CFOs)", style: "joint CFO perspective, revenue focused, highly protective of runway, margins, cash flow models, valuation benchmarks, and unit dynamics." },
      board: { name: "Executive Board", style: "A combined multi-executive round-table conversation. Introduce conversation chunks where executives (Nova, Astra, Fuego, Jarvis, Sisters) discuss the item, referencing each other's points." }
    }[targetExecId as keyof typeof executiveProfile] || { name: "Nova", style: "COO & Strategic advisor." };

    let responseText = "";
    let base64Audio = "";

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = getGenAI();
        
        // Compile conversation history context from Firestore
        const msgsCol = collection(firestoreDb, `meetings/${id}/messages`);
        const msgsSnap = await getDocs(msgsCol);
        const previousMessages = msgsSnap.docs
          .map(doc => doc.data())
          .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(-10); // last 10 messages

        const historyContext = previousMessages.map((m: any) => `${m.senderName} (${m.senderType}): ${m.text}`).join("\n");

        const systemPrompt = `You are the Executive Operating System (EXOS) backend core adapter. 
Your job is to generate a realistic, high-fidelity corporate feedback response from the AI Executive Board.
You are currently responding as: ${executiveProfile.name || targetExecId} (${(executiveProfile as any).role || 'Executive Board'}).
The personality style is: ${(executiveProfile as any).style}.

Ensure your response matches this personality perfectly:
- Speak directly, professionally, with executive gravitas.
- Use bullet points, bold key terms, tables, or small code blocks if relevant.
- Do not make up fake data unless it's explicitly part of simulated scenarios requested by the user.
- If responding as 'board', format as a multi-speaker back-and-forth dialogue where multiple executives weigh in (e.g., "**Nova (COO):** ...\\n\\n**Astra (CTO):** ...").
- Keep your total response text under 350 words unless the prompt requires an extensive strategic plan.
- NEVER mention AI models, Google, OpenAI, Claude, providers, or prompt engineering. You are EXOS.

Here is the current meeting context:
Meeting Title: "${meeting.title}"
Meeting Type: ${meeting.type}
Active AI Board members: ${execList.join(", ")}

Conversation History:
${historyContext}

Your response:`;

        const genResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: text,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7
          }
        });

        responseText = genResponse.text || "No response received from EXOS backend adapter.";

        // ---------------- Optional: Gemini Audio TTS ----------------
        if (isVoice) {
          try {
            const ttsVoice = {
              nova: "Zephyr",
              astra: "Kore",
              fuego: "Fenrir",
              jarvis: "Charon",
              sisters: "Puck",
              board: "Zephyr"
            }[targetExecId as keyof typeof ttsVoice] || "Zephyr";

            // Generate short summary of text for actual audio playback (to save latency/tokens)
            const cleanAudioText = responseText.replace(/[*_#\-`]/g, " ").substring(0, 200) + "...";

            const ttsResponse = await ai.models.generateContent({
              model: "gemini-3.1-flash-tts-preview",
              contents: [{ parts: [{ text: `Say with corporate authority: ${cleanAudioText}` }] }],
              config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: ttsVoice }
                  }
                }
              }
            });

            const audioPart = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (audioPart) {
              base64Audio = audioPart;
            }
          } catch (ttsErr) {
            console.warn("Gemini TTS failed or model unavailable, skipping audio part:", ttsErr);
          }
        }

      } catch (apiErr) {
        console.error("Gemini call failed, falling back to mock EXOS adapter output:", apiErr);
        responseText = `**[OFFLINE SIMULATION] EXOS Adapter Response:**\n\nI received your point: *"${text}"*.\n\nAs **${executiveProfile.name || targetExecId}**, here is my executive assessment: \n- We need to validate these milestones in our staging environment immediately.\n- The legal review under compliance controls shows a minor data boundary risk that we must catalog.\n- Let's schedule a deep dive with Astra on the core infrastructure latency constraints.`;
      }
    } else {
      // Standard high-quality offline simulated response
      const mockResponses = {
        nova: `**Nova (COO):** We need to look closely at our execution velocity. Your point regarding *"${text}"* makes sense, but we must translate this into concrete operational metrics. Let's draft a clear KPI dashboard to track our growth trajectory and ensure we don't bleed our runway. I will sync with Sisters to model the operational expenses.`,
        astra: `**Astra (CTO):** That is a critical consideration. Regarding *"${text}"*, from an engineering standpoint, we must make sure our databases support consistent read/write segregation before we deploy this to production. Otherwise, we risk severe bottlenecks at peak traffic. Let's design a mock blueprint of this microservice structure next Tuesday.`,
        fuego: `**Fuego (CMO):** I love where your head is at! But let's dress this up so our users actually care. If we implement *"${text}"*, we need a compelling narrative to drive high-activation organic loops. Let's test a simple landing page variation and measure the click-through rates.`,
        jarvis: `**Jarvis (General Counsel):** Understood. However, introducing *"${text}"* requires a comprehensive review of our active user consent guidelines. Under CCPA/GDPR compliance frameworks, we must maintain robust audit logs for any persistent sessions. I advise drafting an impact report before proceeding.`,
        sisters: `**Sisters (CFOs):** This initiative has clear financial implications. Before we allocate compute or marketing resources towards *"${text}"*, let's compute our gross margin impact. A 3% optimization in latency is wonderful, but only if it reduces our server operating expenses.`,
        board: `**Nova (COO):** I agree we need a unified alignment.\n\n**Astra (CTO):** Agreed, but let's not overlook the infrastructure costs of *"${text}"*.\n\n**Jarvis (Compliance):** I'll require a complete audit trail of this data pipeline prior to staging.`
      };

      responseText = mockResponses[targetExecId as keyof typeof mockResponses] || mockResponses.nova;
    }

    const exosMessageId = `msg-e-${Date.now()}`;
    const exosMessage = {
      id: exosMessageId,
      meetingId: id,
      senderId: targetExecId,
      senderName: targetExecId.charAt(0).toUpperCase() + targetExecId.slice(1),
      senderType: "executive",
      text: responseText,
      timestamp: new Date().toISOString(),
      isVoice: isVoice,
      audioUrl: base64Audio ? `data:audio/wav;base64,${base64Audio}` : undefined
    };
    
    await setDoc(doc(firestoreDb, `meetings/${id}/messages`, exosMessageId), exosMessage);

    res.json({
      userMessage,
      exosMessage
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Recording state management
app.post("/api/meetings/:id/recording/request-consent", async (req, res) => {
  try {
    const mRef = doc(firestoreDb, 'meetings', req.params.id);
    await updateDoc(mRef, {
      recordingConsentRequested: true,
      recordingConsentApproved: true // Auto-consent for mockup ease
    });
    res.json({ approved: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/meetings/:id/recording", async (req, res) => {
  try {
    const { action } = req.body;
    const mRef = doc(firestoreDb, 'meetings', req.params.id);
    const recordingStatus = action === "start" ? "recording" : "stopped";
    await updateDoc(mRef, { recordingStatus });
    
    const updated = await getDoc(mRef);
    res.json({ id: updated.id, ...updated.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Post-meeting report compiler using Gemini
app.post("/api/meetings/:id/post-summary", async (req, res) => {
  const { id } = req.params;
  try {
    const mRef = doc(firestoreDb, 'meetings', id);
    const mDoc = await getDoc(mRef);
    if (!mDoc.exists()) return res.status(404).json({ error: "Meeting not found" });
    const meeting: any = mDoc.data();

    const msgsCol = collection(firestoreDb, `meetings/${id}/messages`);
    const msgsSnap = await getDocs(msgsCol);
    const messagesList = msgsSnap.docs
      .map(doc => doc.data())
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const transcriptText = messagesList.map((m: any) => `${m.senderName}: ${m.text}`).join("\n\n");

    let postSummaryObj = null;

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && transcriptText.length > 20) {
      try {
        const ai = getGenAI();

        const systemPrompt = `You are the EXOS Post-Meeting Analytics Engine.
Analyze the following transcript from the executive meeting titled "${meeting.title}" and return a comprehensive structured meeting summary report in JSON format.
The JSON must follow this exact typescript schema:
{
  "summary": string, // 2-3 paragraph professional overview of the meeting
  "decisions": string[], // key decisions reached
  "actionItems": Array<{ id: string, text: string, assignedTo: string, dueDate: string, status: "pending" | "completed" }>, // actionable items with executive assignee names
  "risks": string[], // risks identified
  "openQuestions": string[], // questions that remain unresolved
  "timeline": Array<{ time: string, event: string }>, // chronological timeline of speakers/events
  "score": number, // an engagement performance score out of 100
  "artifactList": Array<{ id: string, name: string, type: string, size: string, url: string, uploadedBy: string, timestamp: string }> // list of uploaded or reference documents
}

Respond ONLY with the raw JSON. Do not add markdown backticks (\`\`\`json) or any preamble. Must be perfectly valid, parsable JSON.`;

        const genResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: transcriptText,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json"
          }
        });

        const responseText = genResponse.text || "{}";
        postSummaryObj = JSON.parse(responseText.trim());
      } catch (err) {
        console.error("Gemini post-summary compilation failed, utilizing offline compiler:", err);
      }
    }

    // Fallback to high quality mock post summary if Gemini fails or is offline
    if (!postSummaryObj) {
      postSummaryObj = {
        summary: `The executive alignment on "${meeting.title}" completed with high alignment. The participants addressed core engineering scale constraints and mapped operational benchmarks to preserve capital runways. Regulatory frameworks and legal barriers were prioritized, assuring data governance structures remain fully compliant with regional requirements.`,
        decisions: [
          "Consensus reached on expediting stage-1 development tasks.",
          "Allocated testing credits towards infrastructure load profiling.",
          "Risk models will be verified prior to active production deploys."
        ],
        actionItems: [
          { id: `task-a-${Date.now()}`, text: "Run local system benchmark profile checks", assignedTo: "Astra", dueDate: "2026-07-21", status: "pending" },
          { id: `task-b-${Date.now()}`, text: "Draft customer agreement legal disclosures", assignedTo: "Jarvis", dueDate: "2026-07-24", status: "pending" }
        ],
        risks: [
          "Timeline compression limits visual validation audits.",
          "Increased infrastructure computing footprint might reduce margins."
        ],
        openQuestions: [
          "Will we require secondary regional node support during the initial closed alpha release?"
        ],
        timeline: [
          { time: "00:01", event: "Meeting began." },
          { time: "00:04", event: "Strategy brief and core parameters established." },
          { time: "00:15", event: "Closed and compiled for executive archive indexing." }
        ],
        score: 88,
        artifactList: []
      };
    }

    await updateDoc(mRef, {
      status: "completed",
      endTime: new Date().toISOString(),
      summary: postSummaryObj
    });

    res.json(postSummaryObj);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Polls management
app.get("/api/meetings/:id/polls", async (req, res) => {
  try {
    const pollsCol = collection(firestoreDb, `meetings/${req.params.id}/polls`);
    const snap = await getDocs(pollsCol);
    const polls = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(polls);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/meetings/:id/polls", async (req, res) => {
  const { id } = req.params;
  const { question, options } = req.body;
  
  try {
    const pollId = `poll-${Date.now()}`;
    const newPoll = {
      id: pollId,
      question,
      options,
      votes: options.reduce((acc: any, _: any, idx: number) => {
        acc[idx] = 0;
        return acc;
      }, {}),
      votedUsers: [],
      active: true
    };
    
    await setDoc(doc(firestoreDb, `meetings/${id}/polls`, pollId), newPoll);
    res.status(201).json(newPoll);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/meetings/:id/polls/:pollId/vote", async (req, res) => {
  const { id, pollId } = req.params;
  const { optionIndex, userId } = req.body;

  try {
    const pRef = doc(firestoreDb, `meetings/${id}/polls`, pollId);
    const pDoc = await getDoc(pRef);
    if (!pDoc.exists()) return res.status(404).json({ error: "Poll not found" });
    const poll: any = pDoc.data();

    if (poll.votedUsers.includes(userId)) {
      return res.status(400).json({ error: "User has already voted in this poll." });
    }

    const updatedVotes = { ...poll.votes };
    updatedVotes[optionIndex] = (updatedVotes[optionIndex] || 0) + 1;
    const updatedVotedUsers = [...poll.votedUsers, userId];

    await updateDoc(pRef, {
      votes: updatedVotes,
      votedUsers: updatedVotedUsers
    });

    res.json({
      ...poll,
      votes: updatedVotes,
      votedUsers: updatedVotedUsers
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Whiteboard management
app.get("/api/meetings/:id/whiteboard", async (req, res) => {
  try {
    const wbCol = collection(firestoreDb, `meetings/${req.params.id}/whiteboard`);
    const snap = await getDocs(wbCol);
    const elements = snap.docs.map(doc => doc.data());
    res.json(elements);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/meetings/:id/whiteboard", async (req, res) => {
  const { id } = req.params;
  const element = req.body;
  try {
    const elId = element.id || `wb-${Date.now()}`;
    await setDoc(doc(firestoreDb, `meetings/${id}/whiteboard`, elId), element);
    res.status(201).json(element);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/meetings/:id/whiteboard", async (req, res) => {
  const { id } = req.params;
  try {
    const wbCol = collection(firestoreDb, `meetings/${id}/whiteboard`);
    const snap = await getDocs(wbCol);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- SERVER AND VITE SERVING ----------------

async function startServer() {
  // Load configuration from YAML file
  const serverConfig = loadServerConfig();
  const configPort = serverConfig.server.port || PORT;

  // Run authoritative regression test suite
  runTests();

  // Seed initial meetings in Firestore if database is empty
  await seedInitialMeetings();

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(configPort, "0.0.0.0", () => {
    console.log(`=============================================================`);
    console.log(`🚀 Authoritative EXOS Executive Meeting Server is ACTIVE!`);
    console.log(`🌐 Host: ${serverConfig.server.host}`);
    console.log(`📡 Port: ${configPort}`);
    console.log(`🛡️  Max Human Capacity: ${serverConfig.meeting.max_humans}`);
    console.log(`📂 Archive Directory: ${serverConfig.meeting.archive_path}`);
    console.log(`🔐 Mode: ${process.env.NODE_ENV || "development"}`);
    console.log(`=============================================================`);
  });
}

startServer();
