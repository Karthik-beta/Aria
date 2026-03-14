# Contributing to Aria ERP

Thank you for your interest in contributing to Aria ERP! This guide will help you make your first contribution successfully.

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, caste, color, religion, or sexual
identity and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming,
diverse, inclusive, and healthy community.

Please read our full [Code of Conduct](./CODE_OF_CONDUCT.md) before contributing.

## Getting Started

### Prerequisites

Before you begin, make sure you've completed the [Getting Started Guide](../01-getting-started/README.md).

### Finding Something to Work On

1. **Check open issues** - Look for issues labeled `good-first-issue` or `help-wanted`
2. **Review the roadmap** - Check our project boards for planned features
3. **Fix bugs** - Bug fixes are always welcome!
4. **Improve documentation** - Documentation improvements are highly valued

### Before You Start

1. **Comment on the issue** to let others know you're working on it
2. **Ask questions** if anything is unclear
3. **Check for duplicates** to avoid duplicate work

## Development Workflow

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/aria.git
cd aria

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL-OWNER/aria.git
```

### 2. Create a Branch

```bash
# Create a new branch for your feature/fix
git checkout -b feature/your-feature-name

# Or for bug fixes:
git checkout -b fix/bug-description
```

**Branch Naming Convention**:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests

### 3. Make Your Changes

Follow our [Code Standards](#code-standards) while making changes.

### 4. Test Your Changes

```bash
# Format your code
bun format

# Check for style issues
bun run lint

# Run tests
bun run test

# Run type checks
bun run typecheck

# Build to ensure everything compiles
bun run build
```

All of these must pass before submitting!

### 5. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "feat: add user authentication module"
```

**Commit Message Format**:

```
<type>: <description>

[optional body]

[optional footer]
```

**Types**:

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples**:

```bash
feat: add customer export functionality
fix: resolve infinite loop in inventory calculation
docs: update installation instructions
refactor: simplify authentication logic
test: add unit tests for payroll module
```

### 6. Push and Create Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Code Standards

### TypeScript

#### Use Strict Typing

```typescript
// ✅ Good
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Bad
function calculateTotal(items: any): any {
  return items.reduce((sum: any, item: any) => sum + item.price, 0);
}
```

#### Import from Shared Packages

```typescript
// ✅ Good
import { User, Product } from '@aria/types';
import { formatCurrency } from '@aria/utils';

// ❌ Bad
interface User {
  name: string;
  email: string;
}
```

### React/Next.js

#### Use Server Components by Default

```tsx
// ✅ Good - Server Component (default)
export default function UserList({ users }: { users: User[] }) {
  return (
    <div>
      {users.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}

// Only use 'use client' when needed
('use client');
export function InteractiveButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

#### Use Path Aliases

```typescript
// ✅ Good
import { UserCard } from '@/components/UserCard';
import { formatDate } from '@/lib/utils';

// ❌ Bad
import { UserCard } from '../../components/UserCard';
import { formatDate } from '../../../lib/utils';
```

### NestJS

#### Generate with CLI

```bash
# ✅ Good - Use the CLI
cd apps/backend
bun nest g module users
bun nest g controller users
bun nest g service users

# ❌ Bad - Manually creating files
```

#### Keep Controllers Thin

```typescript
// ✅ Good - Thin controller
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}

// ✅ Good - Logic in service
@Injectable()
export class UsersService {
  async findAll() {
    // All business logic here
    const users = await this.userRepository.find();
    return users.map((user) => this.transformUser(user));
  }
}
```

### Code Style

- **Formatting**: Prettier handles this automatically
- **Linting**: ESLint catches issues
- **Naming**:
  - Components: `PascalCase` (e.g., `UserCard.tsx`)
  - Functions/variables: `camelCase` (e.g., `getUserById`)
  - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
  - Files: Match the main export (e.g., `UserCard.tsx` exports `UserCard`)

## Testing Requirements

### When to Write Tests

- **New features**: Always include tests
- **Bug fixes**: Add a test that would have caught the bug
- **Refactoring**: Ensure existing tests still pass

### Test Structure

```typescript
// Example: Unit test
describe('calculateDiscount', () => {
  it('should calculate percentage discount correctly', () => {
    const result = calculateDiscount(100, 20);
    expect(result).toBe(80);
  });

  it('should handle zero discount', () => {
    const result = calculateDiscount(100, 0);
    expect(result).toBe(100);
  });

  it('should throw error for invalid discount', () => {
    expect(() => calculateDiscount(100, -10)).toThrow();
  });
});
```

### Running Tests

```bash
# Run all tests
bun run test

# Run tests for specific app
bun --filter backend test
bun --filter frontend test

# Run tests in watch mode
bun --filter backend test:watch

# Run tests with coverage
bun --filter backend test:cov
```

## Submitting Changes

### Pull Request Checklist

Before submitting, ensure:

- [ ] Code follows style guidelines
- [ ] `bun format` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds
- [ ] Tests added for new features
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow convention
- [ ] PR description explains the changes

### Writing a Good PR Description

```markdown
## Description

Brief summary of what this PR does

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues

Closes #123

## Changes Made

- Added user authentication module
- Updated login page UI
- Added tests for auth service

## Testing

- Tested login flow manually
- All unit tests pass
- Added integration tests for auth endpoints

## Screenshots (if applicable)

[Add screenshots for UI changes]

## Development Agents Alignment

- **Simplicity**: Used NestJS CLI for code generation
- **Type Safety**: Imported types from @aria/types
- **Automation**: Added tests and updated CI
- **Quality**: Maintained test coverage above 80%
```

## Review Process

### What Reviewers Look For

1. **Correctness**: Does the code work as intended?
2. **Style**: Does it follow our standards?
3. **Tests**: Are there adequate tests?
4. **Documentation**: Is it documented appropriately?
5. **Performance**: Are there any performance concerns?
6. **Security**: Are there any security issues?

### Addressing Feedback

1. **Be open to feedback** - Reviews help improve code quality
2. **Ask questions** - If feedback is unclear, ask for clarification
3. **Make requested changes** - Address all reviewer comments
4. **Push updates** - Commit and push your changes
5. **Re-request review** - Let reviewers know you've addressed their feedback

### After Approval

1. **Squash commits** (if requested)
2. **Merge** - A maintainer will merge your PR
3. **Delete branch** - Clean up after merging
4. **Celebrate!** 🎉
