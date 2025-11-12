import { useQuery } from "@tanstack/react-query";
import { fetchWeather, type WeatherData } from "@/lib/weather";

/**
 * Hook to fetch weather data for given coordinates
 * Uses React Query for caching and automatic refetching
 */
export function useWeather(lat?: number | null, lng?: number | null, days: number = 7) {
  return useQuery<WeatherData>({
    queryKey: ["/api/weather", lat, lng, days],
    queryFn: () => {
      if (lat === null || lat === undefined || lng === null || lng === undefined) {
        throw new Error("Coordinates required for weather");
      }
      return fetchWeather(lat, lng, days);
    },
    enabled: lat !== null && lat !== undefined && lng !== null && lng !== undefined,
    staleTime: 1000 * 60 * 30, // Consider data fresh for 30 minutes
    retry: 2,
  });
}
