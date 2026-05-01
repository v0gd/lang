# AGENTS.md

## Project Overview

TBD

Use `README.md` as the operations runbook. This file is only a map for coding agents and should point to source files rather than repeat setup instructions.

## Working Notes For Agents

TBD

## Style guide

- Full variable names, e.g. not zurichLoc, but zurichLocation. Standard idx or id is fine.
- Don't be silent, prefer notifyError to printf for unexpected errors. No one reads printf.
- Use structured outputs instead of asking LLMs to produce output in a certain format. This includes optional responses - e.g. use an array or a boolean field in the structured LLM output instead of asking it to print some constant string like "None" or "Empty".
- The project owner is an experienced engineer - when working on tasks always consult with him on important decisions.
- The project owner might've missed something or forgot to update some temporary code - don't hesitate to remind him or judge his decision or current state of the project.
- Prefer semantically correct and descriptive names, e.g. `scheduleWakeupEventIfNeededPostDialogue` instead of a vague `decideWakeupEvent`.
- Treat code as production-ready. It's not a prototype. Make sure to clean up memory, use best security practices, error checking and recovery, loud logging, etc.
