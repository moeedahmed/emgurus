# EMGurus — EXAMS Recovery Report

Generated: {{DATE}}

Note: Read-only audit first. No schema/auth/edge-config changes. We only made low-risk relinks/labels. Risky/unclear items are parked as TODOs.

---

A) ROUTES & COMPONENTS (current state)

| Route | Component/File | Status | Notes (imports, behavior, console) |
|---|---|---|---|
| /exams | src/pages/Exams.tsx | Works | Landing now shows 3 actions: Practice Mode → /exams/ai-practice; Exam Mode → /exams/reviewed-exam; Browse Question Bank → /exams/reviewed. Uses PageHero, Card, Button. |
| /exams/ai-practice | src/pages/exams/AiPracticeConfig.tsx | Appears OK | Not modified. Starts realtime AI practice (edge function generate-ai-question). |
| /exams/ai-practice/session/:id | src/pages/exams/AiPracticeSession.tsx | Appears OK | Session view for realtime practice. |
| /exams/reviewed | src/pages/exams/ReviewedQuestionBank.tsx | Works | Uses edge function /public-reviewed-exams with fallback to reviewed_exam_questions. Auto-start via ?mode removed (centralized on landing). Minimal fields selected. |
| /exams/reviewed/:id | src/pages/exams/ReviewedQuestionDetail.tsx | Works | Practice view for a single reviewed question; pulls from reviewed_exam_questions; saves session summary to exam_attempts. |
| /exams/reviewed-exam | src/pages/exams/ReviewedExamSession.tsx | Works (needs ids) | Timed/randomized exam session for reviewed bank. Requires state.ids; if missing, shows guidance. |
| /exams/question-bank | src/pages/exams/QuestionBankPage.tsx | Legacy/Duplicate | Queries review_exam_questions (not reviewed_exam_questions). Likely older bank; kept untouched. |
| /exams/question/:id | src/pages/exams/QuestionDetail.tsx | Works | Reviewed question detail; uses reviewed_exam_questions. |
| /guru/exams/review | src/pages/guru/ExamsReviewQueue.tsx | Works | Guru queue/editor via edge function exams-guru-review; can approve/reject. |
| /guru/reviewed | src/pages/guru/ReviewedByMe.tsx | Works | Lists approved reviewed questions by current guru. |
| /guru/questions | src/pages/guru/Questions.tsx | Placeholder | "Coming soon." Kept as-is. |
| /guru/reviews | src/pages/guru/ReviewQueue.tsx | Legacy | Older review queue route still registered; not changed. |
| /admin/exams-curation | src/pages/admin/ExamsAICuration.tsx | Works | Admin curation/assign + generator; uses exams-admin-curate edge function. |

Console/logs: No recent EXAMS errors found in console; edge function logs show exams-guru-review booted.

---

B) ADMIN → GURU → USER WORKFLOW CHECK

- Admin tools found:
  - Admin curation/assignment (ExamsAICuration) → OK
- Guru review/editor:
  - ExamsReviewQueue with edit/approve/reject → OK
  - ReviewedByMe history → OK
- User surfaces:
  - AI Practice (AiPracticeConfig/AiPracticeSession) → OK
  - Reviewed Question Bank (ReviewedQuestionBank) → OK
  - Practice per-question (ReviewedQuestionDetail) → OK
  - Exam mode (ReviewedExamSession) → OK but requires ids passed; landing now links directly, which opens session without ids (shows guidance). See TODO.

Break points observed:
- Exam Mode launch from landing doesn’t assemble ids (ReviewedExamSession expects state.ids). Previously auto-start via ?mode=exam on the bank handled this; we removed auto-start per spec. See TODO to add a minimal selector/redirect.
- Dashboard quick links for exams (admin/guru) are not explicitly present; sections embed bank/practice but not dedicated queue/history links. See TODO relinks.

---

C) DATA ACCESS & ENUM MISMATCHES (reads only)

- Tables used across EXAMS:
  - reviewed_exam_questions (primary reviewed data; fields: stem, options, correct_index, explanation, exam, topic, status=approved)
  - review_exam_questions (legacy in QuestionBankPage)
  - exam_questions (legacy references in repo/functions)
- Status strings:
  - Reviewed list filters on status='approved' (consistent)
  - Queue/editor status handled by edge functions; no UI-side enum writes were introduced
