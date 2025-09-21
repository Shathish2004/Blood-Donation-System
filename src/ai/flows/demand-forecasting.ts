'use server';

/**
 * @fileOverview AI-driven demand forecasting for blood units.
 *
 * - forecastDemand - A function that predicts future blood demand based on historical data.
 * - DemandForecastInput - The input type for the forecastDemand function.
 * - DemandForecastOutput - The return type for the forecastDemand function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DemandForecastInputSchema = z.object({
  historicalRequestData: z.string().describe('A JSON string of historical blood request data, including dates, blood types, units, and urgency.'),
  historicalInventoryData: z.string().describe('A JSON string of historical inventory data, including collection dates, expiration dates, and blood types.'),
  forecastPeriodDays: z.number().describe('The number of days into the future to forecast.'),
});
export type DemandForecastInput = z.infer<typeof DemandForecastInputSchema>;

const ForecastDetailSchema = z.object({
    bloodType: z.string().describe("The specific blood type for the forecast."),
    predictedDemandUnits: z.number().describe("The predicted number of units needed."),
    trend: z.string().describe("The forecasted trend for this blood type (e.g., 'Increasing', 'Stable', 'Decreasing').")
});

const DemandForecastOutputSchema = z.object({
  overallForecast: z.string().describe('A high-level summary of the overall blood demand forecast for the next period.'),
  forecastByBloodType: z.array(ForecastDetailSchema).describe('A detailed breakdown of the forecast for each major blood type.'),
  confidenceLevel: z.string().describe("A qualitative description of the confidence level in the forecast (e.g., High, Medium, Low)."),
  recommendations: z.string().describe("Actionable recommendations for inventory management based on the forecast, such as suggesting targeted donation drives."),
});
export type DemandForecastOutput = z.infer<typeof DemandForecastOutputSchema>;

export async function forecastDemand(
  input: DemandForecastInput
): Promise<DemandForecastOutput> {
  return demandForecastingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'demandForecastPrompt',
  input: {schema: DemandForecastInputSchema},
  output: {schema: DemandForecastOutputSchema},
  prompt: `You are an expert data scientist specializing in supply chain and demand forecasting for medical supplies. Your task is to predict future blood demand.

  Analyze the provided historical data on blood requests and inventory. Identify trends, seasonality, and any anomalies.

  - Historical Request Data: {{{historicalRequestData}}}
  - Historical Inventory Data: {{{historicalInventoryData}}}

  Based on this data, generate a demand forecast for the next {{{forecastPeriodDays}}} days.

  Your forecast should include:
  1.  An overall summary of the expected demand.
  2.  A breakdown of predicted demand for each major blood type (O+, O-, A+, A-, B+, B-, AB+, AB-).
  3.  Your confidence level in this forecast.
  4.  Actionable recommendations for blood bank administrators to prepare for the predicted demand (e.g., "Initiate a donation drive for O- blood," "Anticipate higher demand for A+ next week.").
  `,
});

const demandForecastingFlow = ai.defineFlow(
  {
    name: 'demandForecastingFlow',
    inputSchema: DemandForecastInputSchema,
    outputSchema: DemandForecastOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
