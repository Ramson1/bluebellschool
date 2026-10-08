# CBT Completion & Essay Sessions - User Guide

## Overview

The CBT system now supports three exam types:
1. **Objective** - Multiple choice questions (existing)
2. **Completion** - Fill-in-the-blank questions with NLP evaluation (NEW)
3. **Essay** - Free text answers with intelligent scoring (NEW)

Both Completion and Essay sessions use **Compromise NLP** to evaluate answers, allowing synonyms and semantic variations to be marked correct.

---

## For Administrators/Teachers

### 1. Uploading Completion Questions

#### Step 1: Download the Template
- Go to Admin Dashboard → CBT Questions
- Select "Completion (Fill-in-the-Blank)" from the Session Type dropdown
- Click "Download Template" to get `completionTemplate.json`

#### Step 2: Fill in Questions

The template structure:
```json
[
  {
    "questionText": "The capital of France is ______.",
    "expectedAnswers": ["Paris"],
    "acceptableSynonyms": ["paris", "city of light"],
    "requiredKeywords": ["paris"],
    "points": 1
  }
]
```

**Field Descriptions:**
- `questionText`: The question with a blank (use ______ or similar)
- `expectedAnswers`: Array of correct answers (exact matches)
- `acceptableSynonyms`: Alternative correct answers students might use
- `requiredKeywords`: Key terms that must appear in the answer
- `points`: Points awarded for correct answer (default: 1)

#### Step 3: Upload
- Select Session Type: "Completion"
- Fill in Subject, Class, Term, Duration, Purpose
- Upload the JSON file
- Click "Save"

**Example Questions:**

```json
[
  {
    "questionText": "Water boils at ______ degrees Celsius.",
    "expectedAnswers": ["100"],
    "acceptableSynonyms": ["one hundred", "100°"],
    "requiredKeywords": ["100"],
    "points": 1
  },
  {
    "questionText": "The largest planet in our solar system is ______.",
    "expectedAnswers": ["Jupiter"],
    "acceptableSynonyms": ["jupiter"],
    "requiredKeywords": ["jupiter"],
    "points": 1
  }
]
```

---

### 2. Uploading Essay Questions

#### Step 1: Download the Template
- Select "Essay (Free Text)" from Session Type dropdown
- Download `essayTemplate.json`

#### Step 2: Fill in Questions

The template structure:
```json
[
  {
    "questionText": "Describe the water cycle in your own words.",
    "expectedAnswer": "The water cycle involves evaporation, condensation, precipitation, and collection.",
    "requiredKeywords": ["evaporation", "condensation", "precipitation"],
    "acceptableSynonyms": {
      "evaporation": ["evaporating", "vaporization"],
      "condensation": ["condensing", "cooling"],
      "precipitation": ["rain", "snow"]
    },
    "minWords": 50,
    "points": 10
  }
]
```

**Field Descriptions:**
- `questionText`: The essay question
- `expectedAnswer`: A model answer (used for semantic comparison)
- `requiredKeywords`: Key concepts that should appear in the essay
- `acceptableSynonyms`: Alternative terms for each keyword (object with keyword as key)
- `minWords`: Minimum word count required
- `points`: Maximum points for this question (default: 10)

#### Step 3: Upload
- Same process as Completion questions

**Example Essay Questions:**

```json
[
  {
    "questionText": "Explain why photosynthesis is important for life on Earth.",
    "expectedAnswer": "Photosynthesis produces oxygen and glucose, which are essential for plant growth and animal survival.",
    "requiredKeywords": ["oxygen", "glucose", "plants", "sunlight"],
    "acceptableSynonyms": {
      "oxygen": ["o2", "air"],
      "glucose": ["sugar", "food", "energy"],
      "plants": ["plant life", "vegetation"],
      "sunlight": ["sun", "light", "solar energy"]
    },
    "minWords": 60,
    "points": 10
  }
]
```

---

## How NLP Scoring Works

### Completion Questions

The system evaluates answers in this order:

1. **Exact Match** - Checks if student answer exactly matches any `expectedAnswers`
   - Example: "Paris" → ✅ Perfect match!

2. **Synonym Match** - Checks if answer matches any `acceptableSynonyms`
   - Example: "City of Light" → ✅ Correct! (Synonym accepted)

3. **Semantic Match** - Uses Compromise NLP to compare key nouns/verbs
   - Example: "The capital city Paris" → ✅ Correct! (Semantic match)

4. **Keyword Match** - Checks if all `requiredKeywords` are present
   - Example: "Paris, the capital of France" → ✅ Correct! (Keywords matched)

5. **Incorrect** - None of the above matched
   - Example: "London" → ❌ Incorrect answer

### Essay Questions

Scoring formula: **70% Keywords + 30% Semantic Similarity**

1. **Keyword Matching (70%)**
   - Checks for each required keyword or its synonyms
   - Score = (matched keywords / total keywords) × 70%

2. **Semantic Similarity (30%)**
   - Uses NLP to compare key concepts (nouns & verbs) between student answer and expected answer
   - Score = (matched concepts / total concepts) × 30%

