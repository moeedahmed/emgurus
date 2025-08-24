import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, Calendar, CheckCircle } from "lucide-react";

interface AuditTrailProps {
  itemId: string;
  itemType: "blog" | "exam";
}

interface AuditEvent {
  id: string;
  action: string;
  actor_name: string;
  timestamp: string;
  note?: string;
  status?: string;
}

const AuditTrail: React.FC<AuditTrailProps> = ({ itemId, itemType }) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuditTrail = async () => {
      try {
        setLoading(true);
        // This would be implemented to fetch audit events
        // For now, showing mock data structure
        const mockEvents: AuditEvent[] = [
          {
            id: "1",
            action: "created",
            actor_name: "John Doe",
            timestamp: "2024-01-15T10:00:00Z",
            note: "Initial draft created"
          },
          {
            id: "2", 
            action: "submitted",
            actor_name: "John Doe",
            timestamp: "2024-01-15T11:00:00Z",
            note: "Submitted for review"
          },
          {
            id: "3",
            action: "assigned",
            actor_name: "Admin User",
            timestamp: "2024-01-15T12:00:00Z",
            note: "Assigned to reviewers: Jane Smith, Bob Wilson"
          },
          {
            id: "4",
            action: "reviewed",
            actor_name: "Jane Smith", 
            timestamp: "2024-01-16T09:00:00Z",
            status: "approved",
            note: "Looks good, minor grammar fixes suggested"
          }
        ];
        setEvents(mockEvents);
      } catch (error) {
        console.error("Failed to fetch audit trail:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditTrail();
  }, [itemId, itemType]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "created":
        return <User className="h-4 w-4" />;
      case "submitted":
        return <Clock className="h-4 w-4" />;
      case "assigned":
        return <Calendar className="h-4 w-4" />;
      case "reviewed":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "created":
        return "bg-blue-500";
      case "submitted":
        return "bg-yellow-500";
      case "assigned":
        return "bg-purple-500";
      case "reviewed":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading audit trail...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={event.id} className="flex items-start space-x-3">
              <div className={`rounded-full p-2 text-white ${getActionColor(event.action)}`}>
                {getActionIcon(event.action)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {event.action.charAt(0).toUpperCase() + event.action.slice(1)} by {event.actor_name}
                  </p>
                  <time className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </time>
                </div>
                
                {event.note && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {event.note}
                  </p>
                )}
                
                {event.status && (
                  <Badge 
                    variant={event.status === "approved" ? "default" : "secondary"}
                    className="mt-1"
                  >
                    {event.status}
                  </Badge>
                )}
              </div>
              
              {index < events.length - 1 && (
                <div className="absolute left-6 top-10 h-6 w-px bg-border" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AuditTrail;