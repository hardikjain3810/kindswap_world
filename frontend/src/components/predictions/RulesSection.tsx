import { Market } from "@/pages/PredictionMarkets";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FileText, Database, CheckCircle, Clock } from "lucide-react";

interface RulesSectionProps {
  market: Market;
}

export const RulesSection = ({ market }: RulesSectionProps) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <div className="glass-card p-6 rounded-xl">
      <h2 className="text-lg font-semibold mb-4">Rules & Transparency</h2>
      
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="rules" className="border-border/50">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-ocean-cyan" />
              <span>Rules Summary</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground pb-4">
            <p className="mb-3">{market.description}</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Market resolves based on official, verifiable data sources</li>
              <li>Ambiguous outcomes will be resolved by the resolution committee</li>
              <li>All times are in UTC unless otherwise specified</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="resolution" className="border-border/50">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-ocean-cyan" />
              <span>Resolution Source</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground pb-4">
            <p className="mb-3">This market uses the following data sources for resolution:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Primary: Official announcements from relevant authorities</li>
              <li>Secondary: Major news outlets (Reuters, AP, Bloomberg)</li>
              <li>Tertiary: Independent verification by resolution committee</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="settlement" className="border-border/50">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-4 h-4 text-ocean-cyan" />
              <span>Settlement Conditions</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground pb-4">
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li><strong>Yes:</strong> Resolves if the stated condition is met before the end date</li>
              <li><strong>No:</strong> Resolves if the stated condition is not met by the end date</li>
              <li>Settlement occurs within 24-48 hours of resolution</li>
              <li>Disputes can be raised within 72 hours of preliminary resolution</li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="timeline" className="border-border/50">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-ocean-cyan" />
              <span>Timeline & Payout</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground pb-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Market Start:</span>
                <span className="font-medium text-foreground">{formatDate(market.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span>Market End:</span>
                <span className="font-medium text-foreground">{formatDate(market.endDate)}</span>
              </div>
              <div className="flex justify-between">
                <span>Expected Resolution:</span>
                <span className="font-medium text-foreground">Within 48 hours of end date</span>
              </div>
              <div className="border-t border-border/50 pt-3 mt-3">
                <p>Winning positions pay $1 per share. Losing positions pay $0.</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