3. **Final Score**
   - `Final Score = (Keyword Score × 0.7 + Semantic Score × 0.3) × Points`

**Example:**
- Question worth 10 points
- 3/4 keywords matched = 75% keyword score
- 2/3 concepts matched = 67% semantic score
- Final = (0.75 × 0.7 + 0.67 × 0.3) × 10 = 7.26/10 points

---

## For Students

### Taking a Completion Exam

1. **Select Session Type**: Choose "Completion (Fill-in-the-Blank)"
2. **Choose Subject**: Select your subject
3. **Start Exam**: Enter admin password to begin
4. **Answer Questions**: Type your answer in the text box
5. **Navigate**: Use Previous/Next buttons or click question numbers
6. **Submit**: Click "Submit Exam" when finished

**Auto-Save Feature:**
- Your answers are automatically saved to your browser
- If the page refreshes or crashes, your progress is restored
- You'll see "💾 Saved [time]" in the top-right corner

### Taking an Essay Exam

1. **Select Session Type**: Choose "Essay (Free Text)"
2. **Choose Subject**: Select your subject
3. **Start Exam**: Enter admin password to begin
4. **Write Essays**: Type your answer in the large text area
5. **Watch Word Count**: Make sure you meet the minimum word requirement
6. **Submit**: Click "Submit Exam" when finished

**Word Count Display:**
- Shows below each essay box
- Turns red if below minimum requirement
- Example: "Word count: 45/50 (Minimum: 50)"

---

## Email Notifications

After each exam, an automated email is sent to administrators with:

### Completion Email Example:
```
Student has completed a CBT completion session:

Student Name: John Doe
Class: YEAR 7
Subject: English Language
Session Type: Completion

Performance Summary:
Total Questions: 10
Correct Answers: 8
Incorrect Answers: 2
Score: 8/10
Percentage: 80%

Detailed Breakdown:
Q1: ✓ Correct - "Paris" (Perfect match!)
Q2: ✓ Correct - "100°" (Synonym accepted)
Q3: ✗ Wrong - "London" (Incorrect answer)
```

### Essay Email Example:
```
Student has completed a CBT essay session:

Student Name: John Doe
Class: YEAR 7
Subject: Science
Session Type: Essay

Performance Summary:
Total Questions: 3
Total Score: 24.5/30
Percentage: 81.67%

Detailed Breakdown:
Q1: Score: 8.5/10 (85%)
  Excellent answer!
  Keywords matched: 3/3
  Word count: 75
```

---

## Best Practices

### For Completion Questions:

1. **Provide Multiple Acceptable Answers**
   ```json
   "expectedAnswers": ["USA", "United States", "United States of America"]
   ```

2. **Include Common Variations**
   ```json
   "acceptableSynonyms": ["us", "america", "u.s.a."]
   ```

3. **Use Keywords Wisely**
   - Only include keywords that MUST be present
   - Don't make it too restrictive

### For Essay Questions:

1. **Set Realistic Word Counts**
   - Year 1-3: 30-50 words
   - Year 4-6: 50-80 words
   - Year 7-9: 80-120 words

2. **Choose Keywords Carefully**
   - Include 3-5 essential concepts
   - Provide synonyms for each keyword
   - Example:
     ```json
     "requiredKeywords": ["photosynthesis", "oxygen", "sunlight"],
     "acceptableSynonyms": {
       "photosynthesis": ["photo synthesis", "plant process"],
       "oxygen": ["o2", "air"],
       "sunlight": ["sun", "light", "solar energy"]
     }
     ```

3. **Write Clear Expected Answers**
   - Include all key concepts
   - Use simple, clear language
   - This is used for semantic comparison

---

## Troubleshooting

### Issue: Student answers not being marked correct

**Solution:**
1. Check if the answer is in `expectedAnswers` or `acceptableSynonyms`
2. Verify `requiredKeywords` are not too restrictive
3. Add more synonyms if needed
4. Test with different answer variations

### Issue: Essay scores seem too low

**Solution:**
1. Check if keywords are appropriate for the student's level
2. Add more synonyms for each keyword
3. Lower the `minWords` requirement if too high
4. Review the `expectedAnswer` - it should contain key concepts

### Issue: Questions not appearing in student view

**Solution:**
1. Verify the correct Session Type is selected
2. Check that Subject, Class, and Term match exactly
3. Ensure questions were uploaded to the correct table
4. Refresh the page and try again

---

## Database Tables

The system uses three separate tables:
- `bluebell_cbtQuestions` - Objective questions (multiple choice)
- `bluebell_cbtCompletion` - Completion questions (fill-in-the-blank)
- `bluebell_cbtEssay` - Essay questions (free text)

Results are stored in `bluebell_cbt_results` with a `sessionType` field to distinguish exam types.

---

## Support

For technical support or questions about the NLP scoring system, contact the system administrator.

---

**Last Updated:** May 2026
**Version:** 1.0
