import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import OverviewTab from "./OverviewTab";
import ExamsTab from "./ExamsTab";
import CurriculumTab from "./CurriculumTab";
import KnowledgeBaseTab from "./KnowledgeBaseTab";

const DatabaseManager = () => {
  const [isSeeding, setIsSeeding] = useState(false);

  const seedFcpsEm = async () => {
    if (!confirm("Seed FCPS (Pakistan) exam types, curriculum, and knowledge-base entries? (safe to run repeatedly)")) {
      return;
    }

    setIsSeeding(true);
    try {
      let newRows = 0;
      let skippedRows = 0;

      // A) FCPS Exam entries - check and insert taxonomy terms
      const fcpsExams = [
        { slug: 'fcps-part1-pk', title: 'FCPS Part 1 – Pakistan', description: 'Fellowship of College of Physicians and Surgeons Part 1 (Pakistan)' },
        { slug: 'fcps-imm-pk', title: 'FCPS IMM – Pakistan', description: 'Fellowship of College of Physicians and Surgeons Intermediate (Pakistan)' },
        { slug: 'fcps-part2-pk', title: 'FCPS Part 2 – Pakistan', description: 'Fellowship of College of Physicians and Surgeons Part 2 (Pakistan)' }
      ];

      for (const examData of fcpsExams) {
        const { data: existingExam } = await supabase
          .from('taxonomy_terms')
          .select('id')
          .eq('slug', examData.slug)
          .eq('kind', 'exam')
          .maybeSingle();

        if (!existingExam) {
          await supabase
            .from('taxonomy_terms')
            .insert({
              slug: examData.slug,
              title: examData.title,
              kind: 'exam',
              description: examData.description
            });
          newRows++;
        } else {
          skippedRows++;
        }
      }

      // Additional MRCEM/FRCEM entries for completeness
      const additionalExams = [
        { slug: 'fcps-em-pk', title: 'FCPS Emergency Medicine (Pakistan)', description: 'Fellowship of College of Physicians and Surgeons Emergency Medicine program (Pakistan)' },
        { slug: 'mrcem-primary', title: 'MRCEM Primary', description: 'Membership of Royal College of Emergency Medicine Primary exam' },
        { slug: 'mrcem-sba', title: 'MRCEM SBA', description: 'Membership of Royal College of Emergency Medicine Single Best Answer exam' },
        { slug: 'frcem-sba', title: 'FRCEM SBA', description: 'Fellowship of Royal College of Emergency Medicine Single Best Answer exam' }
      ];

      for (const examData of additionalExams) {
        const { data: existingExam } = await supabase
          .from('taxonomy_terms')
          .select('id')
          .eq('slug', examData.slug)
          .eq('kind', 'exam')
          .maybeSingle();

        if (!existingExam) {
          await supabase
            .from('taxonomy_terms')
            .insert({
              slug: examData.slug,
              title: examData.title,
              kind: 'exam',
              description: examData.description
            });
          newRows++;
        } else {
          skippedRows++;
        }
      }

      // B) Curriculum entries
      const curriculumData = [
        { domain: 'Adult Resuscitation & Shock', capabilities: ['Airway management and ventilation', 'Sepsis recognition and management', 'Anaphylaxis treatment', 'Cardiac arrest protocols'] },
        { domain: 'Cardiovascular Emergencies', capabilities: ['Acute coronary syndrome management', 'Arrhythmia recognition and treatment', 'Heart failure management', 'Hypertensive emergencies'] },
        { domain: 'Respiratory', capabilities: ['Asthma management', 'COPD exacerbation treatment', 'Pulmonary embolism diagnosis', 'Respiratory failure management'] },
        { domain: 'Neurology', capabilities: ['Stroke and TIA management', 'Seizure management', 'Headache red flag recognition', 'Altered mental status evaluation'] },
        { domain: 'Trauma', capabilities: ['ATLS primary survey', 'ATLS secondary survey', 'Head trauma management', 'Chest and abdominal trauma'] },
        { domain: 'Toxicology & Environmental', capabilities: ['Poisoning management', 'Envenomation treatment', 'Heat injury management', 'Cold injury management'] },
        { domain: 'Infectious Disease', capabilities: ['Sepsis bundle implementation', 'Antimicrobial selection', 'Tropical disease recognition', 'Infection control measures'] },
        { domain: 'Obstetrics & Gynaecology', capabilities: ['Pregnancy emergencies', 'Postpartum hemorrhage management', 'Eclampsia treatment', 'Gynecological emergencies'] },
        { domain: 'Paediatrics', capabilities: ['Pediatric fever management', 'Dehydration assessment', 'Bronchiolitis treatment', 'Status asthmaticus management'] },
        { domain: 'Procedures & Skills', capabilities: ['Procedural sedation', 'Central line insertion', 'Chest drain insertion', 'Rapid sequence intubation'] },
        { domain: 'Imaging & Diagnostics', capabilities: ['ECG interpretation', 'ED ultrasound basics', 'Radiological interpretation', 'Point-of-care testing'] },
        { domain: 'Ethics, Governance & Communication', capabilities: ['Informed consent', 'Safeguarding protocols', 'Clinical handover', 'End-of-life care'] }
      ];

      let sloNumber = 1;
      for (const { domain, capabilities } of curriculumData) {
        for (const capability of capabilities) {
          // Create curriculum entries for multiple exam types
          const examTypes: ('FCPS_IMM' | 'FCPS_PART2' | 'OTHER')[] = ['FCPS_IMM', 'FCPS_PART2', 'OTHER'];
          
          for (const examType of examTypes) {
            const { data: existingSlo } = await supabase
              .from('curriculum_map')
              .select('id')
              .eq('exam_type', examType)
              .eq('slo_title', capability)
              .eq('key_capability_title', domain)
              .maybeSingle();

            if (!existingSlo) {
              await supabase
                .from('curriculum_map')
                .insert({
                  exam_type: examType,
                  slo_number: sloNumber,
                  slo_title: capability,
                  key_capability_number: Math.ceil(sloNumber / 4), // Group by domain
                  key_capability_title: domain
                });
              newRows++;
            } else {
              skippedRows++;
            }
          }
          sloNumber++;
        }
      }

      // C) Knowledge Base entries
      const knowledgeItems = [
        { title: 'CPSP FCPS EM Curriculum (PK)', exam_type: 'OTHER' as const },
        { title: 'National ED Guidelines (PK)', exam_type: 'OTHER' as const }
      ];

      for (const item of knowledgeItems) {
        const { data: existingKb } = await supabase
          .from('knowledge_base')
          .select('id')
          .eq('title', item.title)
          .eq('exam_type', item.exam_type)
          .maybeSingle();

        if (!existingKb) {
          await supabase
            .from('knowledge_base')
            .insert({
              title: item.title,
              exam_type: item.exam_type,
              content: 'Placeholder content - please update with actual resources.'
            });
          newRows++;
        } else {
          skippedRows++;
        }
      }

      toast.success(`Seed complete: ${newRows} new entries created, ${skippedRows} existing entries skipped`);
    } catch (error: any) {
      console.error('Seeding error:', error);
      toast.error(`Seeding failed: ${error.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        
        <Button 
          onClick={seedFcpsEm} 
          disabled={isSeeding}
          variant="outline"
          size="sm"
        >
          {isSeeding ? 'Seeding...' : 'Seed: FCPS (Pakistan) Exams'}
        </Button>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="exams">
          <ExamsTab />
        </TabsContent>

        <TabsContent value="curriculum">
          <CurriculumTab />
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeBaseTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabaseManager;