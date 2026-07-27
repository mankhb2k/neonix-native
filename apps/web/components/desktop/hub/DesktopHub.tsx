"use client";

import { useState } from "react";
import { DesktopHubHeader } from "./DesktopHubHeader";
import { DesktopHubSidebar } from "./DesktopHubSidebar";
import { DesktopHubRecentGrid } from "./DesktopHubRecentGrid";
import { NewProjectModal } from "@/components/hub/NewProjectModal";

export function DesktopHub() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#18181a] overflow-hidden">
      {/* Desktop Top Header Bar */}
      <DesktopHubHeader />

      {/* Main Body: Left Sidebar + Recent Content Grid */}
      <div className="flex flex-1 overflow-hidden">
        <DesktopHubSidebar
          onCreateNew={() => setModalOpen(true)}
          onOpen={() => setModalOpen(true)}
        />
        <DesktopHubRecentGrid onCreateNew={() => setModalOpen(true)} />
      </div>

      {/* New Project Modal */}
      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
