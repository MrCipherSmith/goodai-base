# PRD: Phase 3 — SUBAGENT-STOP теги в мета-скиллах

## Цель

Добавить `<SUBAGENT-STOP>` guard в начало мета-скиллов, чтобы диспатченные субагенты не запускали онбординг и оркестрационный overhead.

## Проблема

Когда оркестратор диспатчит субагента для конкретной задачи, субагент может подхватить мета-скиллы (онбординг, роутинг, context-collector и т.д.) и потратить контекстное окно на инициализацию вместо выполнения задачи. Это:
- Замедляет выполнение
- Засоряет контекст субагента
- Может вызвать рекурсию (субагент диспатчит субсубагентов для онбординга)

## Решение

Добавить в начало каждого мета-скилла:

```markdown
<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill entirely.
This skill is for orchestrators and session-level routing only.
</SUBAGENT-STOP>
```

## Скоп

Скиллы требующие SUBAGENT-STOP:

1. `skills/context-collector/SKILL.md` — сбор контекста, только для оркестратора
2. `skills/job-orchestrator/SKILL.md` — оркестрация, только для верхнего уровня
3. `skills/job-documenter/SKILL.md` — документирование, только для оркестратора
4. `skills/interview/SKILL.md` — интервью с пользователем, только интерактивно
5. `skills/interviewer/SKILL.md` — то же самое
6. `skills/feature-analyzer/SKILL.md` — анализ фич, не для субагентов

## Что НЕ нужно помечать

Скиллы реализации (`task-implementer`, `code-review`, `commit` и др.) — их субагенты должны использовать.

## Acceptance Criteria

- [ ] Все мета-скиллы содержат SUBAGENT-STOP в первом блоке
- [ ] Тег содержит объяснение почему субагент должен пропустить
- [ ] Тег не нарушает рендеринг markdown (корректный XML)
- [ ] Скиллы для реализации НЕ содержат тег

## Приоритет

Средний. Важно для корректности параллельных оркестраций.
