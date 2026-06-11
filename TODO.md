1. The logged-out home page sells nothing

  StoryMenuUnauthorized (StoryMenu.tsx:239) renders the header "My Stories" (which a visitor doesn't have) and three CTAs
  that all bounce to /login, then a bare story list. There's no tagline, no screenshot of the reading view, nothing
  explaining "tap any word for an instant explanation" — even though anonymous users can read curated stories and use the
  explain popup (useWordExplainQuery works without auth). That's your free demo and it's invisible.

  - Add a short hero: one sentence of value prop + "try a story, tap any word" pointing at the curated list.
  - Rename the header for logged-out users, and put the curated stories above the login-gated CTAs — the readable content
  is what hooks people, the generate button just hits a wall.

  2. The tap-a-word feature is undiscoverable

  Words in SentenceView look like plain prose; the only affordance is a hover highlight, which doesn't exist on mobile.
  This is the product's "aha" moment and most users will never find it. A one-time coach mark on first story open ("👆
  Tap any word to see what it means"), dismissed and persisted to localStorage, is cheap and probably the single biggest
  activation win.

  3. Login walls lose the user's context and momentum

  Three compounding issues:

  - Selections are discarded. On /generate, a logged-out user picks level/moods/topics, taps the button →
  navigate("/login") and everything is gone. After login, LoginPage always does navigate("/") (LoginPage.tsx:91-95) — not
  even back to /generate. Same for scan/upload and for "save word" inside the popup. Fix: pass a returnTo (router state
  or query param) and restore it after auth; persist the generate selections in localStorage or let them survive via
  state.
  - Ask for signup at the moment of value, not before. Consider letting an anonymous user generate one story
  (rate-limited by IP or an anonymous Firebase session) and gate the second one behind signup — "Sign up free to save
  this story and make more." Signup right after a personalized payoff converts far better than a wall before it.
  - No password reset. There's no "Forgot password?" link and no sendPasswordResetEmail flow anywhere. A user who forgets
  their password is permanently locked out — that's lost subscribers. This is a must-have before any paid plan.

  4. Nothing builds a return habit — and habit is what people pay for

  Subscription language apps convert on retention loops, and the app currently has none:

  - No reading progress. Stories don't remember scroll position or read/unread state; there's no "Continue reading" entry
  at the top of the home page. Cheap version: store last story + scroll offset in localStorage.
  - My Dictionary is a dead end. Saved words just sit in a paginated list (MyDictionaryView.tsx). A review mode — even a
  simple "flip card, did you remember it?" with naive spaced repetition over saved words — turns saving words from a
  bookmark into a daily ritual. This is also your most natural premium feature (free: save words; paid: review/SRS, or
  higher word cap than the current 1000).
  - No audio. For a language product, TTS of sentences/words (tap the speaker icon in the explain popup) is both the
  most-requested feature in this category and the canonical paid-tier differentiator, since it has real per-use cost.
  - Daily hook content. A "Story of the day" at your level costs you one generation per language pair per day and gives
  users a reason to open the app daily.

  5. Prepare the metering before the paywall exists

  Limits already exist (1000 saved words, presumably generation quotas) but they're invisible until an error fires
  (SAVE_WORD_LIMIT_ERROR shows only at the moment of rejection). For future conversion:

  - Show usage where it accrues: "12 / 1000 words saved", "2 free stories left this month" on the generate button.
  Visible meters set expectations and create the upgrade moment — the user who sees "1 story left" is the one who clicks
  "Upgrade".
  - Add an account page now (the avatar dropdown has only Dictionary/Logout). Even if it just shows email and usage
  today, it's the future home of Plan/Billing, and shipping it early means the upgrade button later lands in a place
  users already know.
  - Instrument analytics now (you have reportWebVitals but seemingly no product analytics). You'll want funnel data —
  visit → read story → tap word → signup → generate — before pricing decisions, and you can't backfill it.

  6. Generation UX: don't block the user for a minute

  ProgressOverlay is a full-screen, non-dismissable modal for generate/scan/upload. If generation takes tens of seconds,
  that's a long forced wait staring at an animation — and an abandoned tab. Better: kick off the job, return to the story
  list with a pending placeholder card ("Your story is being written…"), and let them read something else meanwhile.
  This needs backend support (job status polling), but it also removes the current weakness that closing the tab orphans
  the result.

  7. Shareability and acquisition polish

  - public/index.html has a broken meta tag — <meta name="Polypup" content="..."> should be name="description" — no Open
  Graph/Twitter tags, and a static <title>Polypup</title> never updated per story. Shared story links (your only organic
  growth channel — stories have public URLs!) render with no title or preview. Set document.title and OG tags per story;
  a "share this story" button on StoryView is nearly free since curated stories are public.
  - index.html references logo192.png for apple-touch-icon, but public/ only contains favicon.ico — the icon link is
  broken and the manifest only has a 64px favicon, so "Add to Home Screen" looks bad. For a mobile reading app, a proper
  PWA icon set is worth the 30 minutes.
  - Loading states are bare text ("Loading…"). Skeleton cards for the story list and story view would make the app feel
  notably faster.

  What I'd do first

  If I were sequencing: (1) logged-out home hero + tap-to-explain coach mark (activation), (2) returnTo after login +
  forgot-password (stops bleeding users at the wall), (3) continue-reading + dictionary review mode (retention, and the
  future premium hook), (4) usage meters + account page (subscription scaffolding). Items 1, 2 and the meta/icon fixes
  are small; the review mode and non-blocking generation are real features.

  Want me to start on any of these? I'd suggest the activation pair (hero + coach mark) or the login returnTo + password
  reset as the first PR.







  Home page:

  Here's how I'd design it. The organizing principle: each state has exactly one conversion event you're optimizing for —
  unregistered → first "aha" then signup, free → habit then hitting a visible limit, subscribed → daily return (churn
  prevention). Everything on the page should serve that event, in priority order from the top.

  1. Unregistered — goal: deliver the "aha" before asking for anything

  The mistake to avoid (and what the page does today) is leading with login-gated CTAs. An anonymous visitor can already
  read curated stories and tap words — that is your demo. Sell with it.

  ┌────────────────────────────────────────┐
  │ Polypup            [Log in] [Sign up]  │
  ├────────────────────────────────────────┤
  │ Learn German by reading stories        │
  │ you actually enjoy.                    │
  │ Tap any word for an instant            │
  │ explanation — try it below. ↓          │
  │                                        │
  │ I speak [English ▾]  learning [German ▾]│
  │                                        │
  │ ── Start reading (free) ──────────────│
  │ [A1] Der kleine Hund    The little dog │
  │ [A1] Im Café            At the café    │
  │ [B1] ...                               │
  │                                        │
  │ ── Or create your own ────────────────│
  │ [✨ Generate a story about anything]   │
  │ [📷 Scan]  [✏️ Paste text]             │
  └────────────────────────────────────────┘

  - One-sentence value prop + the tap-a-word promise, immediately above real stories. The hero's job is to get them into
  a story within 5 seconds, not to describe features.
  - Inline language pair picker in the hero, not hidden behind the settings gear. Picking "I'm learning German" is itself
  a micro-commitment that raises conversion, and it personalizes the story list below.
  - Curated stories first, generate CTAs second — reversed from today. Readable content delivers value with zero
  friction; the generate buttons currently just bounce to login.
  - Inside the story view: the coach mark ("tap any word"), and after the first explain popup, the signup hook appears
  naturally — the popup's Save button becomes "Sign up free to save this word." That's the highest-intent moment a
  visitor has; a banner can't compete with it.
  - If you can afford it, let anonymous users generate one story (IP/anonymous-session limited) and gate the result
  behind "Sign up free to save your story and read it" — signup right after a personalized payoff is the strongest
  converter you have available.
  - Keep the page footer honest and small: what's free, what will be paid later. No fake urgency.

  2. Registered, unsubscribed — goal: build the daily habit, make limits visible

  This user already believes in the product. The page's job is (a) get them back into content in one tap, (b) accrue
  investment (saved words, streak, stories), (c) make the free tier's edges visible before they're hit, so the upgrade
  moment is anticipated rather than a surprise error.

  ┌────────────────────────────────────────┐
  │ Polypup        🔥 4-day streak    [👤] │
  ├────────────────────────────────────────┤
  │ ▶ Continue reading                     │
  │   "Im Café" — chapter 2 of 3           │
  │                                        │
  │ 📖 Today's story for you  [B1] ·  new  │
  │                                        │
  │ 🃏 Review your words  (12 due)         │
  │                                        │
  │ [✨ New story]   2 of 3 free this week │
  │ [📷 Scan] [✏️ Upload]                  │
  │                                        │
  │ ── My stories ────────────── ⭐ first  │
  │ ...                                    │
  │ ── Library ───────────────────────────│
  │ ...                                    │
  └────────────────────────────────────────┘

  Priority order matters:

  - Continue reading at the very top. Resuming is the lowest-friction action and the strongest retention behavior; it
  should be one tap, with chapter/position remembered.
  - Story of the day at their level/pair. Gives a reason to return даily even when they don't want to spend a generation
  credit. Cheap for you (one generation per pair per day, shared across users).
  - Review queue ("12 words due") — this is the habit loop that compounds: reading → saving words → reviewing → reading
  more. It's also your premium hook: free tier gets basic review, paid gets full SRS/audio/unlimited words. Showing the
  due count creates a small daily obligation, which is exactly what retention is.
  - Quota meters on the expensive actions, stated as remaining value ("2 of 3 free stories this week"), not as a warning.
  When they hit 0, the button itself becomes the upgrade prompt ("Get unlimited stories →"). The user who has watched
  the meter tick down for two weeks already knows what they're buying.
  - Streak chip in the header — light-touch, no guilt mechanics, but visible. Streak + due-words are the two strongest
  comeback triggers, and they're also what you'd put in re-engagement emails later.
  - No upsell banners beyond the meters. A free user who is reading daily will convert at the limit; interrupting them
  before that just burns goodwill.

  3. Subscribed — goal: usage depth and zero churn triggers

  A subscriber's home page should feel like the free page with the friction removed — same habit surfaces, no meters,
  more personalization. Churn happens when the product stops being part of the routine, so everything optimizes "time to
  today's session."

  - Same top three: Continue reading → Today's story → Review due. Don't redesign the page on upgrade; the habit loop
  they built as a free user must stay in the same places.
  - Replace meters with progress: "31 stories read · 412 words learned · level B1 trending ↑". Subscribers need periodic
  proof of value — this is what they recall when the renewal email arrives. A small weekly recap ("this week: 5 stories,
  23 new words") does the same job.
  - Deeper personalization as the visible premium difference: recommendations seeded from their saved words and favorite
  moods/topics ("Because you saved der Bahnhof… a B1 travel story"), and premium-only affordances surfaced inline — audio
  playback on stories, full SRS review, unlimited generation — rather than listed on a features page.
  - Never show upgrade/plan UI except a quiet "Manage plan" inside the account page. Any pricing surface shown to an
  existing subscriber is pure churn risk.
  - If they go quiet, the home page should make re-entry shame-free: "Welcome back — pick up where you left off", not a
  broken-streak guilt screen. Punitive streak mechanics measurably increase churn for lapsed users.

  The common skeleton

  All three states are the same page with slots swapped, which keeps the implementation sane: (1) primary action (read
  demo story / continue reading), (2) daily hook (signup-after-aha / today's story + review due), (3) creation CTAs
  (login-gated / metered / unlimited), (4) story lists. That also means the upgrade and signup transitions feel like
  unlocking, not relearning the app.
  