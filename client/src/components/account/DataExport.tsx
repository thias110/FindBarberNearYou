import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Role } from "@findbarber/shared/types";
import { userApi } from "../../lib/apiClient";
import { authErrorMessage } from "../../lib/authMessages";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

// Export des données personnelles (issue #14, portabilité nLPD / RGPD).
// Affiché dans Paramètres > Confidentialité (issues #29 et #31) : la page
// appelante fournit le titre et la carte.
export function DataExport({ role }: { role: Role }) {
  const { t } = useTranslation("common");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const data = await userApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `findbarber-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground-muted">
        {role === "BARBER"
          ? t("dataExport.descriptionBarber")
          : t("dataExport.description")}
      </p>
      {error && <Alert variant="danger">{error}</Alert>}
      <Button
        variant="secondary"
        isLoading={exporting}
        onClick={() => void handleExport()}
      >
        {t("dataExport.download")}
      </Button>
    </div>
  );
}
