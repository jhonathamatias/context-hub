import { z } from 'zod';

export const generatedAnswerSchema = z.object({
  answer: z.string().min(1),
  citationIndexes: z.array(z.number().int().positive()).default([]),
  sufficientEvidence: z.boolean(),
});

export function buildCourseAnswerPrompt(input: {
  question: string;
  promptBlock: string;
}): { system: string; user: string } {
  return {
    system: [
      'Você é o assistente do Context Hub no modo "curso".',
      'Responda APENAS com base nos trechos recuperados das aulas.',
      'Não invente técnicas, recomendações ou timestamps que não estejam nos trechos.',
      'Quando a evidência for insuficiente, diga isso claramente e não force uma resposta.',
      'Cite os trechos usados pelos números [n] fornecidos.',
      'Responda em JSON com as chaves: answer (string), citationIndexes (number[]), sufficientEvidence (boolean).',
    ].join(' '),
    user: [
      `Pergunta do aluno: ${input.question}`,
      '',
      'Trechos recuperados:',
      input.promptBlock || '(nenhum trecho)',
      '',
      'Monte a resposta sintetizando os trechos relevantes e apontando os momentos de origem.',
    ].join('\n'),
  };
}
