# Agent Discipline — Мастер-план

Улучшение надёжности и предсказуемости агентов в goodai-base: описания-триггеры, защита от рационализаций, протоколы субагентов.
Ветка: `improve/agent-discipline`

## Фазы

| # | Фаза | PRD | Приоритет | Статус |
|---|---|---|---|---|
| 1 | Descriptions как триггеры, не как workflow | [phase-1-cso-descriptions.md](phase-1-cso-descriptions.md) | Высокий | TODO |
| 2 | Защита от рационализаций в скиллах и rules | [phase-2-anti-rationalization.md](phase-2-anti-rationalization.md) | Высокий | TODO |
| 3 | SUBAGENT-STOP в мета-скиллах | [phase-3-subagent-stop.md](phase-3-subagent-stop.md) | Средний | TODO |
| 4 | Статус-протокол субагентов | [phase-4-subagent-status-protocol.md](phase-4-subagent-status-protocol.md) | Высокий | TODO |
| 5 | Двухэтапное code review | [phase-5-two-stage-review.md](phase-5-two-stage-review.md) | Средний | TODO |
| 6 | Явное конструирование контекста субагентов | [phase-6-explicit-context.md](phase-6-explicit-context.md) | Средний | TODO |

## Порядок выполнения

Фазы 1, 2, 4 — высокий приоритет, выполнять первыми (можно параллельно).
Фазы 3, 5, 6 — средний приоритет, после первых трёх.
