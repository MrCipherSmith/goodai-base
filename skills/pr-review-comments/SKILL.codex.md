---
name: pr-review-comments
description: "Собирает комментарии к указанному PR (по ссылке) через GitHub MCP или gh, группирует по авторам, при комментариях от boss предлагает обновить правило core/code-review-boss-profile.mdc (с согласия пользователя), анализирует каждый комментарий и даёт объяснение и возможный фикс. Триггеры: разбери комментарии к PR, комментарии к PR, pr review comments, обнови правило по ревью boss."
---

# PR Review Comments — разбор комментариев к PR

Субагент обрабатывает запросы вида «разбери комментарии к PR [ссылка]», «вытащи все комментарии из PR и дай фиксы», «что написал boss в PR?» и т.п.

## Вход

- Пользователь указывает **ссылку на PR** (например `https://github.com/<ORG>/<PROJECT>/pull/123` или `<ORG>/<PROJECT>#123`).
- Из ссылки извлечь: **owner**, **repo**, **pullNumber** (номер PR).

## Шаг 1: Получить все комментарии к PR

Использовать **GitHub MCP** (предпочтительно) или **gh CLI**.

### Через GitHub MCP

1. **Review comments** (комментарии к строкам кода):
   - `mcp_github_pull_request_read` с `method: "get_review_comments"`, `owner`, `repo`, `pullNumber`.
   - При необходимости пагинация: `perPage`, `page` или `after` (если API возвращает cursor).

2. **Общие комментарии к PR** (обсуждение):
   - `mcp_github_pull_request_read` с `method: "get_comments"`, `owner`, `repo`, `pullNumber`.

3. **Ревью-вердикты** (APPROVE / REQUEST_CHANGES / COMMENT):
   - `mcp_github_pull_request_read` с `method: "get_reviews"`, `owner`, `repo`, `pullNumber`.

### Через gh CLI (если MCP недоступен)

```bash
# Review comments (к строкам)
gh api repos/{owner}/{repo}/pulls/{pullNumber}/comments

# Issue/PR comments (общее обсуждение)
gh api repos/{owner}/{repo}/issues/{pullNumber}/comments

# Reviews
gh api repos/{owner}/{repo}/pulls/{pullNumber}/reviews
```

Собрать в единый список все комментарии с полями: **author (login)**, **body**, **path**, **line** (если есть), **created_at**, **id** (для ссылок).

## Шаг 2: Группировка по пользователю

Сгруппировать комментарии по **author.login** (или `user.login` в ответах API). Вывести сводку:

- по каждому автору: количество комментариев и перечень (файл:строка — кратко, либо «общий комментарий»).

## Шаг 3: Комментарии от boss и правило core/code-review-boss-profile.mdc

- Если среди авторов есть **boss**:
  - Явно сообщить: «В PR есть комментарии от boss.»
  - Действовать по правилу **core/code-review-boss-profile.mdc** (в workspace: `.cursor/rules/core/code-review-boss-profile.mdc`), раздел **7. Анализ комментариев к новым PR и обновление правила**:
    - Не обновлять правило и промпт без явного согласия пользователя.
    - После разбора комментариев **обязательно спросить**: «Нужно ли учесть комментарии boss и обновить правило и промпт (разделы 2–5 в core/code-review-boss-profile.mdc)?»
  - При согласии пользователя обновлять правило по **.cursor/rules/core/rule-management-workflow.mdc**:
    1. Источник правил — **~/goodai-base/rules/** (мастер); обновить там `core/code-review-boss-profile.mdc`.
    2. Обновить `~/goodai-base/AGENTS.md` при изменении индекса.
    3. Запустить синхронизацию (`~/goodai-base/scripts/sync-skills.sh`) в workspace.
  - Добавлять в правило только обобщённые паттерны/формулировки из комментариев boss (как в разделах 2 и 2.11 правила core/code-review-boss-profile.mdc), без копирования личных фраз.

- Если комментариев от boss нет — сообщить об этом; правило не менять.

## Шаг 4: Анализ каждого комментария — объяснение и возможный фикс

По каждому комментарию (все авторы) выдать:

1. **Где**: файл, строка (или «общий комментарий к PR»).
2. **Кто**: автор (login).
3. **Текст**: цитата комментария.
4. **Объяснение**: что имеет в виду ревьюер, к какому типу замечания это относится (архитектура, типы, конвенции, линт, scope и т.д.).
5. **Возможный фикс**: конкретные шаги или пример кода/правки, как удовлетворить замечание (если применимо). Если фикс неочевиден или требует обсуждения — так и написать.

Группировку вывода можно сохранить по авторам, внутри автора — по файлам/строкам.

## Парсинг ссылки на PR

- `https://github.com/<owner>/<repo>/pull/<pullNumber>` → owner, repo, pullNumber.
- `https://github.com/<owner>/<repo>/issues/<pullNumber>` → для PR номера issue совпадает с номером PR.
- `<owner>/<repo>#<pullNumber>` → owner, repo, pullNumber.

## Краткий чек-лист

- [ ] Извлечь owner, repo, pullNumber из ссылки пользователя.
- [ ] Загрузить review comments, issue comments, reviews через MCP или gh.
- [ ] Сгруппировать комментарии по автору и вывести сводку.
- [ ] Если есть boss — следовать разделу 7 правила core/code-review-boss-profile.mdc (спросить про обновление правила; при «да» — правило rule-management-workflow, источник ~/goodai-base/rules).
- [ ] По каждому комментарию: объяснение + возможный фикс.
