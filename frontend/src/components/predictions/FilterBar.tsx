import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterBarProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: string;
  onSortChange: (sort: "volume" | "newest" | "ending-soon") => void;
}

const categories = ["All", "Crypto", "Politics", "Economics", "Sports", "Culture", "Tech"];

export const FilterBar = ({
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange
}: FilterBarProps) => {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-2 md:pb-0 w-full md:w-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              selectedCategory === cat
                ? "bg-ocean-cyan/10 text-ocean-cyan border border-ocean-cyan/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search & Sort */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="relative flex-1 md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-muted/50 border-border/50 focus:border-ocean-cyan/50"
          />
        </div>

        <Select value={sortBy} onValueChange={(v) => onSortChange(v as any)}>
          <SelectTrigger className="w-36 bg-muted/50 border-border/50">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="volume">Volume</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="ending-soon">Ending Soon</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
