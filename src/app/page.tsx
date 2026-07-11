"use client";

import * as React from "react";
import { SingleScreenShell } from "@/components/dashboard/single-screen-shell";
import { useFloatingPanelStore } from "@/store/use-floating-panel";
import { OverviewSection } from "@/components/dashboard/sections/overview";
import { CalendarSection } from "@/components/dashboard/sections/calendar-section";
import { CallPadSection } from "@/components/dashboard/sections/callpad";
import { ContactsSection } from "@/components/dashboard/sections/contacts";
import { TasksSection } from "@/components/dashboard/sections/tasks";
import { HabitsSection } from "@/components/dashboard/sections/habits";
import { ExpensesSection } from "@/components/dashboard/sections/expenses";
import { FinancesSection } from "@/components/dashboard/sections/finances";
import { DebtsSection } from "@/components/dashboard/sections/debts";
import { ProjectsSection } from "@/components/dashboard/sections/projects";
import { MeetingsSection } from "@/components/dashboard/sections/meetings";
import { IslamicSection } from "@/components/dashboard/sections/islamic";
import { HealthSection } from "@/components/dashboard/sections/health";
import { DiarySection } from "@/components/dashboard/sections/diary";
import { AccountsSection } from "@/components/dashboard/sections/accounts";
import { OccasionsSection } from "@/components/dashboard/sections/occasions";
import { NotesSection } from "@/components/dashboard/sections/notes";
import { ActivitySection } from "@/components/dashboard/sections/activity";
import { RecycleBinSection } from "@/components/dashboard/sections/recycle-bin";
import { SettingsSection } from "@/components/dashboard/sections/settings";
import { SuggestionsSection } from "@/components/dashboard/sections/suggestions";
import { MapsSection } from "@/components/dashboard/sections/maps";
import { AiInsightsSection } from "@/components/dashboard/sections/ai-insights";
import { BudgetSection } from "@/components/dashboard/sections/budget";
import { IntegrationsSection } from "@/components/dashboard/sections/integrations";
import { AutomationSection } from "@/components/dashboard/sections/automation";
import { ScheduledMessagesSection } from "@/components/dashboard/sections/scheduled-messages";
import { WaitingListSection } from "@/components/dashboard/sections/waiting-list";
import { ContactRemindersSection } from "@/components/dashboard/sections/contact-reminders";
import { AppearanceSection } from "@/components/dashboard/sections/appearance";
import { HomeManagementSection } from "@/components/dashboard/sections/home-management";
import { GamificationSection } from "@/components/dashboard/sections/gamification";
import { AnalyticsSection } from "@/components/dashboard/sections/analytics";
import { SmartNotificationsSection } from "@/components/dashboard/sections/smart-notifications";
import { PomodoroWidget } from "@/components/dashboard/widgets/pomodoro";
import { AIAssistantWidget } from "@/components/dashboard/widgets/ai-assistant";
import { SmartNotificationsWidget } from "@/components/dashboard/widgets/smart-notifications";
import { PinLockScreen } from "@/components/dashboard/pin-lock";
import { useAppSettings } from "@/hooks/use-app-settings";
import { SectionErrorBoundary } from "@/components/dashboard/section-error-boundary";
import { DeviceSection } from "@/components/dashboard/sections/device";
import { PermissionsManager } from "@/components/dashboard/permissions-manager";

export default function Home() {
  const { activePanel } = useFloatingPanelStore();
  const { settings, unlocked, unlock } = useAppSettings();

  const renderPanel = () => {
    switch (activePanel) {
      case "overview": return <OverviewSection />;
      case "calendar": return <CalendarSection />;
      case "tasks": return <TasksSection />;
      case "contacts": return <ContactsSection />;
      case "callpad": return <CallPadSection />;
      case "notes": return <NotesSection />;
      case "habits": return <HabitsSection />;
      case "expenses": return <ExpensesSection />;
      case "finances": return <FinancesSection />;
      case "debts": return <DebtsSection />;
      case "projects": return <ProjectsSection />;
      case "meetings": return <MeetingsSection />;
      case "islamic": return <IslamicSection />;
      case "health": return <HealthSection />;
      case "diary": return <DiarySection />;
      case "accounts": return <AccountsSection />;
      case "occasions": return <OccasionsSection />;
      case "activity": return <ActivitySection />;
      case "recyclebin": return <RecycleBinSection />;
      case "maps": return <MapsSection />;
      case "aiinsights": return <AiInsightsSection />;
      case "budget": return <BudgetSection />;
      case "integrations": return <IntegrationsSection />;
      case "automation": return <AutomationSection />;
      case "scheduledmsgs": return <ScheduledMessagesSection />;
      case "waitinglist": return <WaitingListSection />;
      case "reminders": return <ContactRemindersSection />;
      case "appearance": return <AppearanceSection />;
      case "home": return <HomeManagementSection />;
      case "gamification": return <GamificationSection />;
      case "analytics": return <AnalyticsSection />;
      case "smartnotifs": return <SmartNotificationsSection />;
      case "shopping": return <TasksSection />;
      case "ai": return <AIAssistantWidget />;
      case "pomodoro": return <PomodoroWidget />;
      case "notifications": return <SmartNotificationsWidget />;
      case "settings": return <SettingsSection />;
      case "suggestions": return <SuggestionsSection />;
      case "device": return <DeviceSection />;
      default: return <OverviewSection />;
    }
  };

  if (!settings.loaded) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-emerald-glow/30 blur-lg animate-pulse" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-glow to-amber-glow text-background font-bold text-xl">ع</div>
          </div>
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (settings.pinEnabled && settings.pinCode && !unlocked) {
    return <PinLockScreen pinCode={settings.pinCode} onUnlock={unlock} />;
  }

  return (
    <SingleScreenShell>
      <SectionErrorBoundary name={activePanel}>
        {renderPanel()}
      </SectionErrorBoundary>
    </SingleScreenShell>
  );
}
