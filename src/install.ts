import { t } from "./i18n";
import { $, toast } from "./ui";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let installPrompt: BeforeInstallPromptEvent | null = null;

export async function installPWA(): Promise<void> {
  if (!installPrompt) {
    toast(t("install.useMenu"));
    return;
  }

  const prompt = installPrompt;
  // A prompt can be used only once, so hide the button whatever the outcome.
  installPrompt = null;
  $("#install-button").hidden = true;

  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    toast(choice.outcome === "accepted" ? t("install.accepted") : t("install.cancelled"));
  } catch {
    toast(t("install.failed"));
  }
}

export function bindInstall(): void {
  $("#install-button").addEventListener("click", () => void installPWA());

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as BeforeInstallPromptEvent;
    $("#install-button").hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    $("#install-button").hidden = true;
    toast(t("install.installed"));
  });
}