- Exam type labels vs enums:
  - Mixed usage seen: "MRCEM_PRIMARY", "MRCEM_SBA", "FRCEM_SBA" vs UI labels like "MRCEM Primary" and sometimes "MRCEM_Primary" (underscore/casing). UI logic tolerates both; queries use whatever exists on rows. No enum changes proposed.

---

D) PERFORMANCE & FILTERING (reads only)

- ReviewedQuestionBank: server-side pagination via /public-reviewed-exams; minimal fields mapped; fallback selects id, exam, stem, reviewer_id, reviewed_at, topic. Client filters for search/exam; topic list derived from visible page only (OK). Note: count call added only once.
- ReviewedQuestionDetail/ExamSession: fetch single rows by id selecting needed columns; options mapping done locally; no N+1.
- Potential heavier calls: QuestionBankPage (legacy) selects more fields and uses legacy table; left untouched.

---

E) ORPHANED/LEGACY CODE

- .bak files present for dashboards and some pages; left as-is.
- Duplicate/legacy routes:
  - /exams/question-bank (QuestionBankPage.tsx) uses review_exam_questions
  - /guru/reviews (ReviewQueue.tsx) likely older queue
- QuizInterface.tsx references tables like questions/quiz_attempts (non-core to current EXAMS flow); parked.

---

KEEPS / RESTORE / PARK

- Keeps (working now):
  - Admin curation & assign (ExamsAICuration)
  - Guru review queue/editor (ExamsReviewQueue) and ReviewedByMe
  - ReviewedQuestionBank with public edge function
  - ReviewedQuestionDetail and ReviewedExamSession
  - AI practice flow (AiPractice*)
- Restore (minimal relinks):
  - /exams landing with three actions (done)
  - Dashboard shortcuts for Admin (AI Curation & Assign) and Guru (Review Pending, Reviewed by Me, My Questions) → TODO relinks
- Park (uncertain/risky):
  - Legacy QuestionBankPage vs ReviewedQuestionBank duplication
  - Launching Exam Mode needs an ids selector/redirect strategy now that auto-start is removed
  - Mixed exam type labels vs enums (tolerated; no enum change)

---

CHANGE PLAN (applied now)

- src/pages/Exams.tsx: Replace two-card layout with three clear actions linking to Practice, Exam, and Reviewed Bank (no redesign, just labels/links).
- src/pages/exams/ReviewedQuestionBank.tsx: Remove auto-start logic from ?mode to keep mode selection only on landing; keep server pagination and minimal fields.

No other functionality changed; no DB/auth/edge-function modifications.

---

PROPOSED TODOs (not implemented)

1) Add safe Exam Mode launcher
- File: src/pages/exams/ReviewedQuestionBank.tsx (or a tiny helper component)
- Plan: Add a small, unobtrusive "Start Exam" button that gathers current page ids and navigates to /exams/reviewed-exam with state.ids; or redirect /exams (Exam Mode) to bank with a top bar explaining how to start.
- Risk: Low
- Dependencies: none (client-only)

2) Guru dashboard relinks
- File: src/pages/DashboardGuru.tsx
- Plan: Add small link buttons within the Exams section header to: Review Pending (/guru/exams/review), Reviewed by Me (/guru/reviewed), My Questions (/guru/questions).
- Risk: Low
- Dependencies: none

3) Admin dashboard relink
- File: src/pages/DashboardAdmin.tsx
- Plan: Add a small link in the Exams tab header to "/admin/exams-curation" labeled "AI Curation & Assign".
- Risk: Low
- Dependencies: none

4) Legacy QuestionBankPage deprecation note
- File: src/pages/exams/QuestionBankPage.tsx
- Plan: Add a non-invasive banner explaining it is legacy; link to /exams/reviewed. Or hide from nav if not used.
- Risk: Low/Med (UX)
- Dependencies: none

5) Tolerant status filters (if queues show empty)
- File: src/pages/guru/ExamsReviewQueue.tsx (only if needed)
- Plan: Extend read filters to accept in_review/under_review if a mismatch is confirmed. No writes.
- Risk: Low
- Dependencies: none

6) Exam type label harmonization (visual only)
- Files: ReviewedQuestionBank/Detail/ExamSession
- Plan: Map enum → friendly label for chips/badges; no DB change.
- Risk: Low
- Dependencies: none

---

NO REGRESSIONS CHECK

- No cards/pages removed. No new blank pages. No public pages moved into dashboards. Only labels/links adjusted on /exams and removal of auto-start in bank.

