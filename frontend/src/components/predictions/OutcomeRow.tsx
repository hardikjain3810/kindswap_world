interface Outcome {
  name: string;
  probability: number;
  yesPrice: number;
  noPrice: number;
}

interface OutcomeRowProps {
  outcome: Outcome;
  isSelected: boolean;
  onSelect: (outcomeName: string, action: "yes" | "no") => void;
}

export const OutcomeRow = ({ outcome, isSelected, onSelect }: OutcomeRowProps) => {
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
      isSelected ? "bg-ocean-cyan/10 border border-ocean-cyan/30" : "bg-muted/30 border border-transparent hover:bg-muted/50"
    }`}>
      {/* Outcome Info */}
      <div className="flex-1 min-w-0 mr-4">
        <p className="font-medium truncate">{outcome.name}</p>
        <p className="text-sm text-muted-foreground">{outcome.probability}% chance</p>
      </div>

      {/* Yes/No Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSelect(outcome.name, "yes")}
          className="flex flex-col items-center px-4 py-2 rounded-lg bg-ocean-seafoam/10 border border-ocean-seafoam/20 hover:bg-ocean-seafoam/20 transition-colors min-w-[72px]"
        >
          <span className="text-xs text-muted-foreground">Yes</span>
          <span className="text-sm font-semibold text-ocean-seafoam">
            {Math.round(outcome.yesPrice * 100)}¢
          </span>
        </button>

        <button
          onClick={() => onSelect(outcome.name, "no")}
          className="flex flex-col items-center px-4 py-2 rounded-lg bg-ocean-light/10 border border-ocean-light/20 hover:bg-ocean-light/20 transition-colors min-w-[72px]"
        >
          <span className="text-xs text-muted-foreground">No</span>
          <span className="text-sm font-semibold text-ocean-light">
            {Math.round(outcome.noPrice * 100)}¢
          </span>
        </button>
      </div>
    </div>
  );
};
