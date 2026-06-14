export function playOrderSound() {
  const audio = new Audio("/sounds/new-order.mp3");

  audio.volume = 0.7;

  audio.play().catch(() => {
    console.warn("Som bloqueado pelo navegador até interação do usuário.");
  });
}