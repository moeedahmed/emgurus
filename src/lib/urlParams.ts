import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export function useQueryParam(key: string): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) || "";

  const setValue = useCallback(
    (v: string) => {
      const next = new URLSearchParams(params);
      if (v && v.length > 0) next.set(key, v);
      else next.delete(key);
      setParams(next, { replace: true });
    },
    [key, params, setParams]
  );

  return [value, setValue];
}

export function useArrayQueryParam(key: string): [string[], (v: string[]) => void] {
  const [params, setParams] = useSearchParams();

  const raw = params.get(key) || "";
  const values = raw ? raw.split(",").filter(Boolean) : [];

  const setValues = useCallback(
    (arr: string[]) => {
      const next = new URLSearchParams(params);
      if (arr && arr.length) next.set(key, arr.join(","));
      else next.delete(key);
      setParams(next, { replace: true });
    },
    [key, params, setParams]
  );

  return [values, setValues];
}
