# Product Requirements Document (PRD)

> **Project:** Civix-Pulse — Agentic Governance & Grievance Resolution Swarm
> **Team:** Vertex
> **Version:** 1.0
> **Status:** Active Development

---

## 1. Executive Summary

Civix-Pulse is a multi-agent AI platform that transforms public grievance resolution from a reactive, ticket-based bureaucracy into an intelligence-driven governance system. It autonomously ingests citizen complaints across modalities (voice, text, handwritten letters), identifies systemic root causes through cross-complaint correlation, and resolves issues by directly interfacing with government portals — without requiring API access.

---

## 2. Problem Statement

### 2.1 The Current State

India's public grievance ecosystem processes over **30 lakh complaints annually** across platforms like CPGRAMS, PG Portal, and state-level portals. The current workflow is fundamentally broken:

- **Average resolution time:** 16 days.
- **Siloed departments:** A water complaint and an electricity complaint in the same ward are processed by different departments with zero cross-referencing.
- **No root-cause detection:** 50 individual "low water pressure" complaints are treated as 50 separate tickets, never traced back to a single failing pump station.
- **Exclusion by design:** Citizens who cannot read, write, or navigate web portals are structurally excluded from the system.
- **Zero accountability enforcement:** SLA breaches carry no automatic consequences.

### 2.2 The Gap

Existing civic-tech solutions digitize the complaint box but do not reimagine it. They add a web form in front of the same manual routing, manual resolution, and manual closure process. No commercially available platform offers:

1. **Cross-complaint intelligence** — semantic clustering to surface systemic patterns.
2. **Autonomous resolution** — a computer-use agent that files work orders on government portals without API integration.
3. **Governed accountability** — automatic legal appeal generation and compensation triggers on SLA breach.
4. **Voice-first multilingual intake** — removing the literacy barrier with regional language speech-to-text.

---

## 3. Target Users

| Persona | Description | Pain Point |
|---|---|---|
| **Citizen** | Any resident filing a grievance (text, voice, letter, or passively via sensing) | Cannot navigate portals; never hears back; complaint ignored as one of thousands. |
| **Ward Officer** | Field-level government employee responsible for resolving issues | Overwhelmed with duplicates; no prioritization intelligence; manual paperwork. |
| **Department Head** | Senior official overseeing a municipal department (water, roads, electricity) | No systemic view; cannot identify infrastructure failures from individual tickets. |
| **Municipal Commissioner** | City-level executive responsible for governance outcomes | Lacks real-time dashboards; no predictive capability; reactive by default. |

---

## 4. Product Objectives

| # | Objective | Success Metric |
|---|---|---|
| O1 | Reduce average grievance resolution time | Target: < 72 hours (from 16 days) |
| O2 | Detect systemic infrastructure failures automatically | ≥ 80% of clustered complaints correctly traced to root cause |
| O3 | Enable voice-first, multilingual intake | Hindi and English voice complaints processed end-to-end |
| O4 | Achieve autonomous portal filing | ≥ 90% success rate on mock government portal |
| O5 | Enforce SLA accountability | 100% of breached SLAs trigger auto-escalation |

---

## 5. Functional Requirements

### 5.1 Multimodal Ingestion

- **FR-1:** The system shall accept grievances via text (web form), voice (WhatsApp), and scanned handwritten letters (OCR).
- **FR-2:** Voice complaints in Hindi shall be transcribed using Bhashini STT and translated to English for downstream processing.
- **FR-3:** Handwritten letters shall be processed via OCR and converted to structured JSON.
- **FR-4:** All intake channels shall converge into a unified complaint schema.

### 5.2 Intelligent Triage

- **FR-5:** Every complaint shall be scored using an Impact Matrix combining severity, blast radius, vulnerability, sentiment, and time-decay.
- **FR-6:** Vulnerable demographics (elderly, disabled, low-income) shall receive priority modifiers.
- **FR-7:** The Priority Agent shall emit a structured reasoning trace for every scoring decision.

### 5.3 Systemic Analysis

- **FR-8:** The system shall perform semantic similarity search across all complaints using vector embeddings.
- **FR-9:** Near-duplicate complaints shall be auto-merged into clusters with a representative summary.
- **FR-10:** The Systemic Auditor shall generate root-cause hypotheses linking complaint clusters to infrastructure assets.
- **FR-11:** Root-cause findings shall be visualized as a force-directed knowledge graph with collapse animations.

### 5.4 Autonomous Resolution

- **FR-12:** The Resolution Agent shall use a computer-use agent (Browser-Use + Playwright) to fill and submit work-order forms on government portals.
- **FR-13:** Every browser session shall be recorded as a Playwright trace for audit purposes.
- **FR-14:** Field officers shall be auto-assigned based on ward, department, and current workload.
- **FR-15:** Verification photos submitted by officers shall be analyzed by a vision model to confirm resolution.

### 5.5 Accountability & Compliance

- **FR-16:** On SLA breach, the system shall auto-generate a Right-to-Services Commission appeal as a downloadable PDF.
- **FR-17:** A mock UPI compensation notification shall be triggered on SLA breach.
- **FR-18:** The Policy RAG engine shall auto-cite relevant government policies, RTI acts, and municipal bylaws for each complaint.

### 5.6 Accountability & Compliance

- **FR-19:** On SLA breach, the system shall auto-generate a Right-to-Services Commission appeal as a downloadable PDF.
- **FR-20:** A mock UPI compensation notification shall be triggered on SLA breach.
- **FR-21:** The system shall track Time-to-Resolution metrics per department for executive reporting.

---

## 6. Non-Functional Requirements

| # | Requirement | Specification |
|---|---|---|
| NFR-1 | **Performance** | API response time < 500ms for CRUD operations; agent pipeline < 30s end-to-end. |
| NFR-2 | **Scalability** | Architecture must support horizontal scaling of agent nodes via container orchestration. |
| NFR-3 | **Audit Trail** | Every agent decision must be logged with inputs, logic, outputs, and confidence scores. |
| NFR-4 | **Data Governance** | All citizen PII must be encrypted at rest; access must be role-gated. |
| NFR-5 | **Accessibility** | Voice-first intake; no literacy requirement for complaint submission. |
| NFR-6 | **Local Deployment** | Full stack must run on a single machine (8GB RAM, 4-core CPU) via Docker Compose. |

---

## 7. Out of Scope (v1)

- Real UPI payment integration.
- Production WhatsApp Business API (sandbox only).
- Multi-city deployment.
- Formal causal inference (system produces hypotheses, not proofs).

---

## 8. Social Impact Thesis

Civix-Pulse is not a better complaint portal. It is a **governance operating system** that:

1. **Includes the excluded** — voice-first intake in regional languages removes the literacy barrier.
2. **Connects the disconnected** — cross-complaint intelligence breaks departmental silos.
3. **Penalizes the unaccountable** — auto-appeal and compensation mechanisms make SLA breaches costly.
4. **Automates the impossible** — browser agents file on portals that have no API.
5. **Scales the unscaleable** — AI agents handle the volume that human bureaucracies cannot.

> *"We don't route tickets. We detect, file, resolve, and penalize."*

---

## 9. References

- [Feature Roadmap](features.md) — Tier-wise feature breakdown with build order.
- [Technical Requirements](TRD.md) — Scalability, data governance, and compliance specifications.
- [Architecture](ARCHITECTURE.md) — System design and data flow diagrams.
