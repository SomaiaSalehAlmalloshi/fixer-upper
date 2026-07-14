import { createFileRoute } from "@tanstack/react-router";
import { IncidentView } from "@/components/operational/IncidentView";

export const Route = createFileRoute("/_authenticated/operational/incidents")({
  component: () => (
    <IncidentView
      category="incident"
      title="Incident Register"
      description="Log operational incidents across the organisation, track status, and record root-cause analysis."
    />
  ),
});
