# Exams/AI audit (read-only)

## 1. Exam enum values (DB side)

**Found:** `src/integrations/supabase/types.ts` → lines 3524, 3329
```typescript
exam_type_enum: ["MRCEM_PRIMARY", "MRCEM_SBA", "FRCEM_SBA", "OTHER"]
```

**Implication:** Database only accepts these 4 exact enum values, but code is trying to insert human-readable labels like "MRCEM Intermediate SBA".

## 2. WHERE we INSERT into `exam_attempts`

### AI Practice
- **File:** `src/pages/exams/AiPracticeSession.tsx` → lines 137-145
```typescript
const { data: attempt, error: attemptError } = await supabase
  .from('exam_attempts')
  .insert({
    user_id: user.id,
    source: 'ai_practice',
    mode: 'practice',
    total_questions: total,
    question_ids: [questionUuid]
  })
```

### Practice Config
- **File:** `src/pages/exams/PracticeConfig.tsx` → lines 51-65
```typescript
const { data: attempt, error: attemptError } = await supabase
  .from('exam_attempts')
  .insert({
    user_id: user.id,
    source: 'reviewed',
    mode: 'practice',
    breakdown: { 
      exam_type: examType,  // ← This is the canonical exam type
      topic: area !== 'All areas' ? area : null,
      selection_id: null
    }
  })
```

### Test Config  
- **File:** `src/pages/exams/TestConfig.tsx` → lines 54-68
```typescript
const { data: attempt, error: attemptError } = await supabase
  .from('exam_attempts')
  .insert({
    user_id: user.id,
    source: 'reviewed',
    mode: 'exam',  // ← Note: still using 'exam' mode for Test
    breakdown: { 
      exam_type: examType,
      topic: area !== 'All areas' ? area : null,
      selection_id: null
    }
  })
```

### Legacy Reviewed Sessions
- **File:** `src/pages/exams/ReviewedExamSession.tsx` → lines 219-222
- **File:** `src/pages/exams/ReviewedQuestionDetail.tsx` → lines 285-288

**Implication:** All insert sites pass `examType` via `canonExamType()` but AI Practice puts it in attempt directly while Practice/Test store it in `breakdown.exam_type`.

## 3. Reviewed Bank data source

### Primary Query Location
- **File:** `src/pages/exams/ReviewedQuestionBank.tsx` → lines 140-143
```typescript
let base = (supabase as any)
  .from('reviewed_exam_questions')
  .select('id, exam, stem, reviewer_id, reviewed_at, topic, difficulty, tags', { count: 'exact' })
  .eq('status', 'approved');
```

### Session Query Examples
- **File:** `src/pages/exams/PracticeSession.tsx` → lines 72-74
```typescript
const { data: questions, error } = await supabase
  .from('reviewed_exam_questions')
  .select('id, stem, options, correct_index, explanation, exam, topic')
  .eq('status', 'approved')
```

- **File:** `src/pages/exams/TestSession.tsx` → lines 89-91
```typescript
const { data: questions, error } = await supabase
  .from('reviewed_exam_questions')
  .select('id, stem, options, correct_index, explanation, exam, topic')
  .eq('status', 'approved')
```

**Implication:** Reviewed bank uses `reviewed_exam_questions` table with column `exam` (not `exam_type`) and `options` as array, `status='approved'` filter required.

## 4. AI Practice config + session

### Config
- **File:** `src/pages/exams/AiPracticeConfig.tsx` → lines 54-61
```typescript
const examType = canonExamType(exam, EXAMS);  // exam = dropdown value
const { data: session, error: sessionError } = await supabase
  .from('ai_exam_sessions')
  .insert({
    user_id: user.id,
    exam_type: examType as any  // ← trying to insert canonical name
  })
```

### Session  
- **File:** `src/pages/exams/AiPracticeSession.tsx` → route: `/exams/ai-practice/session/:id`
- Loads questions via AI generation API, not database queries

**Implication:** AI Practice uses dropdown values from `src/lib/curricula.ts` ("MRCEM Intermediate SBA") but must convert to enum-safe values.

## 5. Practice (non-AI) config + session

### Config
- **File:** `src/pages/exams/PracticeConfig.tsx` → route: `/exams/practice`
- Uses same dropdown as AI Practice but stores `examType` in `breakdown`

### Session
- **File:** `src/pages/exams/PracticeSession.tsx` → route: `/exams/practice/session/:id`
- Simple fallback query: gets first available approved question without filters

**Implication:** Practice mode has no preselected lists, relies on general reviewed bank queries.

## 6. Test Mode (renamed from Exam) config + session

### Config  
- **File:** `src/pages/exams/TestConfig.tsx` → route: `/exams/test`
- Identical to Practice but uses `mode: 'exam'`

### Session
- **File:** `src/pages/exams/TestSession.tsx` → route: `/exams/test/session/:id`
- Same query pattern as Practice

**Implication:** Test mode functionality identical to Practice except for mode value.

## 7. Feature flags / guards that could block loads

### LocalStorage Usage Found
- **File:** `src/pages/exams/ReviewedExamSession.tsx` → line 79: `localStorage.getItem('free_reviewed_used')`
- **File:** `src/pages/exams/ReviewedQuestionDetail.tsx` → line 68: `localStorage.getItem('free_reviewed_used')`

### No ENABLE_ Flags Found
- No global feature flags found that would block exam loads

**Implication:** Only usage-based localStorage limiting for guest users, no feature flags blocking loads.

## 8. Mode constraint

### Safe Mode Helper
- **File:** `src/lib/exams.ts` → lines 15-17
```typescript
export function safeModeForAttempts(_requested?: string | null) {
  // The DB check constraint accepts "practice" or "exam" (rename of exam mode).
  return 'practice';
}
```

### Mode Usage in Components
- **File:** `src/components/dashboard/exams/ExamsAttempts.tsx` → line 10: `useState<'practice'|'exam'>('practice')`

**Implication:** Database constraint allows "practice" or "exam" modes only; Test mode still uses "exam" internally.

## Fix Plan Inputs

### Canonical enum values for `exam_attempts.exam_type`
- **MUST USE:** `["MRCEM_PRIMARY", "MRCEM_SBA", "FRCEM_SBA", "OTHER"]`
- **MAPPING NEEDED:**
  - "MRCEM Primary" → "MRCEM_PRIMARY"  
  - "MRCEM Intermediate SBA" → "MRCEM_SBA"
  - "FRCEM SBA" → "FRCEM_SBA"

### Reviewed-bank table/view + columns  
- **TABLE:** `reviewed_exam_questions`
- **COLUMNS:** `id, stem, options, correct_index, explanation, exam, topic, status`
- **FILTER:** `status = 'approved'`
- **NOTE:** Uses `exam` column (not `exam_type`), `options` is array format

### Route paths for sessions
- AI Practice: `/exams/ai-practice/session/:id`
- Practice: `/exams/practice/session/:id`  
- Test: `/exams/test/session/:id`
- **REDIRECT:** `/exams/ai-practice/session` (no ID) → handled by `AiPracticeSessionRedirect.tsx`

### Critical Issues Identified
1. **Enum mismatch:** `canonExamType()` returns human labels but DB expects enum values
2. **AI session creation:** Uses `ai_exam_sessions` but attempts to insert to `exam_attempts` with conflicting exam_type format
3. **Reviewed queries:** Session pages do simple fallback queries without exam/topic filtering
4. **Inconsistent storage:** AI stores exam_type directly in attempt, Practice/Test store in breakdown.exam_type