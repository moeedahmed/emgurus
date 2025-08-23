import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { BookOpen, Stethoscope, GraduationCap, FileText, Briefcase, Megaphone, Globe } from "lucide-react";

const categoryIcons: Record<string, React.ComponentType<any>> = {
  "General": Globe,
  "Exam Guidance": GraduationCap,
  "Clinical Compendium": Stethoscope,
  "Research & Evidence": FileText,
  "Careers": Briefcase,
  "Announcements": Megaphone,
};

export default function PopularCategoriesPanel({ categories }: { categories: { title: string; count: number }[] }) {
  if (!categories?.length) return null;
  const top = [...categories].sort((a, b) => b.count - a.count).slice(0, 8);
  
  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">Popular Categories</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {top.map((c) => {
          const IconComponent = categoryIcons[c.title] || BookOpen;
          return (
            <Link
              key={c.title}
              to={`/blogs?category=${encodeURIComponent(c.title)}`}
              className="group block p-4 rounded-lg border bg-card hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <IconComponent className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-sm">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.count} posts</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
