export const PLATFORM_SIDEBAR_GROUPS = [
  {
    titleKey: 'platform.workspaceUi.sidebarGroupOverview',
    links: [
      { href: '/platform/dashboard', labelKey: 'platform.workspaceUi.sidebarPlatform', icon: 'home' },
      { href: '/platform/inbox', labelKey: 'platform.workspaceUi.sidebarInboxSignals', icon: 'notifications' },
      { href: '/platform/clinics', labelKey: 'platform.workspaceUi.sidebarClinicsBranches', icon: 'services' },
      { href: '/platform/branches', labelKey: 'platform.workspaceUi.sidebarBranchesResources', icon: 'calendar' },
      { href: '/platform/users', labelKey: 'platform.workspaceUi.sidebarUsersRoles', icon: 'profile' },
    ],
  },
  {
    titleKey: 'platform.workspaceUi.sidebarGroupAiContent',
    links: [
      { href: '/platform/ai', labelKey: 'platform.workspaceUi.sidebarAiCenter', icon: 'sos' },
      { href: '/platform/templates', labelKey: 'platform.workspaceUi.sidebarTemplatesKnowledge', icon: 'documents' },
    ],
  },
  {
    titleKey: 'platform.workspaceUi.sidebarGroupControl',
    links: [
      { href: '/platform/security', labelKey: 'platform.workspaceUi.sidebarAuditSecurity', icon: 'knowledge' },
      { href: '/platform/settings', labelKey: 'platform.workspaceUi.sidebarSystemSettings', icon: 'tools' },
      { href: '/platform/vpn', labelKey: 'platform.workspaceUi.sidebarVpnOps', icon: 'shield' },
    ],
  },
];

/** Defaults when API has no rows; `routingKey` / `nameKey` resolved in UI via i18n. */
export const AI_PROVIDER_PRESETS = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-5', 'gpt-4.1-mini'],
    status: 'active',
    fallback: 'gpt-4.1-mini',
    routingKey: 'platform.aiPage.providerRouting.openai',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-3.7-sonnet', 'claude-3.5-haiku'],
    status: 'standby',
    fallback: 'claude-3.5-haiku',
    routingKey: 'platform.aiPage.providerRouting.anthropic',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    models: ['gemini-2.0-pro', 'gemini-2.0-flash'],
    status: 'pilot',
    fallback: 'gemini-2.0-flash',
    routingKey: 'platform.aiPage.providerRouting.gemini',
  },
  {
    id: 'local',
    nameKey: 'platform.aiPage.providerNames.local',
    name: 'On-premise perimeter',
    models: ['llama-clinic-70b', 'med-mistral-local'],
    status: 'disabled',
    fallback: 'med-mistral-local',
    routingKey: 'platform.aiPage.providerRouting.local',
  },
];
