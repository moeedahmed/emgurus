import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Guru {
  id: string;
  name: string;
  specialty: string;
  country: string;
  price: number; // USD per 30min
  exams: string[];
}

const sampleGurus: Guru[] = [
  { id: "1", name: "Dr. Aisha Khan", specialty: "Emergency Medicine", country: "UK", price: 60, exams: ["MRCEM", "FRCEM"] },
  { id: "2", name: "Dr. Miguel Santos", specialty: "Emergency Medicine", country: "UAE", price: 55, exams: ["Arab Board", "ACLS"] },
  { id: "3", name: "Dr. Sarah Lee", specialty: "Pediatrics", country: "USA", price: 70, exams: ["USMLE", "PALS"] },
];

const Consultations = () => {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState<string>("all");
  const [exam, setExam] = useState<string>("all");

  useEffect(() => {
    document.title = "Guru Consultation | EMGurus";
  }, []);

  const filtered = useMemo(() => {
    return sampleGurus.filter(g =>
      (country === "all" || g.country === country) &&
      (exam === "all" || g.exams.includes(exam)) &&
      (q.trim() === "" || g.name.toLowerCase().includes(q.toLowerCase()) || g.specialty.toLowerCase().includes(q.toLowerCase()))
    );
  }, [q, country, exam]);

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Guru Consultation</h1>
        <p className="text-muted-foreground">Book by specialty, country, or exam focus. Scheduling, payments, and reminders coming soon.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3 mb-6">
        <Input placeholder="Search by name or specialty" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            <SelectItem value="UK">UK</SelectItem>
            <SelectItem value="UAE">UAE</SelectItem>
            <SelectItem value="USA">USA</SelectItem>
          </SelectContent>
        </Select>
        <Select value={exam} onValueChange={setExam}>
          <SelectTrigger><SelectValue placeholder="Exam" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Exams</SelectItem>
            <SelectItem value="MRCEM">MRCEM</SelectItem>
            <SelectItem value="FRCEM">FRCEM</SelectItem>
            <SelectItem value="USMLE">USMLE</SelectItem>
            <SelectItem value="Arab Board">Arab Board</SelectItem>
          </SelectContent>
        </Select>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((g) => (
          <Card key={g.id} className="p-6">
            <h3 className="text-xl font-semibold mb-1">{g.name}</h3>
            <p className="text-muted-foreground mb-2">{g.specialty} • {g.country}</p>
            <p className="text-sm text-muted-foreground mb-4">Exams: {g.exams.join(", ")}</p>
            <div className="flex items-center justify-between">
              <span className="font-medium">${g.price} / 30 min</span>
              <Button variant="secondary" disabled>Book (soon)</Button>
            </div>
          </Card>
        ))}
      </section>
    </main>
  );
};

export default Consultations;
