import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface FeatureDisabledProps {
  featureName: string;
  description?: string;
}

export function FeatureDisabled({ featureName, description }: FeatureDisabledProps) {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-muted rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-muted-foreground" />
          </div>
          <CardTitle>Feature Not Available</CardTitle>
          <CardDescription>
            {description || `${featureName} is currently disabled.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button 
            onClick={() => navigate('/')}
            variant="outline"
          >
            Return to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}