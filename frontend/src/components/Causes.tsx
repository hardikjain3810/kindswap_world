import { Heart, GraduationCap, Home, Utensils, TreeDeciduous, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const causes = [
  {
    icon: Utensils,
    name: "Food Security",
    description: "Fighting hunger by providing meals to those in need around the world.",
    color: "from-orange-500 to-amber-500",
  },
  {
    icon: GraduationCap,
    name: "Education",
    description: "Supporting access to quality education for underserved communities.",
    color: "from-ocean-light to-ocean-cyan",
  },
  {
    icon: Home,
    name: "Homelessness",
    description: "Helping provide shelter and support services for homeless individuals.",
    color: "from-ocean-cyan to-ocean-seafoam",
  },
  {
    icon: Stethoscope,
    name: "Healthcare",
    description: "Improving access to medical care and health services globally.",
    color: "from-ocean-seafoam to-emerald-400",
  },
  {
    icon: TreeDeciduous,
    name: "Environment",
    description: "Protecting our planet through conservation and sustainability initiatives.",
    color: "from-emerald-500 to-ocean-seafoam",
  },
  {
    icon: Heart,
    name: "Community Care",
    description: "Supporting local community programs and social welfare initiatives.",
    color: "from-rose-500 to-pink-400",
  },
];

const Causes = () => {
  return (
    <section id="causes" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] rounded-full bg-ocean-deep/10 blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge variant="glass" className="mb-4">
            <Heart className="w-3 h-3 mr-1" />
            Vetted Charities
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Causes We <span className="gradient-text">Support</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Choose where your trading fees go. Every charity is thoroughly vetted 
            to ensure maximum impact and accountability.
          </p>
        </div>

        {/* Causes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {causes.map((cause, index) => (
            <div
              key={index}
              className="group glass-card p-6 hover:border-primary/30 transition-all duration-500 cursor-pointer relative overflow-hidden"
            >
              {/* Background Gradient on Hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${cause.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${cause.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <cause.icon className="w-7 h-7 text-background" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold mb-2 text-foreground">{cause.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{cause.description}</p>
            </div>
          ))}
        </div>

        {/* Note */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          When you trade on KindSwap, you can allocate your contribution to any combination of these causes.
        </p>
      </div>
    </section>
  );
};

export default Causes;