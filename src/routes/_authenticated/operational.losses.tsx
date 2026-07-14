import { createFileRoute } from "@tanstack/react-router";
import { IncidentView } from "@/components/operational/IncidentView";

export const Route = createFileRoute("/_authenticated/operational/losses")({
  component: () => (
    <IncidentView
      category="loss"
      title="أحداث الخسارة"
      description="Financial loss events with gross, recovery and net-loss tracking for Basel operational-risk reporting."
      eventTypes={[
        "Internal Fraud",
        "External Fraud",
        "Employment Practices",
        "Clients, Products & Business Practices",
        "Damage to Physical Assets",
        "Business Disruption & System Failures",
        "Execution, Delivery & Process Management",
      ]}
    />
  ),
});
