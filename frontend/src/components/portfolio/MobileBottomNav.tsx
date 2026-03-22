import { ArrowRightLeft, LayoutDashboard, Heart, Trophy } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface MobileBottomNavProps {
  activeTab: string;
}

export const MobileBottomNav = ({ activeTab }: MobileBottomNavProps) => {
  const location = useLocation();

  const navItems = [
    { icon: ArrowRightLeft, label: "Swap", href: "/" },
    { icon: LayoutDashboard, label: "Portfolio", href: "/portfolio" },
    { icon: Heart, label: "Impact", href: "/impact-dashboard" },
    { icon: Trophy, label: "Leaderboard", href: "/" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden backdrop-blur-xl bg-background/90 border-t border-border">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.label}
              to={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                isActive ? "text-ocean-cyan" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
