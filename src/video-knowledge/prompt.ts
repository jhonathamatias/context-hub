/**
 * Short, deterministic multimodal prompt. No huge examples.
 * Schema is enforced via structured output in the Gemini adapter.
 */
export function buildMultimodalVideoKnowledgePrompt(): string {
  return [
    'You analyze a guitar/music lesson video (audio + visuals).',
    'Return ONLY JSON matching the schema.',
    'Identify: suggestedTitle, summary, topics, concepts, techniques,',
    'theoryHarmony, scalesArpeggiosChords, exercises, licksOrPracticalIdeas,',
    'teacherRecommendations, reviewQuestions.',
    'Use startSeconds/endSeconds when you can locate moments; otherwise null.',
    'Never invent timestamps you cannot justify from the video.',
    'Be concise. Prefer Portuguese when the lesson is in Portuguese.',
  ].join(' ');
}
