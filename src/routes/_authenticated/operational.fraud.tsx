import { createFileRoute } from "@tanstack/react-router";
import { IncidentView } from "@/components/operational/IncidentView";

export const Route = createFileRoute("/_authenticated/operational/fraud")({
  component: () => (
    <IncidentView
      category="fraud"
      title="Fraud Cases"
      description="Internal and external fraud investigations with loss and recovery tracking."
      eventTypes={[
        "Card Fraud",
        "Cheque Fraud",
        "Wire Transfer Fraud",
        "Identity Theft",
        "Insider Fraud",
        "Loan Application Fraud",
        "Money Laundering",
        "Other",
      ]}
    />
  ),
});
