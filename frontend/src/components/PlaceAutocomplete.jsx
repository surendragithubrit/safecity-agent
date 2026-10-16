import { useEffect, useRef, useState } from "react";
import { api } from "../api";

export default function PlaceAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  center,
  placeholder
}) {
  const [places, setPlaces] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const selectionRef = useRef("");

  useEffect(() => {
    if (value.trim().length < 2 || value === selectionRef.current) {
      setPlaces([]);
      setSearching(false);
      return undefined;
    }

    let active = true;
    const timeout = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const results = await api.searchPlaces(value.trim(), center.lat, center.lon);
        if (active) {
          setPlaces(results);
        }
      } catch (error) {
        if (active) {
          setPlaces([]);
          setSearchError(error.message);
        }
      } finally {
        if (active) {
          setSearching(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [center.lat, center.lon, value]);

  function handleChange(nextValue) {
    selectionRef.current = "";
    setSearchError("");
    onChange(nextValue);
  }

  function selectPlace(place) {
    selectionRef.current = place.label;
    setPlaces([]);
    onSelect(place);
  }

  return (
    <label className="place-field">
      {label}
      <input
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={places.length > 0}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        required
      />
      {(places.length > 0 || searching || searchError) && (
        <div className="place-suggestions" role="listbox">
          {places.map((place) => (
            <button
              className="place-suggestion"
              key={place.id}
              type="button"
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectPlace(place)}
            >
              {place.label}
            </button>
          ))}
          {searching && <span className="place-status">Searching OpenStreetMap places…</span>}
          {searchError && <span className="place-status place-error">{searchError}</span>}
          {!searching && !searchError && places.length === 0 && value.trim().length >= 2 && (
            <span className="place-status">No matching places found.</span>
          )}
        </div>
      )}
    </label>
  );
}
