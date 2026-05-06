"use client";

import { useEffect, useRef } from "react";
import { track, type FunnelEvent } from "@/lib/analytics/funnel";

/** Fires one funnel event on mount. Use to flag a page view as a named funnel
 *  step (e.g. landing_view) from a server-rendered page. */
export function TrackOnMount(props: FunnelEvent) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(props);
    // The full event object is stable across renders — keying by name+JSON
    // matches the user-facing intent ("fire this once for this page").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.name]);
  return null;
}
