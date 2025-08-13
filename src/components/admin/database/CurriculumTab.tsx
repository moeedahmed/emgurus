import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip } from "@/components/ui/chip";

interface RcemSlo {
  id: string;
  code: string;
  title: string;
  exam: string;
}

interface CurriculumSlo {
  id: string;
  code: string;
  title: string;
  question_count?: number;
}

interface CurriculumMap {
  id: string;
  slo_number: number;
  slo_title: string;
  key_capability_number: number;
  key_capability_title: string;
  exam_type: string;
  question_count?: number;
}

const CurriculumTab = () => {
  const [rcemSlos, setRcemSlos] = useState<RcemSlo[]>([]);
  const [curriculumSlos, setCurriculumSlos] = useState<CurriculumSlo[]>([]);
  const [curriculumMaps, setCurriculumMaps] = useState<CurriculumMap[]>([]);
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>("");
  const [selectedRcemCode, setSelectedRcemCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [editingSlo, setEditingSlo] = useState<CurriculumSlo | null>(null);
  const [editingMap, setEditingMap] = useState<CurriculumMap | null>(null);
  const { toast } = useToast();

  const [sloFormData, setSloFormData] = useState({
    code: "",
    title: ""
  });

  const [mapFormData, setMapFormData] = useState({
    slo_number: "",
    slo_title: "",
    key_capability_number: "",
    key_capability_title: "",
    exam_type: "MRCEM_PRIMARY"
  });

  const examTypes = ["MRCEM_PRIMARY", "MRCEM_SBA", "FRCEM_SBA", "OTHER"];

  useEffect(() => {
    loadData();
  }, [selectedExamFilter, selectedRcemCode]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load RCEM SLOs
      let rcemQuery = supabase.from('rcem_slos').select('*').order('code');
      if (selectedExamFilter) {
        rcemQuery = rcemQuery.eq('exam', selectedExamFilter as any);
      }
      const { data: rcemData } = await rcemQuery;
      setRcemSlos(rcemData || []);

      // Load Curriculum SLOs
      let sloQuery = supabase.from('curriculum_slos').select('*').order('code');
      if (selectedRcemCode) {
        sloQuery = sloQuery.eq('code', selectedRcemCode);
      }
      const { data: sloData } = await sloQuery;

      // Get question counts for curriculum SLOs
      const slosWithCounts = await Promise.all(
        (sloData || []).map(async (slo) => {
          const { count } = await supabase
            .from('question_slos')
            .select('*', { count: 'exact', head: true })
            .eq('slo_id', slo.id);
          
          return { ...slo, question_count: count || 0 };
        })
      );
      setCurriculumSlos(slosWithCounts);

      // Load Curriculum Maps
      let mapQuery = supabase.from('curriculum_map').select('*').order('exam_type').order('slo_number');
      if (selectedExamFilter) {
        mapQuery = mapQuery.eq('exam_type', selectedExamFilter as any);
      }
      const { data: mapData } = await mapQuery;

      // Get question counts for curriculum maps
      const mapsWithCounts = await Promise.all(
        (mapData || []).map(async (map) => {
          const { count } = await supabase
            .from('question_curriculum_map')
            .select('*', { count: 'exact', head: true })
            .eq('curriculum_id', map.id);
          
          return { ...map, question_count: count || 0 };
        })
      );
      setCurriculumMaps(mapsWithCounts);
    } catch (error: any) {
      toast({
        title: "Failed to load curriculum data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSlo = async () => {
    try {
      if (editingSlo) {
        const { error } = await supabase
          .from('curriculum_slos')
          .update(sloFormData)
          .eq('id', editingSlo.id);
        
        if (error) throw error;
        toast({ title: "SLO updated successfully" });
      } else {
        const { error } = await supabase
          .from('curriculum_slos')
          .insert(sloFormData);
        
        if (error) throw error;
        toast({ title: "SLO created successfully" });
      }

      setDialogOpen(false);
      setEditingSlo(null);
      setSloFormData({ code: "", title: "" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Failed to save SLO",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSaveMap = async () => {
    try {
      const mapData = {
        slo_number: parseInt(mapFormData.slo_number),
        slo_title: mapFormData.slo_title,
        key_capability_number: parseInt(mapFormData.key_capability_number),
        key_capability_title: mapFormData.key_capability_title,
        exam_type: mapFormData.exam_type as any
      };

      if (editingMap) {
        const { error } = await supabase
          .from('curriculum_map')
          .update(mapData)
          .eq('id', editingMap.id);
        
        if (error) throw error;
        toast({ title: "Curriculum map updated successfully" });
      } else {
        const { error } = await supabase
          .from('curriculum_map')
          .insert(mapData);
        
        if (error) throw error;
        toast({ title: "Curriculum map created successfully" });
      }

      setMapDialogOpen(false);
      setEditingMap(null);
      resetMapForm();
      loadData();
    } catch (error: any) {
      toast({
        title: "Failed to save curriculum map",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteSlo = async (sloId: string) => {
    if (!confirm("Are you sure you want to delete this SLO?")) return;

    try {
      const { error } = await supabase
        .from('curriculum_slos')
        .delete()
        .eq('id', sloId);
      
      if (error) throw error;
      toast({ title: "SLO deleted successfully" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Failed to delete SLO",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteMap = async (mapId: string) => {
    if (!confirm("Are you sure you want to delete this curriculum map entry?")) return;

    try {
      const { error } = await supabase
        .from('curriculum_map')
        .delete()
        .eq('id', mapId);
      
      if (error) throw error;
      toast({ title: "Curriculum map deleted successfully" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Failed to delete curriculum map",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const openSloDialog = (slo?: CurriculumSlo) => {
    if (slo) {
      setEditingSlo(slo);
      setSloFormData({ code: slo.code, title: slo.title });
    } else {
      setEditingSlo(null);
      setSloFormData({ code: "", title: "" });
    }
    setDialogOpen(true);
  };

  const resetMapForm = () => {
    setMapFormData({
      slo_number: "",
      slo_title: "",
      key_capability_number: "",
      key_capability_title: "",
      exam_type: "MRCEM_PRIMARY"
    });
  };

  const openMapDialog = (map?: CurriculumMap) => {
    if (map) {
      setEditingMap(map);
      setMapFormData({
        slo_number: map.slo_number.toString(),
        slo_title: map.slo_title,
        key_capability_number: map.key_capability_number.toString(),
        key_capability_title: map.key_capability_title,
        exam_type: map.exam_type
      });
    } else {
      setEditingMap(null);
      resetMapForm();
    }
    setMapDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Edit curriculum SLOs and maps; baseline RCEM SLOs are read-only.
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Chip
          name="exam-filter"
          value=""
          selected={selectedExamFilter === ""}
          onSelect={() => setSelectedExamFilter("")}
          variant="outline"
          size="sm"
        >
          All Exams
        </Chip>
        {examTypes.map((exam) => (
          <Chip
            key={exam}
            name="exam-filter"
            value={exam}
            selected={selectedExamFilter === exam}
            onSelect={() => setSelectedExamFilter(exam)}
            variant="outline"
            size="sm"
          >
            {exam.replace('_', ' ')}
          </Chip>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* RCEM SLOs (Read-only) */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">RCEM SLOs (Reference)</h3>
            <Badge variant="outline">Read-only</Badge>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {rcemSlos.map((slo) => (
              <div 
                key={slo.id} 
                className={`p-2 border rounded cursor-pointer transition-colors ${
                  selectedRcemCode === slo.code ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                }`}
                onClick={() => setSelectedRcemCode(selectedRcemCode === slo.code ? "" : slo.code)}
              >
                <div className="font-mono text-sm">{slo.code}</div>
                <div className="text-sm">{slo.title}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Curriculum SLOs (Editable) */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Curriculum SLOs</h3>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => openSloDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add SLO
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSlo ? "Edit SLO" : "Add SLO"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Code</label>
                    <Input
                      value={sloFormData.code}
                      onChange={(e) => setSloFormData({ ...sloFormData, code: e.target.value })}
                      placeholder="e.g., KC1.1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Title</label>
                    <Input
                      value={sloFormData.title}
                      onChange={(e) => setSloFormData({ ...sloFormData, title: e.target.value })}
                      placeholder="Enter SLO title"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSaveSlo}>
                      {editingSlo ? "Update" : "Create"}
                    </Button>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {curriculumSlos.map((slo) => (
              <div key={slo.id} className="flex items-center justify-between p-2 border rounded">
                <div>
                  <div className="font-mono text-sm">{slo.code}</div>
                  <div className="text-sm">{slo.title}</div>
                  {slo.question_count > 0 && (
                    <Badge variant="secondary" className="text-xs mt-1">
                      {slo.question_count} questions
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => openSloDialog(slo)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDeleteSlo(slo.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Curriculum Map */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Curriculum Map</h3>
          <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => openMapDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Map Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingMap ? "Edit Curriculum Map" : "Add Curriculum Map"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">SLO Number</label>
                    <Input
                      type="number"
                      value={mapFormData.slo_number}
                      onChange={(e) => setMapFormData({ ...mapFormData, slo_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Key Capability Number</label>
                    <Input
                      type="number"
                      value={mapFormData.key_capability_number}
                      onChange={(e) => setMapFormData({ ...mapFormData, key_capability_number: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">SLO Title</label>
                  <Input
                    value={mapFormData.slo_title}
                    onChange={(e) => setMapFormData({ ...mapFormData, slo_title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Key Capability Title</label>
                  <Input
                    value={mapFormData.key_capability_title}
                    onChange={(e) => setMapFormData({ ...mapFormData, key_capability_title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Exam Type</label>
                  <Select 
                    value={mapFormData.exam_type} 
                    onValueChange={(value) => setMapFormData({ ...mapFormData, exam_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {examTypes.map((exam) => (
                        <SelectItem key={exam} value={exam}>
                          {exam.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSaveMap}>
                    {editingMap ? "Update" : "Create"}
                  </Button>
                  <Button variant="outline" onClick={() => setMapDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SLO #</TableHead>
              <TableHead>SLO Title</TableHead>
              <TableHead>KC #</TableHead>
              <TableHead>Key Capability</TableHead>
              <TableHead>Exam</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6">Loading...</TableCell>
              </TableRow>
            ) : curriculumMaps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                  No curriculum map entries found
                </TableCell>
              </TableRow>
            ) : (
              curriculumMaps.map((map) => (
                <TableRow key={map.id}>
                  <TableCell className="font-mono">{map.slo_number}</TableCell>
                  <TableCell className="max-w-48 truncate">{map.slo_title}</TableCell>
                  <TableCell className="font-mono">{map.key_capability_number}</TableCell>
                  <TableCell className="max-w-48 truncate">{map.key_capability_title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{map.exam_type.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>
                    {map.question_count > 0 ? (
                      <Badge variant="secondary">{map.question_count}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => openMapDialog(map)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteMap(map.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default CurriculumTab;