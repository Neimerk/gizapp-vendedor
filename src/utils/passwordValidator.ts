export type PasswordStrength = {
  valid: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  errors: string[];
};

const WEAK_PASSWORDS = new Set([
  "12345678", "password", "senha1234", "brasux123", "admin1234",
  "123456789", "qwerty123", "iloveyou1", "letmein1", "welcome1",
]);

export function validatePassword(password: string): PasswordStrength {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push("Mínimo 8 caracteres.");
  } else {
    score++;
    if (password.length >= 12) score++;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Pelo menos 1 letra maiúscula.");
  } else {
    score++;
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Pelo menos 1 número.");
  } else {
    score++;
  }

  if (/[!@#$%^&*()\-_=+[\]{};':",.<>/?\\|`~]/.test(password)) {
    score = Math.min(score + 1, 4) as 0 | 1 | 2 | 3 | 4;
  }

  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    errors.push("Senha muito comum. Escolha uma mais única.");
    score = Math.min(score, 1) as 0 | 1 | 2 | 3 | 4;
  }

  const clampedScore = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;

  const LABELS = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];
  const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#16a34a"];

  return {
    valid: errors.length === 0 && password.length >= 8,
    score: clampedScore,
    label: LABELS[clampedScore],
    color: COLORS[clampedScore],
    errors,
  };
}
