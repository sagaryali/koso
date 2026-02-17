"use client";

import { useState } from "react";
import {
  Home,
  FileText,
  Settings,
  Search,
  Plus,
  ChevronDown,
  Trash2,
  Edit3,
  Copy,
  Star,
  Zap,
  BarChart3,
  Users,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextArea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/ui/command-palette";
import { Sidebar } from "@/components/ui/sidebar";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";

const samplePaletteContext = {
  workspaceId: "ws-1",
  workspace: {
    name: "Demo Workspace",
    productDescription: "A demo product for testing",
    principles: ["Move fast", "User first"],
  },
  artifact: {
    id: "demo-1",
    workspaceId: "ws-1",
    title: "Demo Artifact",
    type: "prd",
    content: "This is a demo artifact for testing the command palette.",
  },
};

const sidebarSections = [
  {
    items: [
      { label: "Home", icon: Home, active: true, onClick: () => {} },
      { label: "Documents", icon: FileText, onClick: () => {} },
      { label: "Analytics", icon: BarChart3, onClick: () => {} },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Team", icon: Users, onClick: () => {} },
      { label: "Settings", icon: Settings, onClick: () => {} },
    ],
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
      {children}
    </div>
  );
}

export default function DevPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="border-b border-border-default px-12 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Component Library</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Every component in every variant. Visual verification against the style guide.
        </p>
      </div>

      <div className="space-y-16 px-12 py-12">
        {/* Buttons */}
        <Section title="Button">
          <SubSection title="Variants">
            <div className="flex items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </SubSection>

          <SubSection title="Sizes">
            <div className="flex items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </SubSection>

          <SubSection title="With icons">
            <div className="flex items-center gap-3">
              <Button variant="primary" icon={Plus}>Create</Button>
              <Button variant="secondary" icon={Search}>Search</Button>
              <Button variant="ghost" icon={Settings}>Settings</Button>
            </div>
          </SubSection>

          <SubSection title="Disabled">
            <div className="flex items-center gap-3">
              <Button variant="primary" disabled>Disabled</Button>
              <Button variant="secondary" disabled>Disabled</Button>
              <Button variant="ghost" disabled>Disabled</Button>
            </div>
          </SubSection>
        </Section>

        {/* Input */}
        <Section title="Input">
          <div className="max-w-md space-y-6">
            <Input label="Email" placeholder="you@example.com" />
            <Input label="With helper" placeholder="Enter value" helperText="This is helper text" />
            <Input label="Error state" placeholder="Enter value" error="This field is required" defaultValue="bad value" />
            <Input placeholder="No label, just placeholder" />
          </div>
        </Section>

        {/* TextArea */}
        <Section title="TextArea">
          <div className="max-w-md space-y-6">
            <TextArea label="Description" placeholder="Write something..." />
            <TextArea label="With error" error="Too short" defaultValue="Hi" />
            <TextArea label="With helper" helperText="Markdown supported" placeholder="Write your content..." />
          </div>
        </Section>

        {/* Badge */}
        <Section title="Badge">
          <div className="flex items-center gap-3">
            <Badge>Default</Badge>
            <Badge>In Progress</Badge>
            <Badge variant="inverse">Inverse</Badge>
            <Badge variant="inverse">Active</Badge>
          </div>
        </Section>

        {/* Card */}
        <Section title="Card">
          <div className="grid max-w-2xl grid-cols-2 gap-6">
            <Card>
              <h3 className="text-sm font-medium">Static Card</h3>
              <p className="mt-2 text-sm text-text-secondary">
                Default card with no hover state.
              </p>
            </Card>
            <Card interactive onClick={() => {}}>
              <h3 className="text-sm font-medium">Interactive Card</h3>
              <p className="mt-2 text-sm text-text-secondary">
                Hover to see the border change. Cursor is pointer.
              </p>
            </Card>
          </div>
        </Section>

        {/* Dialog */}
        <Section title="Dialog">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open Dialog
          </Button>
          <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
            <h2 className="text-lg font-medium">Dialog Title</h2>
            <p className="mt-3 text-sm text-text-secondary">
              This is a modal dialog. It traps focus, closes on Escape, and has a backdrop blur overlay. Try tabbing through — focus stays inside.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="primary" onClick={() => setDialogOpen(false)}>
                Confirm
              </Button>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </Dialog>
        </Section>

        {/* DropdownMenu */}
        <Section title="DropdownMenu">
          <div className="flex gap-6">
            <DropdownMenu
              trigger={<Button variant="secondary" icon={ChevronDown}>Actions</Button>}
              items={[
                { label: "Edit", onClick: () => {} },
                { label: "Duplicate", onClick: () => {} },
                { label: "Delete", onClick: () => {} },
                { label: "Disabled item", onClick: () => {}, disabled: true },
              ]}
            />
            <DropdownMenu
              trigger={<Button variant="ghost" icon={ChevronDown}>Right aligned</Button>}
              align="right"
              items={[
                { label: "Option A", onClick: () => {} },
                { label: "Option B", onClick: () => {} },
                { label: "Option C", onClick: () => {} },
              ]}
            />
          </div>
        </Section>

        {/* Tooltip */}
        <Section title="Tooltip">
          <div className="flex items-center gap-8">
            <Tooltip content="Top tooltip (default)">
              <Button variant="secondary">Hover me (top)</Button>
            </Tooltip>
            <Tooltip content="Bottom tooltip" position="bottom">
              <Button variant="secondary">Hover me (bottom)</Button>
            </Tooltip>
            <Tooltip content="Left tooltip" position="left">
              <Button variant="secondary">Hover me (left)</Button>
            </Tooltip>
            <Tooltip content="Right tooltip" position="right">
              <Button variant="secondary">Hover me (right)</Button>
            </Tooltip>
          </div>
        </Section>

        {/* CommandPalette */}
        <Section title="CommandPalette">
          <Button variant="secondary" icon={Search} onClick={() => setCommandOpen(true)}>
            Open Command Palette (Cmd+K)
          </Button>
          <CommandPalette
            open={commandOpen}
            onClose={() => setCommandOpen(false)}
            context={samplePaletteContext}
          />
        </Section>

        {/* Icon */}
        <Section title="Icon">
          <div className="flex items-center gap-4">
            <Icon icon={Home} />
            <Icon icon={FileText} />
            <Icon icon={Settings} />
            <Icon icon={Search} />
            <Icon icon={Plus} />
            <Icon icon={Trash2} />
            <Icon icon={Edit3} />
            <Icon icon={Copy} />
            <Icon icon={Star} />
            <Icon icon={Zap} />
          </div>
          <p className="mt-3 text-xs text-text-tertiary">
            16px, 1.5 stroke weight, consistent via Icon wrapper
          </p>
        </Section>

        {/* Skeleton */}
        <Section title="Skeleton">
          <div className="grid max-w-lg grid-cols-1 gap-8">
            <SubSection title="Text (single line)">
              <Skeleton variant="text" />
              <Skeleton variant="text" width="60%" />
            </SubSection>
            <SubSection title="Block">
              <Skeleton variant="block" height={100} />
            </SubSection>
            <SubSection title="List (multiple lines)">
              <Skeleton variant="list" lines={4} />
            </SubSection>
          </div>
        </Section>

        {/* Sidebar */}
        <Section title="Sidebar">
          <div className="flex gap-4">
            <Button
              variant="secondary"
              icon={sidebarCollapsed ? PanelLeft : PanelLeftClose}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? "Expand" : "Collapse"} Sidebar
            </Button>
          </div>
          <div className="flex h-[320px] overflow-hidden border border-border-default">
            <Sidebar
              sections={sidebarSections}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <div className="flex-1 p-6">
              <p className="text-sm text-text-secondary">
                Main content area. The sidebar is {sidebarCollapsed ? "collapsed (56px)" : "expanded (240px)"}.
              </p>
            </div>
          </div>
        </Section>

        {/* ResizablePanel */}
        <Section title="ResizablePanel">
          <div className="flex gap-4">
            <Button
              variant="secondary"
              icon={panelCollapsed ? PanelRight : PanelRightClose}
              onClick={() => setPanelCollapsed(!panelCollapsed)}
            >
              {panelCollapsed ? "Expand" : "Collapse"} Panel
            </Button>
          </div>
          <div className="flex h-[240px] overflow-hidden border border-border-default">
            <div className="flex-1 p-6">
              <p className="text-sm text-text-secondary">
                Main content area. The right panel is {panelCollapsed ? "collapsed" : "expanded (320px)"}.
              </p>
            </div>
            <ResizablePanel width={320} collapsed={panelCollapsed} onToggle={() => setPanelCollapsed(!panelCollapsed)}>
              <div className="p-6">
                <h3 className="text-sm font-medium">Panel Content</h3>
                <p className="mt-2 text-xs text-text-secondary">
                  This panel collapses with a smooth 200ms width transition.
                </p>
              </div>
            </ResizablePanel>
          </div>
        </Section>
      </div>
    </div>
  );
}
