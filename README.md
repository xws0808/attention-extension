# Focus Coach: An Attention-Training Chrome Extension

## Overview
This is Phase 2 of a two part project. Phase 1 was a SQL based research investigation into why attention spans while watching short form and online video appear to be shrinking. My research pointed to a clear, specific root cause: platform interface mechanics, especially autoplay and algorithmic momentum, drive skip and disengagement behavior more than content length or category does. Phase 2 is a Chrome extension that acts directly on that finding. Rather than blocking or restricting YouTube, it trains sustained attention through a gamified, progressively increasing focus target, the same progressive overload principle used in fitness training, applied here to attention instead of muscle.

Research repo: [\[link to Phase 1 repo\]](https://github.com/xws0808/attention-span-sql-project)

## The Core Idea
Most focus tools either block access entirely or passively track usage. Neither actually trains anything. Focus Coach instead sets a personal focus target based on your own recent viewing behavior, shows a small progress ring while you watch, and gently interrupts, never blocks, early skips or speed changes with a two second pause and nudge. Hit your target enough and the target itself increases, mirroring how a training plan gradually raises the bar as you improve.

## How Features Map to Phase 1 Research

| Feature | Phase 1 Finding It Addresses |
|---|---|
| Autoplay suppression | Finding 2 and 3: platform mechanics, not content, were shown to be the dominant driver of completion behavior. Autoplay is one of the clearest examples of that mechanism. |
| Soft pause nudge on early skip/speed change | Directly targets the skip and 2x speed habit described in the original research motivation, the actual behavior being measured throughout Phase 1. |
| Progressive, history based target calculation | Modeled on progressive overload, applied here since Phase 1 established that the behavior in question is trained by the platform environment, and can plausibly be retrained the same way. |
| Short form starting target of about 30 seconds | Rounded from Phase 1's own measured weighted average continuous watch time of 21.66 seconds across 48,079 short form videos (see `sql/01_duration_vs_completion.sql` in the research repo). |
| User selected long form starting target | Phase 1 only studied short form content. Rather than assume a long form number without evidence, the extension asks the user to choose, and is explicit that this preset is an estimate, not research backed. |

## Tech Stack
- **JavaScript**, Chrome Extension Manifest V3
- **chrome.storage.local** for all data persistence, fully local, nothing leaves the device
- **HTML/CSS** for the popup dashboard and in page overlay
- No external servers, accounts, or analytics

## Features
- Passive and active tracking of continuous watch time per video
- Visual progress ring overlaid on the YouTube player
- Soft pause nudge (not a hard block) when attempting to skip or speed up before reaching target
- Native YouTube autoplay suppression, routing automatic next video transitions through the same nudge system as manual skips
- Progressive target calculation from a rolling average of the last 10 sessions, capped to avoid unreasonable jumps
- Snooze controls (per video or one hour) that pause nudges while still logging data silently in the background
- Dashboard: current streak, level, today's session count, and a 7 day trend chart
- User selectable initial target (short form or long form preset, or a custom value) so the extension can honestly serve two different viewing habits instead of assuming one

## Design Principles
- **Never block, only pause.** Every intervention is a brief, dismissible pause, never a hard restriction. This was a deliberate choice based on the reasoning that heavy handed friction tends to get a tool disabled rather than build a habit.
- **Passive logging continues even when snoozed or nudges are dismissed**, so the data used for target calculation stays complete regardless of how actively you're engaging with the training in the moment.
- **All data stays local.** No account, no server, no analytics. This was a simplicity choice as much as a privacy one.

## Known Limitations
- Autoplay suppression relies on a specific YouTube DOM class name (`ytp-autonav-toggle-button`) that YouTube controls and could change or rename without notice. This is a real fragility of building on top of a platform without an official API for this behavior.
- The 30 second short form starting target is grounded in Phase 1 research. The long form preset (2 minutes) and any custom value are reasonable estimates, not directly evidenced by the research, since Phase 1 did not study long form content.
- Continuous watch time is used as a proxy for sustained attention. It is a measurable behavioral signal, not a claim about attention in a neurological sense.
- Currently YouTube only. TikTok and Instagram Reels were considered but out of scope for this phase, due to more aggressive anti extension DOM obfuscation on those platforms.
- Single user, local only. There is no cross device sync.

## How to Install (Development Mode)
1. Clone this repo
2. Go to `chrome://extensions`
3. Enable Developer mode (top right)
4. Click **Load unpacked**, select this repo's folder
5. Open YouTube, on first use the popup will prompt you to choose a starting target

## What's Next
Real, sustained daily use to validate whether the progressive target actually shifts behavior over time, the same kind of before and after evidence Phase 1 applied to public data.

## Author
Hailey Xu, Informatics student, University of Washington
[LinkedIn](www.linkedin.com/in/haileyxu0808) · [GitHub](https://github.com/xws0808)