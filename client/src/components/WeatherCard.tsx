import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CloudRain, Wind, Droplets } from "lucide-react";
import { getWeatherDescription } from "@/lib/weather";
import { format, parseISO } from "date-fns";
import { useWeatherCard } from "@/hooks/useWeatherCard";
import type { WeatherData } from "@/lib/weather";

interface WeatherCardProps {
  lat?: number | null;
  lng?: number | null;
  tripStartDate?: Date | string;
  tripEndDate?: Date | string;
}

interface WeatherComponentProps {
  weather: WeatherData;
  tempUnit: 'F' | 'C';
  toggleTempUnit: () => void;
  formatTemp: (fahrenheit: number, showBoth?: boolean) => string;
}

// Current weather component (full width)
export function CurrentWeather({ weather, tempUnit, toggleTempUnit, formatTemp }: WeatherComponentProps) {
  return (
    <Card data-testid="card-current-weather">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CloudRain className="h-5 w-5 text-primary" />
            Current Weather
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleTempUnit}
            data-testid="button-temp-toggle"
            className="text-xs"
          >
            °{tempUnit === 'F' ? 'C' : 'F'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Current</p>
            <p className="text-2xl font-bold" data-testid="text-current-temp">
              {formatTemp(weather.current.temperature, true)}
            </p>
            <p className="text-sm text-muted-foreground">
              {getWeatherDescription(weather.current.weatherCode)}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Wind className="h-3 w-3" />
              {tempUnit === 'F' 
                ? `${Math.round(weather.current.windSpeed)} mph`
                : `${Math.round(weather.current.windSpeed * 1.60934)} km/h`
              }
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Forecast component (can be placed in grid)
export function WeatherForecast({ 
  weather, 
  formatTemp,
  tripStartDate, 
  tripEndDate 
}: Omit<WeatherComponentProps, 'tempUnit' | 'toggleTempUnit'> & { tripStartDate?: Date | string; tripEndDate?: Date | string }) {
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
    <Card data-testid="card-weather-forecast">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudRain className="h-5 w-5 text-primary" />
          Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                <div className="text-right min-w-[80px]">
                  <p className="text-sm font-semibold">
                    {formatTemp(day.temperatureMax)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTemp(day.temperatureMin)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Combined container component that uses shared hook
export default function WeatherCard({ lat, lng, tripStartDate, tripEndDate }: WeatherCardProps) {
  const { weather, isLoading, error, tempUnit, toggleTempUnit, formatTemp } = useWeatherCard(lat, lng, 7);

  // Don't show card if no coordinates
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

  return (
    <div className="space-y-4">
      <CurrentWeather 
        weather={weather} 
        tempUnit={tempUnit} 
        toggleTempUnit={toggleTempUnit} 
        formatTemp={formatTemp} 
      />
      <WeatherForecast 
        weather={weather} 
        formatTemp={formatTemp} 
        tripStartDate={tripStartDate}
        tripEndDate={tripEndDate}
      />
    </div>
  );
}
