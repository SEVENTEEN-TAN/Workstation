export function shouldEnableCardDrag(reducedMotion: boolean | null, isDesktop: boolean) {
  return !reducedMotion && isDesktop;
}
