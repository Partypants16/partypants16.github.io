// Small helpers shared by the React pages.
import { useEffect, useState } from "react";

// A value kept in localStorage (per browser). Storage can be blocked
// (private windows, file://, blocked site data), so every access is guarded
// and the page works without it.
export function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch (e) {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage blocked: keep it for this visit only */
    }
  }, [key, value]);
  return [value, setValue];
}

export const fmt = (n) => Number(n).toLocaleString("en-AU");

// "5 plays", "1 play": one string, so the Hinglish switch sees whole phrases.
export const plural = (n, one, many = one + "s") => `${fmt(n)} ${n === 1 ? one : many}`;

// Lower-case, accents removed: "Göransson" matches "goransson".
export const fold = (text) =>
  String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2024-04-20" -> "20 Apr 2024"; "2024-04" -> "Apr 2024"
export function niceDate(iso) {
  const [y, m, d] = iso.split("-");
  const month = MONTHS[Number(m) - 1];
  return d ? `${Number(d)} ${month} ${y}` : `${month} ${y}`;
}

// Read and write a few values in the address (#year=2024&artist=...), so a
// view can be bookmarked or shared and the back button isn't hijacked.
export function readHash() {
  const out = {};
  new URLSearchParams(location.hash.slice(1)).forEach((v, k) => (out[k] = v));
  return out;
}

export function writeHash(values) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v !== null && v !== undefined && v !== "") params.set(k, v);
  const hash = params.toString();
  history.replaceState(null, "", hash ? "#" + hash : location.pathname + location.search);
}
