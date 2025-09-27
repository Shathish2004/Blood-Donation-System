'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getDemandForecast, getHistoricalDataForForecast } from '@/app/actions';
import { DemandForecastOutput } from '@/ai/flows/demand-forecasting';
import { LoaderCircle, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const forecastSchema = z.object({
  forecastPeriodDays: z.coerce
    .number()
    .min(7, 'Forecast must be for at least 7 days.')
    .max(90, 'Forecast cannot exceed 90 days.'),
});
type ForecastFormValues = z.infer<typeof forecastSchema>;

const TrendIcon = ({ trend }: { trend: string }) => {
    switch (trend.toLowerCase()) {
        case 'increasing': return <TrendingUp className="h-5 w-5 text-red-500" />;
        case 'decreasing': return <TrendingDown className="h-5 w-5 text-green-500" />;
        default: return <Minus className="h-5 w-5 text-yellow-500" />;
    }
}


function DemandForecastingContent() {
  const { toast } = useToast();
  const [result, setResult] = React.useState<DemandForecastOutput | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [historicalData, setHistoricalData] = React.useState<any>(null);

  React.useEffect(() => {
    getHistoricalDataForForecast().then(setHistoricalData);
  }, []);

  const form = useForm<ForecastFormValues>({
    resolver: zodResolver(forecastSchema),
    defaultValues: { forecastPeriodDays: 30 },
  });

  const onSubmit = async (data: ForecastFormValues) => {
    if (!historicalData) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Historical data is not yet loaded. Please wait.',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const forecastResult = await getDemandForecast({
        ...data,
        historicalRequestData: JSON.stringify(historicalData.requests),
        historicalInventoryData: JSON.stringify(historicalData.inventory),
      });
      setResult(forecastResult);
      toast({
        title: 'Forecast Generated!',
        description: 'The AI demand forecast is ready.',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Forecasting Failed',
        description: 'Could not generate a forecast. Please try again later.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="text-accent" />
                AI Demand Forecasting
              </CardTitle>
              <CardDescription>
                Predict future blood demand based on historical data from the
                last 90 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="forecastPeriodDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forecast Period (in days)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={loading || !historicalData}>
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate Forecast
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card className={result || loading ? 'block' : 'hidden'}>
        <CardHeader>
          <CardTitle>Forecast Results</CardTitle>
          <CardDescription>
            AI-powered demand prediction for the next{' '}
            {form.getValues().forecastPeriodDays} days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <LoaderCircle className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">
                AI is analyzing historical data and generating the forecast...
              </p>
            </div>
          )}
          {result && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold">Overall Forecast Summary</h3>
                <p className="text-sm text-muted-foreground">{result.overallForecast}</p>
                <p className="text-xs mt-1">
                    <span className="font-semibold">Confidence: </span> 
                    <Badge variant={result.confidenceLevel.toLowerCase() === 'high' ? 'default' : 'secondary'} className={cn(result.confidenceLevel.toLowerCase() === 'high' && 'bg-green-500')}>{result.confidenceLevel}</Badge>
                </p>
              </div>
              <div>
                 <h3 className="font-semibold mb-2">Forecast by Blood Type</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {result.forecastByBloodType.map(detail => (
                         <Card key={detail.bloodType} className="p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-lg">{detail.bloodType}</p>
                                    <p className="text-sm text-muted-foreground">{detail.predictedDemandUnits} units</p>
                                </div>
                                <TrendIcon trend={detail.trend} />
                            </div>
                         </Card>
                     ))}
                 </div>
              </div>
               <div>
                <h3 className="font-semibold">Recommendations</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.recommendations}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DemandForecastingPage() {
    return <DemandForecastingContent />
}
