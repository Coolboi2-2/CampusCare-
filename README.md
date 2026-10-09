# CampusCare — Smart Campus Issue Reporting & AI-Assisted Resolution

> **Report it. Route it. Resolve it. Verify it.**

CampusCare is an AI-powered campus maintenance platform where students report problems using photos and natural language. Gemini 3.8 Flash helps interpret each report, create a structured work order, recommend the appropriate department, and compare before-and-after repair photos. Staff manage the actual work, while uncertain cases are escalated for human review.

---

## 1. Core Philosophy & Differentiator

Unlike traditional ticketing apps that only record complaints:
1. **Report Naturally**: Students upload a photo and describe the problem in conversational language. No technical fault diagnosis required.
2. **Understand with AI**: Gemini 3.8 Flash extracts the issue type, visible observations, suggested priority, and recommended department.
3. **Route & Track**: Deterministic routing rules dispatch tickets to specialized department queues (Plumbing, Electrical, Carpentry, Cleaning, HVAC, General) with complete audit timestamps.
4. **Verify the Outcome**: The model compares original and repair photos, identifies visible changes, detects remaining concerns, and recommends resolution confirmation or human escalation.

---

## 2. Three Role-Based Portals

- **Student Portal**:
  - Submit photo & text incident reports with campus location hierarchy (Zone > Building > Floor > Room).
  - Receive unique ticket IDs (e.g., `CC-2026-1042`).
  - Track progress with a real-time status timeline.
  - Review side-by-side photographic evidence and confirm resolution or request reopening.

- **Maintenance Portal**:
  - Department-specific work queues (Plumbing, Electrical, Cleaning, Carpentry, HVAC, General).
  - Accept work orders and transition status (`in_progress`).
  - Log technician diagnostic notes and upload after-repair photo evidence.
  - Submit for automated AI Before/After Verification.

- **Admin / Warden Dashboard**:
  - Campus-wide operations overview with live KPI counters (Active Orders, Awaiting Verification, Escalated/Human Review, Resolution Rate %).
  - Department load & workload distribution bars.
  - Master filterable table with full audit trail history and evidence archives.
  - Reassign departments and handle safety flags.

---

## 3. The 90-Second Demo Walkthrough

Launchable via the **"⚡ 90s Demo Tour"** button in the navigation header:
1. **0–15s — Report**: Student reports washbasin leak with before photo: *"Water is leaking under the sink washbasin in Oak Hall Room 308."*
2. **15–30s — Analyze**: CampusCare displays the model's observations, suggested category, priority, and recommended Plumbing queue.
3. **30–45s — Assign**: Ticket `CC-2026-1042` is routed; technician Marcus Vance accepts the work order.
4. **45–65s — Repair**: Technician updates status to *In Progress*, repairs the P-trap gasket, and uploads the after-photo.
5. **65–80s — Verify**: The model compares Before and After photos, detects visible changes (*"P-trap seated, cabinet floor dry"*), and reports evidence quality and remaining concerns.
6. **80–90s — Resolve**: Student confirms resolution or tests the reopen flow if issues remain.

---

## 4. Technical Architecture

- **Frontend**: React 19 SPA, Tailwind CSS, Lucide icons, responsive role-based portal navigation.
- **Backend**: Express on Node.js 22, TypeScript, full REST API (`/api/tickets`, `/api/tickets/analyze`, `/api/tickets/:id/repair`, `/api/tickets/:id/resolve`, `/api/tickets/:id/reopen`, `/api/departments`, `/api/analytics`).
- **AI Integration**: `@google/genai` TypeScript SDK (`gemini-3.8-flash`) with server-side multimodal prompt engine and deterministic fallback analyzer for 100% offline hackathon reliability.
- **Port**: `3000` (host `0.0.0.0`).
