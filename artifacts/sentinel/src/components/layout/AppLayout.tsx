import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Cloud, Activity, ShieldAlert, FileText, History, User, LogOut, Bell, Search, Loader2, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

function SidebarItem({ href, icon: Icon, label, isActive, onClick }: { href: string, icon: React.ElementType, label: string, isActive: boolean, onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
      isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    )}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Header for Sidebar Toggle */}
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2 text-primary">
          <ShieldAlert className="h-6 w-6" />
          <span className="font-display font-bold text-lg tracking-tight">Sentinel AWS</span>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleMenu}>
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "w-full md:w-64 bg-card border-r border-border flex-col flex-shrink-0 absolute md:static inset-0 z-50 md:z-auto md:flex transition-transform duration-200",
        mobileMenuOpen ? "flex translate-x-0" : "hidden md:flex -translate-x-full md:translate-x-0"
      )}>
        <div className="h-16 hidden md:flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary">
            <ShieldAlert className="h-6 w-6" />
            <span className="font-display font-bold text-lg tracking-tight">Sentinel AWS</span>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <SidebarItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" isActive={location === "/dashboard" || location === "/"} onClick={() => setMobileMenuOpen(false)} />
          <SidebarItem href="/accounts" icon={Cloud} label="AWS Accounts" isActive={location === "/accounts"} onClick={() => setMobileMenuOpen(false)} />
          <SidebarItem href="/scan" icon={Activity} label="Start Scan" isActive={location === "/scan"} onClick={() => setMobileMenuOpen(false)} />
          <SidebarItem href="/findings" icon={ShieldAlert} label="Findings" isActive={location === "/findings"} onClick={() => setMobileMenuOpen(false)} />
          <SidebarItem href="/reports" icon={FileText} label="Reports" isActive={location === "/reports"} onClick={() => setMobileMenuOpen(false)} />
          <SidebarItem href="/history" icon={History} label="Scan History" isActive={location === "/history"} onClick={() => setMobileMenuOpen(false)} />
        </nav>

        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/profile" className="flex-1">
              <Button variant="outline" className="w-full justify-start text-xs h-8" size="sm" onClick={() => setMobileMenuOpen(false)}>
                <User className="h-3 w-3 mr-2" />
                Profile
              </Button>
            </Link>
            <Button variant="outline" className="px-2 h-8 shrink-0" size="sm" onClick={logout}>
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh]">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex-1 flex items-center max-w-md relative">
            <Search className="h-4 w-4 absolute left-3 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search findings, accounts..." 
              className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-4 ml-4">
            <button className="text-muted-foreground hover:text-foreground relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-destructive border border-card" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-gray-50/50 p-6 md:p-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
