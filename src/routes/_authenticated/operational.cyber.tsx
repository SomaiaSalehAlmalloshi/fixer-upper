import { createFileRoute } from "@tanstack/react-router";
import { IncidentView } from "@/components/operational/IncidentView";

export const Route = createFileRoute("/_authenticated/operational/cyber")({
  component: () => (
    <IncidentView
      category="cyber"
      title="Cyber Risk"
      description="Cyber-security incidents including data breaches, malware, phishing and DDoS events."
      eventTypes={[
        "Phishing",
        "Malware / Ransomware",
        "Data Breach",
        "DDoS Attack",
        "Unauthorized Access",
        "Insider Threat",
        "Vulnerability Exploit",
        "Third-Party Breach",
      ]}
    />
  ),
});
