# Remove AI code slop

Create a separate branch for this task

Check the diff against master, and remove all AI generated slop introduced in master branch.

This includes:

- Extra comments that a human wouldn't add or is inconsistent with the rest of the file
- Extra defensive checks or try/catch blocks that are abnormal for that area of the codebase (especially if called by trusted / validated codepaths)
- Casts to any to get around type issues
- Any other style that is inconsistent with the file

Report at the end with only a 1-3 sentence summary of what you changed


# V2 - Remove AI code slop

When making any code changes in this repository, strictly follow the **latest official documentation and recommended guidelines** of the relevant technologies and frameworks used in the project.

Requirements:

* Before implementing a change, verify the approach using the **current official documentation** of the framework, library, or tool involved.
* Prefer **official best practices and idiomatic patterns** over ad-hoc solutions or patterns learned from outdated tutorials.
* Do **not rely on assumptions, memory, or older patterns** if the official documentation recommends a different approach.
* If the existing code conflicts with current official guidelines, **refactor it to align with the latest recommended patterns**.
* Avoid introducing deprecated APIs, experimental features, or undocumented workarounds unless absolutely required and clearly justified.
* Ensure configuration, architecture, and implementation match **how the maintainers of the technology recommend using it**.
* When multiple approaches exist, choose the one **explicitly recommended in the official documentation**.

Process expectations:

1. Identify the relevant framework/tool involved in the change.
2. Consult the **latest official documentation** for that tool.
3. Implement the solution according to the official guidelines.
4. Avoid inventing custom patterns when an official pattern already exists.

Do not implement speculative fixes or "AI-style" workarounds. All changes must align with the **current official ecosystem standards**.

At the end, briefly state which official documentation or guideline informed the implementation.
