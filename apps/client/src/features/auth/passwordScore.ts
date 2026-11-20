/**
 * Rough 0–4 score from length and character variety. Visual guidance only: the real rule is
 * the shared Zod schema (8+ characters). It never blocks submitting.
 */
export function scorePassword(password: string): number {
  if (password.length < 8) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((re) => re.test(password)).length;
  let score = 1;
  if (password.length >= 12) score++;
  if (classes >= 2) score++;
  if (password.length >= 16 || classes >= 3) score++;
  return Math.min(score, 4);
}
