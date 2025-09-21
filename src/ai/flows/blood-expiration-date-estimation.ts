'use server';

/**
 * @fileOverview Estimates blood expiration dates using AI based on stored data.
 *
 * - estimateBloodExpirationDate - A function that estimates the expiration date of blood.
 * - EstimateBloodExpirationDateInput - The input type for the estimateBloodExpirationDate function.
 * - EstimateBloodExpirationDateOutput - The return type for the estimateBloodExpirationDate function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EstimateBloodExpirationDateInputSchema = z.object({
  storageConditions: z
    .string()
    .describe('Description of the storage conditions for the blood.'),
  collectionDate: z.string().describe('The date the blood was collected.'),
  bloodType: z.string().describe('The blood type of the blood unit.'),
});
export type EstimateBloodExpirationDateInput = z.infer<
  typeof EstimateBloodExpirationDateInputSchema
>;

const EstimateBloodExpirationDateOutputSchema = z.object({
  estimatedExpirationDate: z
    .string()
    .describe('The estimated expiration date of the blood unit.'),
  confidenceLevel: z
    .string()
    .describe(
      'A qualitative description of the confidence level in the estimate.'
    ),
});
export type EstimateBloodExpirationDateOutput = z.infer<
  typeof EstimateBloodExpirationDateOutputSchema
>;

export async function estimateBloodExpirationDate(
  input: EstimateBloodExpirationDateInput
): Promise<EstimateBloodExpirationDateOutput> {
  return estimateBloodExpirationDateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'estimateBloodExpirationDatePrompt',
  input: {schema: EstimateBloodExpirationDateInputSchema},
  output: {schema: EstimateBloodExpirationDateOutputSchema},
  prompt: `You are an expert in blood storage and expiration.

  Given the following information, estimate the expiration date of the blood unit and your confidence level in the estimate.

  Storage Conditions: {{{storageConditions}}}
  Collection Date: {{{collectionDate}}}
  Blood Type: {{{bloodType}}}

  Provide the estimated expiration date and a confidence level (high, medium, low) based on the provided information.
  `,
});

const estimateBloodExpirationDateFlow = ai.defineFlow(
  {
    name: 'estimateBloodExpirationDateFlow',
    inputSchema: EstimateBloodExpirationDateInputSchema,
    outputSchema: EstimateBloodExpirationDateOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
