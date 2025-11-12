import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CloudRain, Wind, Droplets } from "lucide-react";
import { useWeather } from "@/hooks/useWeather";
import { getWeatherDescription } from "@/lib/weather";
import { format, parseISO } from "date-fns";

interface WeatherCardProps {
  lat?: number | null;
  lng?: number | null;
  tripStartDate?: Date | string;
  tripEndDate?: Date | string;
}

export default function WeatherCard({ lat, lng, tripStartDate, tripEndDate }: WeatherCardProps) {
  const { data: weather, isLoading, error } = useWeather(lat, lng, 7);

  // Don't show card if no coordinates (check for null/undefined, not falsy, to allow 0 values)
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }

  if (isLoading) {
    return (
      <Card data-testid="card-weather-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudRain className="h-5 w-5 text-primary" />
            Weather Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card data-testid="card-weather-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudRain className="h-5 w-5 text-primary" />
            Weather Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load weather forecast
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filter forecast to show only days within trip dates if provided
  let forecastDays = weather.daily;
  if (tripStartDate && tripEndDate) {
    const start = typeof tripStartDate === 'string' ? parseISO(tripStartDate) : tripStartDate;
    const end = typeof tripEndDate === 'string' ? parseISO(tripEndDate) : tripEndDate;
    
    forecastDays = weather.daily.filter((day) => {
      const dayDate = parseISO(day.date);
      return dayDate >= start && dayDate <= end;
    });
  }

  // Fallback to first 5 days if no trip dates or no matching days
  if (forecastDays.length === 0) {
    forecastDays = weather.daily.slice(0, 5);
  }

  return (
    <Card data-testid="card-weather">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudRain className="h-5 w-5 text-primary" />
          Weather Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current weather */}
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Current</p>
            <p className="text-2xl font-bold" data-testid="text-current-temp">
              {Math.round(weather.current.temperature)}°F
            </p>
            <p className="text-sm text-muted-foreground">
              {getWeatherDescription(weather.current.weatherCode)}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Wind className="h-3 w-3" />
              {Math.round(weather.current.windSpeed)} mph
            </div>
          </div>
        </div>

        {/* Daily forecast */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Forecast</p>
          <div className="space-y-2">
            {forecastDays.map((day, idx) => (
              <div
                key={day.date}
                className="flex items-center justify-between p-3 rounded-lg hover-elevate"
                data-testid={`weather-day-${idx}`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {format(parseISO(day.date), 'EEE, MMM d')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getWeatherDescription(day.weatherCode)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {day.precipitationSum > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Droplets className="h-3 w-3" />
                      {day.precipitationSum.toFixed(1)}"
                    </Badge>
                  )}
                  <div className="text-right min-w-[60px]">
                    <p className="text-sm font-semibold">
                      {Math.round(day.temperatureMax)}°
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(day.temperatureMin)}°
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
