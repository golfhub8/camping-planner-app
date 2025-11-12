import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

interface LocationResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (location: string, lat?: number, lng?: number) => void;
  label?: string;
  placeholder?: string;
}

export default function LocationAutocomplete({
  value,
  onChange,
  label = "Location",
  placeholder = "Enter a location..."
}: LocationAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const debouncedSearch = useDebounce(inputValue, 500);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 3) {
      setSuggestions([]);
      return;
    }

    const searchLocation = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            debouncedSearch
          )}&limit=5`,
          {
            headers: {
              'User-Agent': 'CampingPlannerApp/1.0'
            }
          }
        );
        const results = await response.json();
        setSuggestions(results);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Error fetching location suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    searchLocation();
  }, [debouncedSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);
  };

  const handleSelectLocation = (location: LocationResult) => {
    setInputValue(location.display_name);
    onChange(location.display_name, parseFloat(location.lat), parseFloat(location.lon));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow click events to register
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div className="relative">
      <Label htmlFor="location">{label}</Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="location"
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={handleBlur}
          className="pl-9"
          data-testid="input-location"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              className="w-full px-4 py-2 text-left hover-elevate flex items-start gap-2"
              onClick={() => handleSelectLocation(suggestion)}
              data-testid={`location-suggestion-${idx}`}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">{suggestion.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
