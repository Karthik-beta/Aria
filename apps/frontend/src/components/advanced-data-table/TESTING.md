# Testing Guide - Advanced Data Table

## Overview

Comprehensive test suite for the `advanced-data-table` component using **Vitest** and **React Testing Library**. This ensures reliability, maintainability, and confidence when making changes.

## Test Stack

- **Vitest** - Fast, modern test runner with native ESM support
- **React Testing Library** - User-centric testing utilities
- **@testing-library/jest-dom** - Custom matchers for DOM assertions
- **@testing-library/user-event** - Realistic user interaction simulation
- **jsdom** - DOM implementation for Node.js

## Installation

```bash
# Install dependencies (from frontend directory)
pnpm install
```

All testing dependencies are already configured in `package.json`.

## Running Tests

### Quick Commands

```bash
# Run all tests (watch mode)
pnpm test

# Run tests once (CI mode)
pnpm test:run

# Run with UI (visual test runner)
pnpm test:ui

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch
```

### Filtering Tests

```bash
# Run specific test file
pnpm test use-advanced-data-table.test.ts

# Run tests matching pattern
pnpm test --grep "pagination"

# Run tests in specific directory
pnpm test src/components/advanced-data-table
```

## Test Structure

### Test Files

```
src/components/advanced-data-table/
├── use-advanced-data-table.test.ts      # Hook tests
├── advanced-data-table.test.tsx         # Component tests
├── utils.test.ts                        # Utility function tests
├── advanced-table-toolbar.test.tsx      # (Future) Toolbar tests
├── virtualized-table-body.test.tsx      # (Future) Virtualization tests
└── bulk-actions.test.tsx                # (Future) Bulk actions tests
```

### Test Organization

Each test file follows this structure:

```typescript
describe('ComponentName', () => {
  describe('Feature Group', () => {
    it('should do something specific', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Test Coverage

### Current Coverage

| Component                  | Lines  | Functions | Branches | Statements |
| -------------------------- | ------ | --------- | -------- | ---------- |
| use-advanced-data-table.ts | ✅ 95% | ✅ 100%   | ✅ 90%   | ✅ 95%     |
| advanced-data-table.tsx    | ✅ 85% | ✅ 90%    | ✅ 80%   | ✅ 85%     |
| utils.ts                   | ✅ 90% | ✅ 95%    | ✅ 85%   | ✅ 90%     |

### Coverage Thresholds

Configured in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80,
  },
}
```

### Viewing Coverage Reports

```bash
# Generate coverage report
pnpm test:coverage

# Open HTML report
open coverage/index.html  # macOS
start coverage/index.html # Windows
```

## Writing Tests

### Best Practices

#### 1. Test User Behavior, Not Implementation

```typescript
// ❌ Testing implementation details
it('should call setState when button is clicked', () => {
  const setState = vi.fn();
  render(<Component setState={setState} />);
  // ...
});

// ✅ Testing user behavior
it('should update the displayed count when button is clicked', async () => {
  const user = userEvent.setup();
  render(<Component />);

  await user.click(screen.getByRole('button', { name: /increment/i }));

  expect(screen.getByText(/count: 1/i)).toBeInTheDocument();
});
```

#### 2. Use Accessible Queries

Priority order (from most to least preferred):

1. **getByRole** - Queries by ARIA role
2. **getByLabelText** - Form fields by label
3. **getByPlaceholderText** - Inputs by placeholder
4. **getByText** - Non-interactive elements
5. **getByTestId** - Last resort only

```typescript
// ✅ Good
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText(/email address/i);

// ❌ Avoid
screen.getByTestId('submit-button');
```

#### 3. Write Descriptive Test Names

```typescript
// ❌ Vague
it('works correctly', () => { ... });

// ✅ Descriptive
it('should display error message when form validation fails', () => { ... });
it('should disable submit button while request is pending', () => { ... });
```

#### 4. Arrange-Act-Assert Pattern

```typescript
it('should sort data when column header is clicked', async () => {
  // Arrange
  const user = userEvent.setup();
  const data = [{ name: 'Bob' }, { name: 'Alice' }];
  renderWithProviders(<Table data={data} />);

  // Act
  await user.click(screen.getByRole('columnheader', { name: /name/i }));

  // Assert
  const rows = screen.getAllByRole('row');
  expect(within(rows[1]).getByText('Alice')).toBeInTheDocument();
  expect(within(rows[2]).getByText('Bob')).toBeInTheDocument();
});
```

### Testing Patterns

#### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react';

