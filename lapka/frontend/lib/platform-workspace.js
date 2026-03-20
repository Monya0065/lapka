export const PLATFORM_SIDEBAR_GROUPS = [
  {
    title: 'Обзор',
    links: [
      { href: '/platform/dashboard', label: 'Платформа', icon: 'home' },
      { href: '/platform/inbox', label: 'Входящие и сигналы', icon: 'notifications' },
      { href: '/platform/clinics', label: 'Клиники и филиалы', icon: 'services' },
      { href: '/platform/branches', label: 'Филиалы и ресурсы', icon: 'calendar' },
      { href: '/platform/users', label: 'Пользователи и роли', icon: 'profile' },
    ],
  },
  {
    title: 'AI и контент',
    links: [
      { href: '/platform/ai', label: 'Центр AI', icon: 'sos' },
      { href: '/platform/templates', label: 'Шаблоны и знания', icon: 'documents' },
    ],
  },
  {
    title: 'Контроль',
    links: [
      { href: '/platform/security', label: 'Аудит и безопасность', icon: 'knowledge' },
      { href: '/platform/settings', label: 'Системные настройки', icon: 'tools' },
    ],
  },
];

export const AI_PROVIDER_PRESETS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-5', 'gpt-4.1-mini'], status: 'active', fallback: 'gpt-4.1-mini', routing: 'срочность для владельца и объяснение документов' },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3.7-sonnet', 'claude-3.5-haiku'], status: 'standby', fallback: 'claude-3.5-haiku', routing: 'черновики протоколов и структурирование заметок врача' },
  { id: 'gemini', name: 'Gemini', models: ['gemini-2.0-pro', 'gemini-2.0-flash'], status: 'pilot', fallback: 'gemini-2.0-flash', routing: 'поиск по базе знаний и сценарии с опорой на проверенный контекст' },
  { id: 'local', name: 'Локальный контур', models: ['llama-clinic-70b', 'med-mistral-local'], status: 'disabled', fallback: 'med-mistral-local', routing: 'чувствительные клиники и локальные инсталляции' },
];
