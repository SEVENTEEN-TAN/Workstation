export const reveal = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
};

export const luxuryEase = [0.32, 0.72, 0, 1] as const;
