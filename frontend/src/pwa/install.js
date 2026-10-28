/*
 * "Install app" support. Chrome / Edge / Android fire `beforeinstallprompt` once,
 * early; we keep it so Settings can offer an Install button later.
 * Import this file from main.jsx so the listener exists before React renders.
 */

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault(); // we show our own button instead of the mini-infobar
  deferredPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
});

export const canInstall = () => Boolean(deferredPrompt);

/** Shows the browser's install dialog. Resolves to "accepted" | "dismissed" | "unavailable". */
export async function promptInstall() {
  if (!deferredPrompt) return "unavailable";

  const prompt = deferredPrompt;
  deferredPrompt = null; // a prompt can only be used once

  prompt.prompt();
  const { outcome } = await prompt.userChoice;

  return outcome;
}