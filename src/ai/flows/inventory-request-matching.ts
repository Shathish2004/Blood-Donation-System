'use server';

/**
 * @fileOverview Matches hospital blood requests with blood bank inventory using an LLM.
 *
 * - matchInventoryToRequests - A function that analyzes hospital blood requests and compares them with inventory reports to identify potential matches.
 * - MatchInventoryToRequestsInput - The input type for the matchInventoryToRequests function.
 * - MatchInventoryToRequestsOutput - The return type for the matchInventoryToRequests function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MatchInventoryToRequestsInputSchema = z.object({
  hospitalRequests: z
    .string()
    .describe('A detailed report of blood requests from hospitals, including blood type, donation type (whole_blood, plasma, red_blood_cells), units needed, and urgency.'),
  bloodBankInventory: z
    .string()
    .describe('A comprehensive report of the blood bank inventory, including blood type, units available, and expiration dates.'),
});
export type MatchInventoryToRequestsInput = z.infer<
  typeof MatchInventoryToRequestsInputSchema
>;

const MatchInventoryToRequestsOutputSchema = z.object({
  matches: z
    .string()
    .describe(
      'A detailed analysis of potential matches between hospital blood requests and blood bank inventory. Rank emergency requests first. Consider donation type, urgency and expiration dates for allocations.'
    ),
});
export type MatchInventoryToRequestsOutput = z.infer<
  typeof MatchInventoryToRequestsOutputSchema
>;

export async function matchInventoryToRequests(
  input: MatchInventoryToRequestsInput
): Promise<MatchInventoryToRequestsOutput> {
  return matchInventoryToRequestsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'matchInventoryToRequestsPrompt',
  input: {schema: MatchInventoryToRequestsInputSchema},
  output: {schema: MatchInventoryToRequestsOutputSchema},
  prompt: `You are an expert in blood bank logistics. Your task is to analyze hospital blood requests and compare them with the blood bank's inventory to identify potential matches.

  Provide a detailed analysis, considering blood types, donation types (whole_blood, plasma, red_blood_cells), units needed, urgency, and expiration dates. Prioritize and rank emergency requests at the top of your analysis. Allocate specific units from the inventory to fulfill the requests efficiently.

  Hospital Blood Requests: {{{hospitalRequests}}}

  Blood Bank Inventory: {{{bloodBankInventory}}}

  Analyze the data and provide a summary of potential matches, with emergency requests listed first:
  `, 
});

const matchInventoryToRequestsFlow = ai.defineFlow(
  {
    name: 'matchInventoryToRequestsFlow',
    inputSchema: MatchInventoryToRequestsInputSchema,
    outputSchema: MatchInventoryToRequestsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
