"use client";

import { useEffect, useState } from "react";

// The iOS on-screen keyboard shrinks the visual viewport without shrinking
// window.innerHeight -- that gap is the signal. 0.75 is a generous threshold
// (a keyboard easily eats 35-45% of a phone screen) so orientation/URL-bar
// chrome changes don't false-positive.
const KEYBOARD_HEIGHT_RATIO = 0.75;

/** True while the on-screen keyboard is covering part of the viewport --
 * used to hide fixed-position chrome (bottom dock, floating buttons) that
 * would otherwise float on top of whatever the keyboard is now covering. */
export function useKeyboardOpen(): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function handleResize() {
      const vv = window.visualViewport;
      if (!vv) return;
      setKeyboardOpen(vv.height < window.innerHeight * KEYBOARD_HEIGHT_RATIO);
    }

    viewport.addEventListener("resize", handleResize);
    return () => viewport.removeEventListener("resize", handleResize);
  }, []);

  return keyboardOpen;
}