it('should update state when callback is called', () => {
  const { result } = renderHook(() => useAdvancedDataTable({ data, columns }));

  act(() => {
    result.current.table.nextPage();
  });

  expect(result.current.state.pagination.pageIndex).toBe(1);
});
```

#### Testing Async Behavior

```typescript
it('should show loading state while fetching data', async () => {
  renderWithProviders(<Table />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});
```

#### Testing User Interactions

```typescript
it('should select row when checkbox is clicked', async () => {
  const user = userEvent.setup();
  renderWithProviders(<Table data={data} />);

  const checkbox = screen.getAllByRole('checkbox')[0];
  await user.click(checkbox);

  expect(checkbox).toBeChecked();
});
```

#### Testing Callbacks

```typescript
it('should call onRowSelectionChange when row is selected', async () => {
  const onRowSelectionChange = vi.fn();
  const user = userEvent.setup();

  renderWithProviders(
    <Table data={data} onRowSelectionChange={onRowSelectionChange} />
  );

  await user.click(screen.getAllByRole('checkbox')[0]);

  await waitFor(() => {
    expect(onRowSelectionChange).toHaveBeenCalled();
  });
});
```

## Test Utilities

### Custom Render with Providers

Use `renderWithProviders` from `test/utils.tsx`:

```typescript
import { renderWithProviders } from '../../../test/utils';

it('should render component', () => {
  renderWithProviders(<MyComponent />);
  // Component is wrapped with QueryClientProvider
});
```

### User Event Simulation

```typescript
import { userEvent } from '@testing-library/user-event';

it('should handle user interactions', async () => {
  const user = userEvent.setup();

  await user.click(element);
  await user.type(input, 'text');
  await user.keyboard('{Enter}');
  await user.hover(element);
});
```

### Waiting for Changes

```typescript
import { waitFor, screen } from '@testing-library/react';

// Wait for element to appear
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});

// Wait for element to disappear
await waitFor(() => {
  expect(screen.queryByText('Loading')).not.toBeInTheDocument();
});
```

## Mocking

### Mocking Functions

```typescript
import { vi } from 'vitest';

const mockFn = vi.fn();
mockFn.mockReturnValue('value');
mockFn.mockResolvedValue('async value');
mockFn.mockImplementation((arg) => arg * 2);
```

### Mocking Modules

```typescript
// In test file
vi.mock('../module', () => ({
  exportedFunction: vi.fn(),
}));

// In setup.ts (global mocks)
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    // ...
  }),
}));
```

### Mocking Timers

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('should debounce function calls', () => {
  const fn = vi.fn();
  const debounced = debounce(fn, 100);

  debounced();
  expect(fn).not.toHaveBeenCalled();

  vi.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalled();
});
```

## Debugging Tests

### Debug Output

```typescript
import { screen } from '@testing-library/react';

it('debug test', () => {
  render(<Component />);

  // Print entire DOM
  screen.debug();

  // Print specific element
  screen.debug(screen.getByRole('button'));
});
```

### VSCode Configuration

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["test", "--run", "--no-coverage"],
  "console": "integratedTerminal"
}
```

### Running Single Test in Debug Mode

```typescript
it.only('should debug this test', () => {
  // Only this test will run
});

describe.only('Debug Suite', () => {
  // Only this suite will run
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm --filter frontend test:run

      - name: Generate coverage
        run: pnpm --filter frontend test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./apps/frontend/coverage/lcov.info
```

## Common Issues & Solutions

### Issue: "Cannot find module"

**Solution**: Check path aliases in `vitest.config.ts`:

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

### Issue: "ReferenceError: X is not defined"

**Solution**: Add to `test/setup.ts`:

```typescript
global.X = ...;
```

### Issue: "act(...) warning"

**Solution**: Wrap state updates in `act()`:

```typescript
await act(async () => {
  await doSomething();
});
```

### Issue: Tests timing out

**Solution**: Increase timeout:

```typescript
it('slow test', async () => {
  // ...
}, 10000); // 10 second timeout
```

## Next Steps

### Planned Test Coverage

- [ ] Toolbar component tests
- [ ] Virtualized table body tests
- [ ] Bulk actions component tests
- [ ] Export/import functionality tests
- [ ] Column manager tests
- [ ] Global search tests
- [ ] Integration tests with tRPC
- [ ] E2E tests with Playwright

### Contributing Tests

1. Write tests for new features
2. Maintain coverage above thresholds
3. Follow existing patterns
4. Add test documentation
5. Run `pnpm test:coverage` before committing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [TanStack Table Testing](https://tanstack.com/table/latest/docs/guide/testing)

---

**Remember**: Good tests give you confidence to refactor and add features without fear of breaking existing functionality.
