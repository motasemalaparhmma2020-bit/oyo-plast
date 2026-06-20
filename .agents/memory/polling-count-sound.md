---
name: Sound/alert on a polling query count
description: How to chime only on real increases of a polled count without firing on initial mount.
---

When you want a sound/alert to fire when a polled value (e.g. unread-notifications count)
**increases**, do NOT simply compare against a ref initialized to 0 — React Query resolves
the first real value after mount, so an existing count (e.g. 5) reads as "0 → 5" and chimes
on every page load.

**Why:** the initial render has `data === undefined` (or default 0), then the query resolves;
naive `count > lastRef` treats that first resolution as a new event.

**How to apply:** gate on the query's loaded state. Skip while `data === undefined`; on the
first defined value set the baseline ref silently (via an `initedRef`), and only play the
sound on subsequent increases. Also respect a persisted on/off toggle and (for Web Audio)
resume the AudioContext on a user gesture since browsers block autoplay.
