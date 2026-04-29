# Interview Agent Design Spec

## Overview

An agent-driven interactive user interview system that transforms traditional form-based surveys into natural conversations. Users share their product experience by chatting with an AI agent that feels like talking to a friend, rather than filling out a questionnaire.

### Problem Statement

1. Traditional survey forms are boring and lack interaction
2. Predefined answer options often miss what users actually think
3. Users disengage before completing long questionnaires

### Solution

An AI interview agent that conducts natural conversations with users, covering core research topics while allowing free-form exploration. The agent uses tool calling to manage interview state and extract structured data in real-time.

### Scope

- MVP: Single product user experience research
- Future: Multi-project platform for any product's UX research

---

## System Architecture

```
┌─────────────┐     HTTP/API     ┌─────────────┐     SDK      ┌─────────────┐
│   Frontend   │ ◄──────────────► │   Backend    │ ◄──────────► │  LLM Provider│
│   (React)    │                  │  (Node.js)   │              │  (DeepSeek/  │
│              │                  │              │              │   Qwen/etc)  │
└─────────────┘                  └──────┬───────┘              └─────────────┘
                                        │
                                        │ ORM
                                        ▼
                                 ┌─────────────┐
                                 │   Database    │
                                 │ (SQLite/PG)   │
                                 └─────────────┘
```

### Components

| Component | Responsibility |
|-----------|---------------|
| **InterviewAgent** | Core conversation engine. Manages interview flow, decides when to ask follow-up questions, switch topics, or call tools. |
| **ToolExecutor** | Executes tool calls from the agent (record insights, mark topics, extract annotations). |
| **PromptBuilder** | Dynamically assembles system prompt from project config (product context, core topics, style guide). |
| **ConversationManager** | Manages conversation history, context window, message persistence. |
| **API Server** | Express.js REST API for interview lifecycle and chat messages. |

---

## Interview Flow

### User Journey

1. **Access Link** — User clicks a shared interview link
2. **Landing Page** — Brief introduction, estimated duration (10-15 min), "Start" button
3. **Agent Greeting** — Agent introduces itself casually, naturally opens the first topic
4. **Conversation Loop** — User shares → Agent decides → Tool calls → Repeat
5. **Natural Ending** — Core topics covered and user has nothing more to add, or user requests to stop
6. **Completion** — Thank user, optionally show conversation summary

### Agent Decision Loop

Each turn, the agent:
1. Receives user message
2. Decides action: ask follow-up? switch topic? record insight? extract annotation?
3. Optionally calls one or more tools
4. Generates response to user

### Ending Conditions

- All core topics have been discussed (at least partial coverage)
- User has expressed themselves fully on each topic
- User explicitly asks to stop (e.g., "就这些吧", "没什么要补充的了")
- Conversation exceeds reasonable length (>30 messages)

---

## Agent Tools

The agent has 4 tools available via tool calling:

### `record_insight`

Records a key insight from the user.

```json
{
  "topic": "search experience",
  "insight": "User finds search results inaccurate, often can't find what they need",
  "emotion": "frustrated",
  "quote": "每次搜出来的都不是我想要的"
}
```

### `mark_topic_covered`

Marks a core topic as discussed.

```json
{
  "topic_id": "search_experience",
  "coverage": "partial",  // "partial" | "full"
  "notes": "User expressed dissatisfaction with search results, but didn't discuss improvement direction"
}
```

### `extract_annotation`

Extracts structured annotation from the conversation.

```json
{
  "category": "pain_point",  // "pain_point" | "feature_request" | "positive_feedback" | "usage_pattern"
  "label": "Search inaccuracy",
  "severity": "high",  // "low" | "medium" | "high"
  "context": "User mentioned search results not matching expectations multiple times"
}
```

### `end_interview`

Agent signals the interview can end.

```json
{
  "reason": "Core topics covered, user has no more to add",
  "summary": "User primarily reported issues with search experience and page load speed..."
}
```

---

## Prompt Design

The system prompt is dynamically assembled by `PromptBuilder` from four modules:

### Module 1: Role & Style

