import { useEffect } from "react";

const GuruAvailability = () => {
  useEffect(() => {
    document.title = "Availability & Pricing | EMGurus";
  }, []);
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Define Availability & Pricing</h1>
      <p className="text-muted-foreground mb-6">Configure your booking slots, timezones, and rates. Coming soon.</p>
      <div className="rounded-lg border p-6 bg-card">Coming soon.</div>
    </main>
  );
};

export default GuruAvailability;
