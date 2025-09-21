import { config } from 'dotenv';
config();

import '@/ai/flows/blood-expiration-date-estimation.ts';
import '@/ai/flows/inventory-request-matching.ts';
import '@/ai/flows/blood-report-matching.ts';
import '@/ai/flows/demand-forecasting.ts';
