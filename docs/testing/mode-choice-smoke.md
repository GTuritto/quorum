# Codex mode-choice smoke test

Run with a source-built install in a disposable Codex project and a fresh chat.
Record the visible picker, the prompts, and the final receipt. Static contract
tests do not establish that the host shows or follows the chooser.

| Request | Expected observation |
| --- | --- |
| Select Quorum in the picker | One Quorum entry with a mode-choice description; inserted prompt asks for a choice. |
| Send the inserted prompt with a review task | Auto, Direct, Mini, Full, and Super are explained before task work, with worker and time/use indicators. No worker launches before the answer. |
| Choose Auto | Quorum selects Direct, Mini, or Full for the task; the receipt reports the actual tier. |
| Choose Super without settings | Quorum asks for a task-specific model/effort allocation before dispatch. No default to maximum effort. |
| Ask for Mini explicitly in the first request | No chooser; Mini runs with zero delegated workers. |
| Use a leading `Direct:` request | No chooser or optional deliberation; authorization and other Direct rules still apply. |
| Invoke Quorum without a task | The chooser asks for the task with the mode, then waits. |

Check the installed `agents/openai.yaml` and `VERSION` if Codex shows stale
picker text. Use a fresh chat after changing the installation.