```
You are a friend chatting with the user. Your goal is to understand their experience with {product_name}.
- Tone: warm, natural, conversational
- Never say "I'm an AI" or "this is an interview"
- Use colloquial expressions, casual language
- Use filler words naturally (嗯、哈哈、确实)
```

### Module 2: Product Context

```
Product: {product_description}
Key features: {feature_list}
Target users: {target_user_segment}
```

### Module 3: Core Topics

```
Topics to explore (order is flexible):
1. {topic_1} — {description}
2. {topic_2} — {description}
3. {topic_3} — {description}

Each topic needs at least one in-depth discussion. Don't interrogate — let conversation flow naturally.
```

### Module 4: Behavioral Instructions

```
Conversation strategy:
- After user shares a point, empathize first, then ask follow-up
- Use "why", "can you give an example", "what happened next" to go deeper
- If user brings up unexpected points, follow their lead
- When a topic is well-covered, naturally transition to the next
- If user clearly wants to stop, respect that and wrap up

Tool usage:
- Call record_insight when key insights emerge
- Call mark_topic_covered when a core topic is sufficiently discussed
- Call extract_annotation when classifiable information appears
- Call end_interview when the interview can conclude
```

---

## Data Model

### projects

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | string | Project name |
| product_context | text | Product description for prompt |
| core_topics | JSON | List of core topics with descriptions |
| style_guide | JSON | Conversation style config |
| created_at | timestamp | Creation time |

### interviews

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | FK to projects |
| share_token | string | Unique token for share link |
| status | enum | in_progress / completed / abandoned |
| started_at | timestamp | Start time |
| ended_at | timestamp | End time |

### messages

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| interview_id | UUID | FK to interviews |
| role | enum | user / assistant / system |
| content | text | Message content |
| tool_calls | JSON | Tool call records (if any) |
| created_at | timestamp | Send time |

### annotations

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| interview_id | UUID | FK to interviews |
| message_id | UUID | FK to messages (optional) |
| category | string | pain_point / feature_request / positive_feedback / usage_pattern |
| label | string | Tag label |
| severity | enum | low / medium / high |
| quote | text | User's original words |
| created_at | timestamp | Creation time |

---

## Frontend Design

### Chat Interface

Minimal chat bubble interface. No progress bar, no topic labels. The conversation feels like chatting with a friend.

- **Message bubbles** — Agent messages left-aligned with avatar, user messages right-aligned
- **Input area** — Text input at bottom with send button
- **No visible structure** — No progress indicators, topic lists, or questionnaire-like elements

### Pages

1. **Landing Page** — Project intro, estimated duration, start button
2. **Chat Page** — Main conversation interface
3. **Completion Page** — Thank you message, optional summary display

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React |
| Backend | Node.js + Express |
| Database | SQLite (MVP), PostgreSQL (future) |
| LLM | DeepSeek / Qwen (domestic Chinese models) |
| Transport | HTTP REST (MVP), WebSocket (future for streaming) |

---

## API Design

### `POST /api/interview/create`

Create a new interview for a project. Returns interview ID and share link.

### `GET /api/interview/:token`

Get interview status and metadata by share token.

### `POST /api/chat`

Send a user message, receive agent response. Request body:

```json
{
  "interview_id": "uuid",
  "message": "user's message"
}
```

Response:

```json
{
  "response": "agent's reply",
  "tool_calls": [...],
  "interview_status": "in_progress"
}
```

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| LLM API timeout | Retry once, then show user a friendly message and save conversation state |
| LLM API rate limit | Queue requests, show typing indicator to user |
| Tool call fails | Agent continues conversation, logs error for review |
| User sends empty/invalid input | Client-side validation, don't send to API |
| Interview abandoned (user leaves) | Auto-mark as abandoned after 10 min inactivity |

---

## Success Criteria

- Users complete interviews at >60% rate (start to finish)
- Average interview duration: 8-15 minutes
- Agent covers all core topics in >80% of interviews
- Structured annotations are extractable from >90% of completed interviews
- User feedback on experience: "felt like a conversation, not a survey"
