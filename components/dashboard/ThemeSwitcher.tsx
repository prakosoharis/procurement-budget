"use client";

import { Palette } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { THEMES, ThemeName, applyTheme } from "@/lib/theme";

export function ThemeSwitcher({ value, onChange }: { value: ThemeName; onChange: (t: ThemeName) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Palette className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={(v) => { onChange(v as ThemeName); applyTheme(v as ThemeName); }}>
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          {THEMES.map(t => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
