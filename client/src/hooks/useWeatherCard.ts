import { useState, useEffect } from "react";
import { useWeather } from "@/hooks/useWeather";

// Temperature conversion utilities
const fahrenheitToCelsius = (f: number): number => (f - 32) * 5 / 9;

// Detect user's preferred temperature unit based on browser locale
const getDefaultTempUnit = (): 'F' | 'C' => {
  if (typeof window === 'undefined') return 'F'; // SSR guard
  const locale = navigator.language || 'en-US';
  return locale.includes('US') ? 'F' : 'C';
};

/**
 * Shared hook for weather card components
 * Fetches weather data once and manages temperature unit preference
 */
export function useWeatherCard(
  lat?: number | null, 
  lng?: number | null,
  days: number = 7
) {
  const weatherQuery = useWeather(lat, lng, days);
  
  // Initialize temperature unit from localStorage or browser locale
  const [tempUnit, setTempUnit] = useState<'F' | 'C'>(() => {
    if (typeof window === 'undefined') return 'F'; // SSR guard
    const saved = localStorage.getItem('weatherTempUnit');
    return (saved as 'F' | 'C') || getDefaultTempUnit();
  });

  // Save preference to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('weatherTempUnit', tempUnit);
    }
  }, [tempUnit]);

  // Toggle between F and C
  const toggleTempUnit = () => {
    setTempUnit(prev => prev === 'F' ? 'C' : 'F');
  };

  // Convert temperature based on current unit
  const convertTemp = (fahrenheit: number): number => {
    return tempUnit === 'F' ? fahrenheit : fahrenheitToCelsius(fahrenheit);
  };

  // Format temperature display with both units
  const formatTemp = (fahrenheit: number, showBoth: boolean = false): string => {
    const f = Math.round(fahrenheit);
    const c = Math.round(fahrenheitToCelsius(fahrenheit));
    
    if (showBoth) {
      return tempUnit === 'F' ? `${f}°F / ${c}°C` : `${c}°C / ${f}°F`;
    }
    return tempUnit === 'F' ? `${f}°F` : `${c}°C`;
  };

  return {
    weather: weatherQuery.data,
    isLoading: weatherQuery.isLoading,
    error: weatherQuery.error,
    tempUnit,
    toggleTempUnit,
    convertTemp,
    formatTemp,
  };
}
