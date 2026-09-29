// Постоянное имя workflow в Hatchet. По нему оба worker'а регистрируют
// одну и ту же сагу и Person запускает новый run.
export const ONBOARDING_WORKFLOW = 'person-onboarding';

// Имена задач — часть межсервисного контракта. Их нельзя переименовывать
// только в одном приложении: эти значения используются для зависимостей,
// чтения parentOutput и отображения run'а в Hatchet UI.
export const STEP = {
  issueLink: 'issue-onboarding-link',
  awaitProfile: 'await-and-save-profile',
  markCompleted: 'mark-profile-completed',
  sendReminder: 'send-reminder',
  sendWelcome: 'send-welcome',
} as const;

// Ключ label, по которому Hatchet выбирает worker для конкретного шага.
export const SERVICE_LABEL = 'service';

// Владелец каждого шага. Person работает со своей БД и вызывает Profile;
// Profile ждёт данные формы и сохраняет профиль в свою БД.
export const STEP_OWNER = {
  [STEP.issueLink]: 'person',
  [STEP.awaitProfile]: 'profile',
  [STEP.markCompleted]: 'person',
  [STEP.sendReminder]: 'person',
  [STEP.sendWelcome]: 'person',
} as const satisfies Record<string, 'person' | 'profile'>;

// Превращает владельца шага в обязательный фильтр worker label.
// `required: true` не даёт Hatchet выполнить Profile-шаг на Person-worker
// или наоборот.
export const requiredLabelFor = (step: keyof typeof STEP_OWNER) => ({
  [SERVICE_LABEL]: { value: STEP_OWNER[step], required: true },
});
