---
name: human-voice
description: Write anything the user will send or post under their own name so it reads like they wrote it, structured the way their reader asked. Use for EVERY Slack message, DM, reply, email, ticket comment, PR description or status update drafted for them, including ones inside another task ("ask X to merge", "reply to Y", "mail Z"). Triggers on draft, reply, message, ping, send to, mail, email, tell <person>, PR description, work update, status update, standup, "let the team know", "make it sound human", "it got flagged as AI".
---

# Human voice

Two jobs, in this order: **structure the message the way the reader asked for it**, then **make it sound like the user**. A clear, well-shaped update is what readers reward. Sounding human is the second pass, not the first.

## 0. Load the profile

Read `~/.claude/human-voice/profile.md` before drafting. It holds who the user writes to, how they address each person, their habits, real typed samples, and updates that landed. It is personal and stays outside this repo. If it doesn't exist, ask the user for 3–5 messages they typed themselves and create it.

## 1. Read the thread first

Read the conversation you're replying into (Slack thread, email chain, PR). Note:
- **What exactly was asked, and in what order.** If the asker numbered their questions, the reply answers them in that order, one block (or one message) per question.
- **How the user has written to this person before.** Only the user's own messages count. Their messages that were clearly assistant-drafted (bold, headers, perfect bullets) don't.

## 2. Draft the structure (facts pass)

Write the content with every fact, number, ticket and link correct. Shape for status updates:

```
<heading in the asker's words>   <- one line, lowercase is fine
1. <thing> - done
2. <thing> #<PR> - in pr review
3. <thing> <TICKET> - in progress
4. <thing> <TICKET> - todo
```

- Answer = status first, then the item, then the ticket or PR. The reader knows in 10 seconds what's done, what's pending and whether they must act.
- Group with a short plain label in the user's words, e.g. `reminder drafts: (FLOW 1)`. No markdown headers, no bold.
- End with an explicit ask if there is one (`asks: review + merge #821-#828`). No ask, no closing line.
- No background nobody asked for, no summary, no reassurance.

## 3. Voice pass (a separate model call)

Hand the draft to a **fresh subagent** that has not seen your reasoning, with only:
- the draft,
- the profile's typed samples and the update that landed,
- the thread being replied to.

Instruction: *rewrite in this person's register: their casing, their word choices, their message length, their way of splitting into several messages. Keep every fact, number, ticket and link exactly. Keep the structure from the draft.* A fresh context matters: the drafting agent's own phrasing leaks into anything it edits itself.

What the voice pass must **not** do:
- **No invented typos or grammar errors.** Pangram 4's humanizer head is built to flag deliberate typo injection, casing tricks and homoglyphs, and it labels them "humanized", which reads worse than plain AI. Real slips come from the user typing, never from us (`pangram-evidence.md`).
- No paraphrase loops or detector-guided rewrites. On Pangram 4 they barely move the score and they degrade the content.
- No change to any fact. Commercial humanizers pass detectors by changing what the text says (51–94% of outputs, by their own counts).

## 4. Leave the human part to the human

On Pangram 4 a message reads Human only when ~90% of its characters are human-typed. So the deliverable is **the structure plus a gap for the user**:
- Mark one line for them to write themselves, e.g. the aside under the heading ("below list is based on how X sent the issues"). That line is where their real voice shows.
- Under ~50 words (single quick replies): write it fully in their voice; Pangram treats short chat as out of scope.
- Longer than that and it must not flag? Give **notes**, fragments separated by `·` in the order they'd say them, and the line: "type this in your words, don't paste it".
- Editing the user's own text: spelling and grammar only, never reword.

## 5. Draft, don't send

Use the messaging tool's draft action. Messages sent through a connector usually carry a "sent using" footer; say so if the user asks you to send.

## Never

Markdown headers or bold in chat, em dashes, `→` arrows, curly quotes typed by you, groups of three for rhythm, "not X but Y", trailing "-ing" commentary, a closing summary, chatbot openers, and words like delve, crucial, robust, seamless, leverage, ensure, additionally, "worth noting", "in short", "hope this helps".

## Files

- `pangram-evidence.md`: what does and doesn't get assistant-written text past Pangram 4, with sources.
- `~/.claude/human-voice/profile.md`: the user's own profile. Local only.
