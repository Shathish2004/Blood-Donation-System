'use server';

/**
 * @fileOverview Compares two blood reports to determine compatibility.
 *
 * - matchBloodReports - A function that takes two blood reports and returns a compatibility score and explanation.
 * - MatchBloodReportsInput - The input type for the matchBloodReports function.
 * - MatchBloodReportsOutput - The return type for the matchBloodReports function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MatchBloodReportsInputSchema = z.object({
  reportA: z
    .string()
    .describe('The first blood report, typically the patient\'s.'),
  reportB: z
    .string()
    .describe('The second blood report, typically from a blood unit.'),
});
export type MatchBloodReportsInput = z.infer<
  typeof MatchBloodReportsInputSchema
>;

const MatchBloodReportsOutputSchema = z.object({
  matchingScore: z
    .number()
    .describe(
      'A score from 0 to 100 indicating the match compatibility. 100 is a perfect match.'
    ),
  explanation: z
    .string()
    .describe(
      'A detailed explanation of the matching score, highlighting compatibilities and potential issues (e.g., blood type match, antibody presence, cross-match results).'
    ),
});
export type MatchBloodReportsOutput = z.infer<
  typeof MatchBloodReportsOutputSchema
>;

export async function matchBloodReports(
  input: MatchBloodReportsInput
): Promise<MatchBloodReportsOutput> {
  return matchBloodReportsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'matchBloodReportsPrompt',
  input: {schema: MatchBloodReportsInputSchema},
  output: {schema: MatchBloodReportsOutputSchema},
  prompt: `You are an expert hematologist specializing in blood transfusions. Your task is to analyze two blood reports and determine their compatibility for a transfusion.

  Analyze the two reports provided below. Compare their blood types, antibody screens, and any cross-matching results.

  Based on your analysis, provide a compatibility score from 0 to 100. A score of 100 represents a perfect, safe match. A score of 0 represents a dangerous mismatch.

  Also, provide a detailed explanation for your score. Mention the key factors you considered, such as blood type compatibility (ABO and Rh), the presence of unexpected antibodies, and the results of any cross-match tests mentioned in the reports.

  Blood Report A:
  {{{reportA}}}

  Blood Report B:
  {{{reportB}}}

  Provide your analysis now.
  `,
});

const matchBloodReportsFlow = ai.defineFlow(
  {
    name: 'matchBloodReportsFlow',
    inputSchema: MatchBloodReportsInputSchema,
    outputSchema: MatchBloodReportsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
