import { createFileRoute } from "@tanstack/react-router";
import { IncidentView } from "@/components/operational/IncidentView";

export const Route = createFileRoute("/_authenticated/operational/bcp")({
  component: () => (
    <IncidentView
      category="bcp"
      title="Business Continuity"
      description="Business disruption events, outages and continuity-plan activations with impact tracking."
      eventTypes={[
        "System Outage",
        "Data Center Failure",
        "Natural Disaster",
        "Pandemic",
        "Power / Utility Failure",
        "Third-Party Vendor Outage",
        "Physical Site Incident",
      ]}
    />
  ),
});
